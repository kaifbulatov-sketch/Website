(() => {
  const card = document.getElementById('cabinetCard');
  const logoutBtn = document.getElementById('logoutBtn');

  const render = (html) => { card.innerHTML = html; };

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  /* ------------------------------------------------------------------
     Разблокировка карточек курса: карточка открыта, если среди оплаченных
     тарифов есть хотя бы один из card.unlockPlans. Вся логика — в этом
     единственном месте, в самих данных (course-content.js), а не размазана
     по коду — так карточка и её условие открытия не могут разойтись.
  ------------------------------------------------------------------ */
  function computeUnlockedCards(purchases) {
    const paid = new Set((purchases || []).map((p) => p.plan));
    const unlocked = new Set();
    COURSE_CARDS.forEach((c) => {
      if (c.unlockPlans.some((p) => paid.has(p))) unlocked.add(c.id);
    });
    return unlocked;
  }

  /* ------------------------------------------------------------------
     Пиксельная иконка замка — 8×9 клеток, та же техника, что у курсора
     сайта (жёсткие пиксели, shape-rendering:crispEdges). Цвет берётся из
     CSS через currentColor (.cab-lock задаёт color в style.css).
  ------------------------------------------------------------------ */
  const LOCK_SVG =
    '<svg class="cab-lock" viewBox="0 0 16 18" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">' +
      '<rect x="4" y="0" width="8" height="2"/>' +
      '<rect x="4" y="2" width="2" height="2"/><rect x="10" y="2" width="2" height="2"/>' +
      '<rect x="4" y="4" width="2" height="2"/><rect x="10" y="4" width="2" height="2"/>' +
      '<rect x="4" y="6" width="2" height="2"/><rect x="10" y="6" width="2" height="2"/>' +
      '<rect x="0" y="8" width="16" height="2"/>' +
      '<rect x="0" y="10" width="16" height="2"/>' +
      '<rect x="0" y="12" width="6" height="2"/><rect x="8" y="12" width="8" height="2"/>' +
      '<rect x="0" y="14" width="6" height="2"/><rect x="8" y="14" width="8" height="2"/>' +
      '<rect x="0" y="16" width="16" height="2"/>' +
    '</svg>';

  /* ------------------------------------------------------------------
     Рендер одного содержательного блока урока (см. схему в course-content.js)
  ------------------------------------------------------------------ */
  function renderBlock(b) {
    switch (b.type) {
      case 'h4':
        return '<h4>' + b.html + '</h4>';
      case 'p':
        return '<p>' + b.html + '</p>';
      case 'lead':
      case 'callout':
        return '<p class="cab-callout' + (b.isResult ? ' cab-callout--result' : '') + '">' +
          '<b class="cab-callout__label">' + escapeHtml(b.label) + ':</b> ' + b.html + '</p>';
      case 'ol':
      case 'ul': {
        const tag = b.type;
        const labelHtml = b.label ? '<p class="cab-callout"><b class="cab-callout__label">' + escapeHtml(b.label) + '</b></p>' : '';
        const items = b.items.map((i) => '<li>' + i + '</li>').join('');
        return labelHtml + '<' + tag + '>' + items + '</' + tag + '>';
      }
      case 'table': {
        const thead = '<tr>' + b.headers.map((h) => '<th>' + escapeHtml(h) + '</th>').join('') + '</tr>';
        const rows = b.rows.map((r) => '<tr>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('');
        return '<table class="cab-table"><thead>' + thead + '</thead><tbody>' + rows + '</tbody></table>';
      }
      default:
        return '';
    }
  }

  /* ------------------------------------------------------------------
     Видео урока. Ссылка в данных — одна строка (см. course-content.js),
     тип определяется по ней самой, чтобы в данных не появлялось лишнего поля,
     которое можно забыть или проставить неверно.

     iframe грузится лениво: src подставляется при первом раскрытии урока
     (см. bindAccordions). Иначе 28 плееров YouTube начали бы тянуть свои
     скрипты сразу при входе в кабинет — при том, что панели уроков закрыты
     и ни один из них не виден.
  ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
     Обложка урока. Рисуется как SVG прямо из данных урока, а не хранится
     картинкой: 28 файлов пришлось бы перерисовывать вручную при каждой
     правке названия, и они бы разъехались с содержимым. Здесь обложка не
     может устареть — заголовок на ней тот же, что в аккордеоне.
     Размер холста 1600×900 (16:9) — тот же, что просят площадки под превью,
     так что этот же SVG подойдёт и на обложку ролика.
  ------------------------------------------------------------------ */
  const COVER_FF = 'Helvetica Neue, Inter, Arial, sans-serif';
  const COVER_MONO = 'Consolas, Menlo, monospace';

  // SVG не переносит текст сам — режем по словам. Ширина подобрана под
  // font-size 76 в поле 1360px.
  function wrapCoverTitle(text, maxChars, maxLines) {
    const lines = [];
    let cur = '';
    String(text).split(/\s+/).forEach((w) => {
      const next = cur ? cur + ' ' + w : w;
      if (next.length > maxChars && cur) { lines.push(cur); cur = w; } else { cur = next; }
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + '…';
    }
    return lines;
  }

  function renderLessonCover(lesson, stageTitle) {
    const n = lesson.n;
    const num = String(n).padStart(2, '0');
    const title = wrapCoverTitle(lesson.title, 28, 3)
      .map((l, i) => '<text x="120" y="' + (524 + i * 92) + '" fill="#e8e7f6" font-family="' +
        COVER_FF + '" font-size="76" font-weight="300">' + escapeHtml(l) + '</text>')
      .join('');

    return (
      '<svg class="cab-cover" viewBox="0 0 1600 900" role="img" aria-label="Обложка урока ' + n + '">' +
        '<defs>' +
          '<pattern id="cg' + n + '" width="80" height="80" patternUnits="userSpaceOnUse">' +
            '<path d="M80 0H0V80" fill="none" stroke="rgba(155,123,255,.12)" stroke-width="1"/>' +
          '</pattern>' +
          '<linearGradient id="cv' + n + '" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="#4fe3d0" stop-opacity=".10"/>' +
            '<stop offset="1" stop-color="#9b7bff" stop-opacity="0"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<rect width="1600" height="900" fill="#07060f"/>' +
        '<rect width="1600" height="900" fill="url(#cg' + n + ')"/>' +
        '<rect width="1600" height="900" fill="url(#cv' + n + ')"/>' +
        '<text x="120" y="196" font-family="' + COVER_MONO + '" font-size="26" letter-spacing="9" fill="#54508a">УРОК</text>' +
        '<text x="120" y="368" font-family="' + COVER_MONO + '" font-size="150" fill="#4fe3d0">' + num + '</text>' +
        '<rect x="120" y="410" width="118" height="3" fill="#f472c8"/>' +
        title +
        '<text x="120" y="812" font-family="' + COVER_MONO + '" font-size="23" letter-spacing="5" fill="#54508a">' +
          escapeHtml(String(stageTitle || '').toUpperCase()) + '</text>' +
        '<text x="1480" y="812" text-anchor="end" font-family="' + COVER_MONO + '" font-size="30" letter-spacing="8" fill="#e8e7f6">' +
          'NEURA<tspan fill="#4fe3d0">_</tspan></text>' +
      '</svg>'
    );
  }

  function renderVideo(lesson, stageTitle) {
    const src = lesson.video;
    if (!src) {
      // Видео ещё нет — на его месте обложка, а не пустая рамка: слот сразу
      // выглядит законченным, и высота у него та же, что будет у плеера.
      return '<div class="cab-video cab-video--empty">' + renderLessonCover(lesson, stageTitle) +
        '<span class="cab-video__soon mono">Видео скоро</span></div>';
    }
    const frame = (url, allow) =>
      '<div class="cab-video"><iframe data-src="' + escapeHtml(url) + '" allow="' + allow +
      '" allowfullscreen title="Видео урока"></iframe></div>';

    const yt = src.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
    if (yt) {
      return frame('https://www.youtube-nocookie.com/embed/' + yt[1],
        'accelerometer; encrypted-media; picture-in-picture; fullscreen');
    }
    const vm = src.match(/vimeo\.com\/(\d+)/);
    if (vm) {
      return frame('https://player.vimeo.com/video/' + vm[1], 'fullscreen; picture-in-picture');
    }
    // Прямая ссылка на файл: preload="none" — не тянуть ничего, пока не нажали play.
    return '<div class="cab-video"><video controls preload="none" src="' + escapeHtml(src) + '"></video></div>';
  }

  function renderLessonAccordionItem(lesson, stageTitle) {
    const body = renderVideo(lesson, stageTitle) + lesson.blocks.map(renderBlock).join('');
    return (
      '<li class="acc__i">' +
        '<button type="button" class="acc__q">' +
          '<span>Урок ' + lesson.n + '. ' + escapeHtml(lesson.title) + '</span>' +
          '<i>+</i>' +
        '</button>' +
        '<div class="acc__a"><div class="cab-body">' + body + '</div></div>' +
      '</li>'
    );
  }

  function renderStageAccordionItem(stage) {
    const lessons = stage.lessons.map((l) => renderLessonAccordionItem(l, stage.title)).join('');
    return (
      '<li class="acc__i">' +
        '<button type="button" class="acc__q">' +
          '<span>' + escapeHtml(stage.title) + '</span>' +
          '<i>+</i>' +
        '</button>' +
        '<div class="acc__a"><ul class="acc">' + lessons + '</ul></div>' +
      '</li>'
    );
  }

  function renderUnlockedCard(card) {
    let bodyHtml;
    if (card.stages.length === 1) {
      // Единственный этап — сразу плоский список уроков, без лишнего внешнего уровня.
      bodyHtml = '<ul class="acc">' +
        card.stages[0].lessons.map((l) => renderLessonAccordionItem(l, card.stages[0].title)).join('') + '</ul>';
    } else {
      bodyHtml = '<ul class="acc">' + card.stages.map(renderStageAccordionItem).join('') + '</ul>';
    }
    return (
      '<div class="cab-card cab-card--unlocked" data-card="' + card.id + '">' +
        '<div class="cab-card__head">' +
          '<div>' +
            '<h3>' + escapeHtml(card.title) + '</h3>' +
            '<p class="cab-card__range mono">' + escapeHtml(card.range) + '</p>' +
          '</div>' +
        '</div>' +
        bodyHtml +
      '</div>'
    );
  }

  function renderLockedCard(card) {
    const plan = PLANS[card.buyPlan];
    const teaser = card.stages.map((stage) => (
      '<p class="cab-teaser-stage mono">' + escapeHtml(stage.title) + '</p>' +
      '<ul class="cab-teaser-list">' +
        stage.lessons.map((l) => '<li>Урок ' + l.n + '. ' + escapeHtml(l.title) + '</li>').join('') +
      '</ul>'
    )).join('');

    const bonusNote = card.bonusOnly
      ? '<p class="cab-card__bonus-note">Доступно только в тарифе «Всё вместе» — отдельно этот блок не продаётся.</p>'
      : '';
    const buyLabel = card.bonusOnly ? 'Открыть в «Всё вместе»' : 'Купить «' + escapeHtml(card.title) + '»';

    return (
      '<div class="cab-card cab-card--locked" data-card="' + card.id + '">' +
        '<div class="cab-card__head">' +
          '<div>' +
            '<h3>' + escapeHtml(card.title) + '</h3>' +
            '<p class="cab-card__range mono">' + escapeHtml(card.range) + '</p>' +
            '<p class="cab-card__desc">' + escapeHtml(card.desc) + '</p>' +
          '</div>' +
          LOCK_SVG +
        '</div>' +
        '<div class="cab-teaser">' + teaser + '</div>' +
        bonusNote +
        '<div class="cab-card__buy">' +
          '<span class="plan__old mono">' + plan.oldPrice + '</span>' +
          '<span class="plan__new mono">' + plan.newPrice + '</span>' +
        '</div>' +
        '<a href="oplata.html?plan=' + card.buyPlan + '" class="btn btn--line w100" style="margin-top:14px">' + buyLabel + '</a>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------------------
     Аккордеон навешивается через делегирование на контейнер — карточки
     вставляются через innerHTML уже после загрузки страницы, статический
     обработчик из script.js (который к тому же тут не подключён) их бы
     не увидел.

     Два отличия от одноуровневого паттерна script.js:
     1. `:scope >` вместо querySelectorAll при закрытии соседей — иначе
        закрытие одного этапа задело бы уроки внутри ДРУГОГО, всё ещё
        открытого этапа (querySelectorAll видит все вложенные .acc__i,
        не только соседей на своём уровне).
     2. После открытия/закрытия — пересчёт max-height всех открытых
        .acc__a-предков вверх по дереву: высота внешней панели этапа
        фиксируется в момент ЕЁ открытия, и если урок внутри неё потом
        меняет свою высоту, внешняя панель не подстроится сама.
  ------------------------------------------------------------------ */
  function bindAccordions(container) {
    container.addEventListener('click', (e) => {
      const q = e.target.closest('.acc__q');
      if (!q || !container.contains(q)) return;

      const item = q.parentElement;
      const body = item.querySelector(':scope > .acc__a');
      const group = item.parentElement; // ближайший <ul class="acc">
      const open = item.classList.contains('open');

      group.querySelectorAll(':scope > .acc__i.open').forEach((o) => {
        if (o !== item) {
          o.classList.remove('open');
          o.querySelector(':scope > .acc__a').style.maxHeight = null;
        }
      });

      if (open) {
        item.classList.remove('open');
        body.style.maxHeight = null;
      } else {
        // Подключить плееры этого урока (и только его — вложенные уроки
        // раскрывающегося этапа остаются закрытыми, грузить их незачем).
        // Высота при этом не меняется: .cab-video держит aspect-ratio 16/9
        // ещё до загрузки, так что max-height ниже считается уже верно.
        const own = body.querySelector(':scope > .cab-body');
        if (own) {
          own.querySelectorAll('iframe[data-src]').forEach((f) => {
            f.src = f.dataset.src;
            f.removeAttribute('data-src');
          });
        }
        item.classList.add('open');
        body.style.maxHeight = body.scrollHeight + 'px';
      }

      // Пересчитать max-height открытых предков нужно ПОСЛЕ того, как у body
      // реально завершится transition, а не сразу синхронно: сразу после клика
      // высота body ещё анимируется (0 → scrollHeight или наоборот), и scrollHeight
      // предка, посчитанный в этот момент, не учитывает конечную высоту body —
      // предок в итоге обрежет или не до конца схлопнет содержимое.
      const resyncAncestors = () => {
        let ancestorBody = item.parentElement.closest('.acc__a');
        while (ancestorBody) {
          const ancestorItem = ancestorBody.parentElement;
          if (ancestorItem && ancestorItem.classList.contains('open')) {
            ancestorBody.style.maxHeight = ancestorBody.scrollHeight + 'px';
          }
          ancestorBody = ancestorItem ? ancestorItem.parentElement.closest('.acc__a') : null;
        }
      };
      body.addEventListener('transitionend', function onEnd(ev) {
        if (ev.target !== body || ev.propertyName !== 'max-height') return;
        body.removeEventListener('transitionend', onEnd);
        resyncAncestors();
      });
      // На случай отключённых/пропущенных transition (prefers-reduced-motion,
      // мгновенный клик до конца анимации предыдущего элемента) — подстраховка.
      resyncAncestors();
    });
  }

  function renderCardsGrid(purchases, email, clientNo) {
    const unlocked = computeUnlockedCards(purchases);
    // Номер клиента показываем рядом с почтой: его же человек называет в WhatsApp,
    // когда пишет про оплату, поэтому он должен быть на виду, а не только в базе.
    const clientLine = clientNo
      ? '<p class="cab-client mono">Клиент №' + escapeHtml(clientNo) + '</p>'
      : '';
    const greeting = '<p class="label mono">Личный кабинет</p><h1 class="h2" style="margin-bottom:8px">' +
      escapeHtml(email) + '</h1>' + clientLine;
    const cardsHtml = COURSE_CARDS.map((c) =>
      unlocked.has(c.id) ? renderUnlockedCard(c) : renderLockedCard(c)
    ).join('');
    render(greeting + '<div class="cab-cards">' + cardsHtml + '</div>');
    bindAccordions(card);
  }

  /* ==================== точка входа страницы ==================== */

  if (!SUPABASE_CONFIGURED || !supabaseClient) {
    render('<p class="label mono">Личный кабинет</p><h1 class="h2">Скоро заработает</h1><p class="lead">Идёт подключение личного кабинета — загляните позже.</p>');
    logoutBtn.style.display = 'none';
    return;
  }

  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    location.href = 'index.html';
  });

  supabaseClient.auth.getSession().then(async ({ data }) => {
    const session = data.session;
    if (!session) {
      logoutBtn.style.display = 'none';
      render(
        '<p class="label mono">Личный кабинет</p><h1 class="h2">Нужен вход</h1>' +
        '<p class="lead" style="margin-bottom:26px">Зарегистрируйтесь или войдите, чтобы увидеть купленные курсы.</p>' +
        '<a href="index.html#cta" class="btn btn--fill w100">Войти / зарегистрироваться</a>'
      );
      return;
    }

    const { data: purchases, error } = await supabaseClient
      .from('purchases')
      .select('plan, status, created_at')
      .eq('user_id', session.user.id)
      .eq('status', 'paid');

    if (error) {
      render('<p class="label mono">Личный кабинет</p><h1 class="h2">Ошибка загрузки</h1><p class="lead">Обновите страницу чуть позже.</p>');
      return;
    }

    // Номер клиента — не критичен для доступа к курсу, поэтому его отсутствие
    // (старый аккаунт без строки в profiles) не должно ломать весь кабинет.
    const { data: profile } = await supabaseClient
      .from('profiles').select('client_no').eq('user_id', session.user.id).single();

    renderCardsGrid(purchases, session.user.email, profile && profile.client_no);
  });
})();
