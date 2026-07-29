'use strict';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR = Math.min(devicePixelRatio || 1, 2);

/* ------------------------------------------------------------------
   pointer + scroll state, shared by both canvases
------------------------------------------------------------------ */
const P = {
  x: innerWidth / 2, y: innerHeight / 2,   // raw pointer
  sx: innerWidth / 2, sy: innerHeight / 2, // smoothed pointer
  inside: false,
  speed: 0        // scroll velocity, drives tunnel thrust
};

addEventListener('mousemove', (e) => { P.x = e.clientX; P.y = e.clientY; P.inside = true; });
addEventListener('mouseleave', () => { P.inside = false; });

let lastY = scrollY;
addEventListener('scroll', () => {
  const d = Math.abs(scrollY - lastY);
  lastY = scrollY;
  P.speed = Math.min(P.speed + d * 0.02, 9);
}, { passive: true });

/* ------------------------------------------------------------------
   1. TUNNEL — perspective wireframe corridor, always moving toward you.
   Real 3D projection: screen = center + (world / z) * focal
------------------------------------------------------------------ */
(function tunnel() {
  const cvs = document.getElementById('tunnel');
  if (!cvs || reduced) return;
  const ctx = cvs.getContext('2d');

  let W = 0, H = 0, focal = 0;

  function resize() {
    W = cvs.width = Math.floor(innerWidth * DPR);
    H = cvs.height = Math.floor(innerHeight * DPR);
    cvs.style.width = innerWidth + 'px';
    cvs.style.height = innerHeight + 'px';
    focal = H * 0.72;
  }
  resize();
  addEventListener('resize', resize);

  // neon palette — desaturated on purpose so long exposure doesn't burn
  const AQUA = '79,227,208';
  const PINK = '244,114,200';
  const VIOLET = '155,123,255';

  // corridor half-size in world units
  const RX = 1.55, RY = 0.95;
  const NEAR = 0.42, FAR = 30;
  const RING_GAP = 0.62;        // denser rings => the lattice reads as cells
  const COLS = 12;              // subdivisions across floor/ceiling
  const ROWS = 7;               // subdivisions up the side walls

  /* --- mountain ridges flanking the corridor ---------------------
     A layered sine stack stands in for noise: cheap, seamless, and it
     never repeats visibly because the periods are mutually irrational. */
  function ridge(t) {
    return 0.55 * Math.sin(t * 0.90)
         + 0.30 * Math.sin(t * 2.31 + 1.7)
         + 0.18 * Math.sin(t * 4.73 + 0.4)
         + 0.10 * Math.sin(t * 9.17 + 2.2);
  }

  // two ranges per side: the far one parallaxes slower, which reads as distance
  const RANGES = [
    { x: 2.30, seed: 0.0, amp: 1.15, base: 0.10, rgb: VIOLET, alpha: 0.95, drag: 1.00 },
    { x: 3.60, seed: 11.3, amp: 1.75, base: 0.28, rgb: PINK,  alpha: 0.60, drag: 0.55 }
  ];
  const M_STEP = 0.62;   // z-sampling interval along a ridge
  const M_STRUT = 3;     // draw a vertical strut every N samples

  function drawMountains() {
    for (const r of RANGES) {
      for (const side of [-1, 1]) {
        const shift = travel * r.drag + r.seed + (side < 0 ? 0 : 47.9);

        // ridge line.
        // Z_MIN keeps the nearest samples out: at small z the projection
        // explodes to enormous coordinates, and stroking a path that wide
        // is pathologically slow. Never put a shadow on this path — a blur
        // over a multi-thousand-pixel span will hang the compositor.
        const Z_MIN = 1.6;
        ctx.beginPath();
        let started = false;
        for (let z = Z_MIN; z < FAR; z += M_STEP) {
          const h = r.base + r.amp * (ridge(z * 0.55 + shift) * 0.5 + 0.5);
          const [sx, sy] = proj(side * r.x, RY - h, z);
          started ? ctx.lineTo(sx, sy) : (ctx.moveTo(sx, sy), started = true);
        }
        // fade with screen height, but never all the way out — the ridge
        // has to stay legible where the vignette is darkest
        const grad = ctx.createLinearGradient(0, H * 0.12, 0, H * 0.98);
        grad.addColorStop(0, `rgba(${r.rgb},${r.alpha})`);
        grad.addColorStop(0.55, `rgba(${r.rgb},${r.alpha * 0.7})`);
        grad.addColorStop(1, `rgba(${r.rgb},${r.alpha * 0.22})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1, DPR * 1.25);
        ctx.stroke();

        // struts down to the floor — the wireframe cue
        let i = 0;
        ctx.beginPath();
        for (let z = Z_MIN; z < FAR; z += M_STEP, i++) {
          if (i % M_STRUT) continue;
          const fade = 1 - z / FAR;
          if (fade <= 0.05) continue;
          const h = r.base + r.amp * (ridge(z * 0.55 + shift) * 0.5 + 0.5);
          const [tx, ty] = proj(side * r.x, RY - h, z);
          const [bx, by] = proj(side * r.x, RY, z);
          ctx.moveTo(tx, ty); ctx.lineTo(bx, by);
        }
        ctx.strokeStyle = `rgba(${r.rgb},${r.alpha * 0.42})`;
        ctx.lineWidth = Math.max(1, DPR * 0.7);
        ctx.stroke();
      }
    }
  }

  let travel = 0, t = 0, roll = 0;
  let thrustNow = 0.03;   // current per-frame advance, read by the streak trails

  // camera state, recomputed each frame
  let ox = 0, oy = 0, cosR = 1, sinR = 0;

  // project a world point to screen space, with camera roll
  function proj(x, y, z) {
    const s = focal / z;
    const wx = x + ox, wy = y + oy;
    return [
      W / 2 + (wx * cosR - wy * sinR) * s,
      H / 2 + (wx * sinR + wy * cosR) * s
    ];
  }

  // --- drifting nodes suspended in the corridor ---
  const NODES = 190;
  const nodes = Array.from({ length: NODES }, () => ({
    x: (Math.random() - 0.5) * RX * 2.6,
    y: (Math.random() - 0.5) * RY * 2.6,
    z: NEAR + Math.random() * (FAR - NEAR),
    p: Math.random() * 6.28
  }));

  // --- streaks: fast motes that smear radially, selling the speed ---
  const STREAKS = 55;
  const streaks = Array.from({ length: STREAKS }, () => ({
    x: (Math.random() - 0.5) * RX * 2.9,
    y: (Math.random() - 0.5) * RY * 2.9,
    z: NEAR + Math.random() * (FAR - NEAR),
    k: 1.6 + Math.random() * 2.4          // how much faster than the camera
  }));

  // --- wireframe cubes tumbling through space ---
  const CUBE_V = [
    [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
    [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]
  ];
  const CUBE_E = [
    [0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7]
  ];
  const cubes = Array.from({ length: 9 }, (_, i) => ({
    x: (Math.random() - 0.5) * 2.6,
    y: (Math.random() - 0.5) * 1.6,
    z: NEAR + 2 + i * 3.1,
    s: 0.16 + Math.random() * 0.14,
    rx: Math.random() * 6.28, ry: Math.random() * 6.28,
    vx: 0.004 + Math.random() * 0.006,
    vy: 0.003 + Math.random() * 0.005
  }));

  // --- light pulses racing away down the corridor ---
  const pulses = [ { z: 6 }, { z: 15 }, { z: 24 } ];

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, DPR * 0.8);

    // mountains sit behind everything else in the scene
    drawMountains();

    // --- rings ---
    const first = NEAR + (travel % RING_GAP);
    for (let z = first; z < FAR; z += RING_GAP) {
      const fade = 1 - z / FAR;
      const a = fade * fade * 0.5;
      if (a < 0.004) continue;

      const [ax, ay] = proj(-RX, -RY, z);
      const [bx, by] = proj(RX, -RY, z);
      const [cx2, cy2] = proj(RX, RY, z);
      const [dx, dy] = proj(-RX, RY, z);

      ctx.strokeStyle = `rgba(79,227,208,${a})`;
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      ctx.lineTo(cx2, cy2); ctx.lineTo(dx, dy);
      ctx.closePath(); ctx.stroke();
    }

    // --- bright pulses sweeping outward ---
    for (const p of pulses) {
      const fade = 1 - p.z / FAR;
      if (fade > 0) {
        const [ax, ay] = proj(-RX, -RY, p.z);
        const [bx, by] = proj(RX, -RY, p.z);
        const [cx2, cy2] = proj(RX, RY, p.z);
        const [dx, dy] = proj(-RX, RY, p.z);
        ctx.strokeStyle = `rgba(226,240,255,${fade * 0.85})`;
        ctx.lineWidth = Math.max(1, DPR * 1.7);
        ctx.shadowColor = 'rgba(79,227,208,0.9)';
        ctx.shadowBlur = 18 * DPR;
        ctx.beginPath();
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
        ctx.lineTo(cx2, cy2); ctx.lineTo(dx, dy);
        ctx.closePath(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(1, DPR * 0.8);
      }
    }

    /* --- longitudinal lines, drawn as depth banded segments ---------
       A single gradient per line does NOT work here: it would have to
       start at z=NEAR, which projects far outside the viewport, so the
       on-screen part of the line samples the transparent tail and the
       lattice disappears. Instead walk the corridor in depth bands and
       stroke every line's segment for that band in one path — correct
       per-depth alpha, and still only ~16 stroke calls per frame. */
    const Z0 = 0.9;
    const BANDS = 16;
    for (let b = 0; b < BANDS; b++) {
      // geometric spacing keeps the bands visually even under perspective
      const z0 = Z0 * Math.pow(FAR / Z0, b / BANDS);
      const z1 = Z0 * Math.pow(FAR / Z0, (b + 1) / BANDS);
      const fade = 1 - ((z0 + z1) * 0.5) / FAR;
      const a = fade * fade * 0.38;
      if (a < 0.005) continue;

      ctx.beginPath();
      // floor + ceiling
      for (let i = 0; i <= COLS; i++) {
        const x = -RX + (2 * RX) * (i / COLS);
        for (const y of [-RY, RY]) {
          const p0 = proj(x, y, z0), p1 = proj(x, y, z1);
          ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
        }
      }
      // side walls
      for (let i = 0; i <= ROWS; i++) {
        const y = -RY + (2 * RY) * (i / ROWS);
        for (const x of [-RX, RX]) {
          const p0 = proj(x, y, z0), p1 = proj(x, y, z1);
          ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
        }
      }
      ctx.strokeStyle = `rgba(${AQUA},${a})`;
      ctx.stroke();
    }

    // --- suspended nodes: near ones get a motion streak ---
    for (const n of nodes) {
      const fade = 1 - n.z / FAR;
      if (fade <= 0) continue;
      const bob = Math.sin(t * 1.4 + n.p) * 0.045;
      const [sx, sy] = proj(n.x, n.y + bob, n.z);
      const r = Math.max(0.6, (focal / n.z) * 0.006);

      if (n.z < 9) {
        // trail back toward where it was a moment ago — radial blur
        const [px2, py2] = proj(n.x, n.y + bob, n.z + thrustNow * 5);
        ctx.strokeStyle = `rgba(${VIOLET},${fade * 0.34})`;
        ctx.lineWidth = Math.max(1, r * 0.9);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(px2, py2); ctx.stroke();
      }

      ctx.fillStyle = `rgba(${VIOLET},${fade * 0.7})`;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.28); ctx.fill();
    }

    // --- streaks: long radial smears rushing past the camera ---
    ctx.lineWidth = Math.max(1, DPR * 0.9);
    for (const s of streaks) {
      const fade = 1 - s.z / FAR;
      if (fade <= 0) continue;
      const [ax, ay] = proj(s.x, s.y, s.z);
      const [bx, by] = proj(s.x, s.y, s.z + thrustNow * 14 * s.k);
      ctx.strokeStyle = `rgba(${AQUA},${fade * fade * 0.75})`;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.lineWidth = Math.max(1, DPR * 0.8);

    // --- tumbling wireframe cubes ---
    for (const c of cubes) {
      const fade = 1 - c.z / FAR;
      if (fade <= 0) continue;
      const ca = Math.cos(c.rx), sa = Math.sin(c.rx);
      const cb = Math.cos(c.ry), sb = Math.sin(c.ry);

      const pts = CUBE_V.map(([vx, vy, vz]) => {
        // rotate Y then X
        let x = vx * cb + vz * sb;
        let z = -vx * sb + vz * cb;
        let y = vy * ca - z * sa;
        z = vy * sa + z * ca;
        return proj(c.x + x * c.s, c.y + y * c.s, c.z + z * c.s);
      });

      ctx.strokeStyle = `rgba(${PINK},${fade * 0.6})`;
      ctx.beginPath();
      for (const [a, b] of CUBE_E) {
        ctx.moveTo(pts[a][0], pts[a][1]);
        ctx.lineTo(pts[b][0], pts[b][1]);
      }
      ctx.stroke();
    }

    // --- vanishing point glow ---
    const [vx, vy] = proj(0, 0, FAR);
    const halo = ctx.createRadialGradient(vx, vy, 0, vx, vy, H * 0.34);
    halo.addColorStop(0, `rgba(79,227,208,${0.26 + Math.sin(t * 1.1) * 0.07})`);
    halo.addColorStop(0.5, 'rgba(79,227,208,0.09)');
    halo.addColorStop(1, 'rgba(79,227,208,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
  }

  (function frame() {
    P.sx += (P.x - P.sx) * 0.055;
    P.sy += (P.y - P.sy) * 0.055;
    P.speed *= 0.93;

    t += 0.016;
    const thrust = 0.030 + P.speed * 0.016;   // never idle — always flying
    thrustNow = thrust;
    travel += thrust;

    // camera: cursor parallax + a slow, permanent banking roll
    const px = P.inside ? (P.sx / innerWidth - 0.5) : 0;
    const py = P.inside ? (P.sy / innerHeight - 0.5) : 0;
    ox = -px * 0.34 + Math.sin(t * 0.23) * 0.06;
    oy = -py * 0.22 + Math.cos(t * 0.19) * 0.04;
    roll = Math.sin(t * 0.15) * 0.05 + px * 0.06;
    cosR = Math.cos(roll); sinR = Math.sin(roll);

    // advance the world
    for (const n of nodes) {
      n.z -= thrust;
      if (n.z <= NEAR) {
        n.z = FAR;
        n.x = (Math.random() - 0.5) * RX * 2.4;
        n.y = (Math.random() - 0.5) * RY * 2.4;
      }
    }
    for (const s of streaks) {
      s.z -= thrust * s.k;          // they overtake the camera
      if (s.z <= NEAR) {
        s.z = FAR;
        s.x = (Math.random() - 0.5) * RX * 2.9;
        s.y = (Math.random() - 0.5) * RY * 2.9;
      }
    }
    for (const c of cubes) {
      c.z -= thrust * 0.85;
      c.rx += c.vx; c.ry += c.vy;
      if (c.z <= NEAR + 0.6) {
        c.z = FAR;
        c.x = (Math.random() - 0.5) * 2.4;
        c.y = (Math.random() - 0.5) * 1.5;
      }
    }
    for (const p of pulses) {
      p.z += thrust * 2.6;
      if (p.z > FAR) p.z = NEAR + 0.5;
    }

    draw();
    requestAnimationFrame(frame);
  })();
})();

/* ------------------------------------------------------------------
   2. DIGITAL RAIN — columns of falling digits that chase the cursor
------------------------------------------------------------------ */
(function rain() {
  const cvs = document.getElementById('rain');
  if (!cvs || reduced) return;
  const ctx = cvs.getContext('2d');

  const GLYPHS = '0101101001ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789';
  const SIZE = 15;          // glyph size in css px
  const STEP = SIZE + 3;    // column pitch
  const MAX_CURSOR = 28;    // bright columns chasing the pointer
  const MAX_AMBIENT = 24;   // faint columns raining everywhere, always
  const SPREAD = 190;       // how far around the cursor columns can spawn

  let W = 0, H = 0;
  const drops = [];
  let nCursor = 0, nAmbient = 0;

  function resize() {
    W = cvs.width = Math.floor(innerWidth * DPR);
    H = cvs.height = Math.floor(innerHeight * DPR);
    cvs.style.width = innerWidth + 'px';
    cvs.style.height = innerHeight + 'px';
  }
  resize();
  addEventListener('resize', resize);

  const pick = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

  function spawn(ambient) {
    // snap to a column so the rain keeps its grid discipline
    const col = ambient
      ? Math.round((Math.random() * innerWidth) / STEP)
      : Math.round((P.x + (Math.random() - 0.5) * SPREAD) / STEP);

    const len = ambient ? 10 + ((Math.random() * 16) | 0)
                        : 6 + ((Math.random() * 12) | 0);

    drops.push({
      x: col * STEP,
      // ambient columns enter from above the fold so the screen is never empty
      y: ambient ? -Math.random() * innerHeight * 0.6
                 : P.y + (Math.random() - 0.5) * 90,
      v: ambient ? 1.1 + Math.random() * 2.2 : 1.7 + Math.random() * 3.4,
      chars: Array.from({ length: len }, pick),
      life: 1,
      // ambient rain decays slowly — it has a whole screen to cross
      decay: ambient ? 0.0016 : 0.0045,
      amb: !!ambient
    });
    ambient ? nAmbient++ : nCursor++;
  }

  // Pre-seed the ambient rain mid-fall, otherwise the first couple of
  // seconds after load are an empty screen while columns accumulate.
  for (let i = 0; i < MAX_AMBIENT; i++) {
    spawn(true);
    const d = drops[drops.length - 1];
    d.y = Math.random() * innerHeight;
    d.life = 0.45 + Math.random() * 0.55;
  }

  function frame() {
    // fade the previous frame instead of clearing — that's the trail
    // lower alpha = longer trails; faint ambient glyphs need the extra dwell
    ctx.fillStyle = 'rgba(7,6,15,0.12)';
    ctx.fillRect(0, 0, W, H);

    // ambient rain runs regardless of the pointer — the screen is never static
    if (nAmbient < MAX_AMBIENT && Math.random() < 0.28) spawn(true);
    if (P.inside && nCursor < MAX_CURSOR && Math.random() < 0.55) spawn(false);

    ctx.font = `${SIZE * DPR}px ${getComputedStyle(document.body).getPropertyValue('--mono') || 'monospace'}`;
    ctx.textBaseline = 'top';

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.v;
      d.life -= d.decay;

      if (d.life <= 0 || d.y - d.chars.length * STEP > innerHeight) {
        drops.splice(i, 1);
        d.amb ? nAmbient-- : nCursor--;
        continue;
      }

      // occasionally mutate a glyph — the rain should never look looped
      if (Math.random() < 0.22) d.chars[(Math.random() * d.chars.length) | 0] = pick();

      for (let j = 0; j < d.chars.length; j++) {
        const y = d.y - j * STEP;
        if (y < -SIZE || y > innerHeight) continue;
        const tail = 1 - j / d.chars.length;
        // ambient columns stay well under the type; cursor columns lead
        const a = tail * d.life * (d.amb ? 0.42 : 1);

        if (j === 0) {
          // bright head, aqua halo
          ctx.fillStyle = `rgba(232,241,255,${Math.min(1, a * 1.5)})`;
          ctx.shadowColor = 'rgba(79,227,208,0.9)';
          ctx.shadowBlur = (d.amb ? 6 : 12) * DPR;
        } else {
          // tail drifts aqua -> violet as it fades, so it never reads as flat
          const k = j / d.chars.length;
          const R = Math.round(79 + (155 - 79) * k);
          const G = Math.round(227 + (123 - 227) * k);
          const B = Math.round(208 + (255 - 208) * k);
          ctx.fillStyle = `rgba(${R},${G},${B},${a * 0.72})`;
          ctx.shadowBlur = 0;
        }
        ctx.fillText(d.chars[j], d.x * DPR, y * DPR);
      }
    }
    ctx.shadowBlur = 0;
    requestAnimationFrame(frame);
  }
  frame();
})();

/* ------------------------------------------------------------------
   3. DECODE — headings resolve out of scrambled glyphs
------------------------------------------------------------------ */
function decode(el) {
  if (reduced || el.dataset.decoded) return;
  el.dataset.decoded = '1';

  const SCRAMBLE = '01ｱｲｳｴｵｶｷｸ█▓#%&';
  // walk text nodes only, so <br> and <span> survive untouched
  const nodes = [];
  (function walk(n) {
    n.childNodes.forEach(c => {
      if (c.nodeType === 3 && c.nodeValue.trim()) nodes.push({ node: c, text: c.nodeValue });
      else if (c.nodeType === 1) walk(c);
    });
  })(el);

  const total = 26;
  let step = 0;
  const tick = setInterval(() => {
    step++;
    nodes.forEach(({ node, text }) => {
      const settled = Math.floor((text.length * step) / total);
      let out = text.slice(0, settled);
      for (let i = settled; i < text.length; i++) {
        out += text[i] === ' ' ? ' ' : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
      }
      node.nodeValue = out;
    });
    if (step >= total) {
      clearInterval(tick);
      nodes.forEach(({ node, text }) => { node.nodeValue = text; });
    }
  }, 26);
}

/* ------------------------------------------------------------------
   4. REVEAL — content arrives out of depth
------------------------------------------------------------------ */
const ups = document.querySelectorAll('.up');

if (reduced) {
  ups.forEach(el => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      setTimeout(() => {
        el.classList.add('in');
        if (el.hasAttribute('data-decode')) decode(el);
      }, i * 55);
      io.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  ups.forEach(el => io.observe(el));

  // safety net: never leave content invisible if the observer never fires
  setTimeout(() => {
    ups.forEach(el => {
      if (!el.classList.contains('in') && el.getBoundingClientRect().top < innerHeight) {
        el.classList.add('in');
        if (el.hasAttribute('data-decode')) decode(el);
      }
    });
  }, 2500);
}

/* ------------------------------------------------------------------
   5. DEPTH PARALLAX — card groups tilt with the cursor
------------------------------------------------------------------ */
if (!reduced) {
  const layers = document.querySelectorAll('.depth');
  (function tilt() {
    const rx = (P.sy / innerHeight - 0.5) * -3.2;
    const ry = (P.sx / innerWidth - 0.5) * 3.2;
    layers.forEach(l => {
      const r = l.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;   // skip offscreen work
      l.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    requestAnimationFrame(tilt);
  })();
}

/* ------------------------------------------------------------------
   6. chrome: header, progress, clock, nav, accordion, form
------------------------------------------------------------------ */
const header = document.getElementById('header');
const progress = document.getElementById('progress');

function onScroll() {
  const y = scrollY;
  header.classList.toggle('stuck', y > 40);
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const clock = document.getElementById('clock');
if (clock) {
  const tick = () => {
    const d = new Date();
    clock.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':');
  };
  tick();
  setInterval(tick, 1000);
}

const offerTimer = document.getElementById('offerTimer');
if (offerTimer) {
  // Один реальный дедлайн для всех посетителей — не персональный фейковый таймер на 24 часа,
  // который перезапускается сам по себе (это подпадало бы под "заведомо ложную рекламу").
  // Когда решите провести новую акцию — просто поменяйте эту дату на новую и не раньше.
  const OFFER_DEADLINE = new Date('2026-08-04T23:59:59+05:00').getTime();
  const offerBanner = document.querySelector('.offer');

  const setRegularPricing = () => {
    document.querySelectorAll('.plan__price').forEach((price) => {
      const oldEl = price.querySelector('.plan__old');
      const newEl = price.querySelector('.plan__new');
      if (newEl) newEl.remove();
      if (oldEl) oldEl.classList.add('plan__old--regular');
    });
  };

  let timerId;
  const tick = () => {
    const left = OFFER_DEADLINE - Date.now();
    if (left <= 0) {
      if (timerId) clearInterval(timerId);
      if (offerBanner) offerBanner.remove();
      setRegularPricing();
      return;
    }
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    offerTimer.textContent = [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
  };
  timerId = setInterval(tick, 1000);
  tick();
}

const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
burger.addEventListener('click', () => {
  nav.classList.toggle('open');
  burger.classList.toggle('x');
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('open');
  burger.classList.remove('x');
}));

document.querySelectorAll('.acc__q, .mod__q').forEach(q => {
  q.addEventListener('click', () => {
    const item = q.parentElement;
    const body = item.querySelector('.acc__a');
    const group = item.closest('.acc');
    const open = item.classList.contains('open');

    group.querySelectorAll('.acc__i.open').forEach(o => {
      if (o !== item) { o.classList.remove('open'); o.querySelector('.acc__a').style.maxHeight = null; }
    });

    if (open) { item.classList.remove('open'); body.style.maxHeight = null; }
    else { item.classList.add('open'); body.style.maxHeight = body.scrollHeight + 'px'; }
  });
});
