(() => {
  const card = document.getElementById('cabinetCard');
  const logoutBtn = document.getElementById('logoutBtn');

  const render = (html) => { card.innerHTML = html; };

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

    const greeting = '<p class="label mono">Личный кабинет</p><h1 class="h2" style="margin-bottom:8px">' + session.user.email + '</h1>';

    if (!purchases || purchases.length === 0) {
      render(
        greeting +
        '<p class="lead" style="margin:18px 0 26px">Пока нет оплаченных тарифов.</p>' +
        '<a href="index.html#pricing" class="btn btn--fill w100">Выбрать тариф</a>'
      );
      return;
    }

    const items = purchases.map((p) => {
      const plan = PLANS[p.plan];
      if (!plan) return '';
      const lessons = plan.items.map((i) => '<li>' + i + '</li>').join('');
      return (
        '<div class="cabinet-plan">' +
          '<h3>' + plan.title + '</h3>' +
          '<p class="pay-desc">' + plan.desc + '</p>' +
          '<ul class="mono pay-list">' + lessons + '</ul>' +
          '<p class="cabinet-note mono">Материалы модулей публикуются здесь по мере выхода курса.</p>' +
        '</div>'
      );
    }).join('');

    render(greeting + '<div class="cabinet-plans">' + items + '</div>');
  });
})();
