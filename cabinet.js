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

  function renderLessonAccordionItem(lesson) {
    const body = lesson.blocks.map(renderBlock).join('');
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
    const lessons = stage.lessons.map((l) => renderLessonAccordionItem(l)).join('');
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
      bodyHtml = '<ul class="acc">' + card.stages[0].lessons.map((l) => renderLessonAccordionItem(l)).join('') + '</ul>';
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

  function renderCardsGrid(purchases, email) {
    const unlocked = computeUnlockedCards(purchases);
    const greeting = '<p class="label mono">Личный кабинет</p><h1 class="h2" style="margin-bottom:8px">' + escapeHtml(email) + '</h1>';
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

    renderCardsGrid(purchases, session.user.email);
  });
})();
