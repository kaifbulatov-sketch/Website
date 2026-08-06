(() => {
  const params = new URLSearchParams(location.search);
  const key = PLANS[params.get('plan')] ? params.get('plan') : 'full';
  const plan = PLANS[key];

  document.getElementById('payLabel').textContent = plan.label;
  document.getElementById('payTitle').textContent = plan.title;
  document.getElementById('payDesc').textContent = plan.desc;
  document.getElementById('payPrice').innerHTML =
    '<span class="plan__old mono">' + plan.oldPrice + '</span><span class="plan__new mono">' + plan.newPrice + '</span>';

  const list = document.getElementById('payList');
  plan.items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });

  const btn = document.getElementById('payBtn');
  const consent = document.getElementById('payConsent');
  const authNote = document.getElementById('payAuthNote');

  const disableBtn = (text) => {
    btn.href = '#';
    btn.classList.add('btn--disabled');
    btn.textContent = text;
  };

  // Временная схема: пока не подключён автоматический приём Kaspi Webpay,
  // заявка уходит в WhatsApp вместо редиректа на страницу оплаты Kaspi.
  // KASPI_LINKS/KASPI_ORDER_PARAM из plans-data.js здесь не используются —
  // они остаются для будущего автоматического варианта (см.
  // supabase-setup/README.md).
  if (typeof WHATSAPP_CONFIGURED === 'undefined' || !WHATSAPP_CONFIGURED) {
    disableBtn('Оплата скоро подключится');
    btn.addEventListener('click', (e) => e.preventDefault());
    return;
  }

  if (!SUPABASE_CONFIGURED || !supabaseClient) {
    // Личный кабинет ещё не подключен — оплату не включаем, чтобы не потерять покупку без привязки к аккаунту.
    disableBtn('Скоро: вход + оплата');
    btn.addEventListener('click', (e) => e.preventDefault());
    return;
  }

  // Ссылка на WhatsApp с уже написанным сообщением.
  const toWhatsApp = (text) => {
    location.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text);
  };

  supabaseClient.auth.getSession().then(({ data }) => {
    const session = data.session;

    /* Гость — заявку принимаем сразу, аккаунт не требуем.
       Раньше отсюда человека разворачивало на регистрацию, и до разговора с нами
       он должен был придумать пароль. Для холодного трафика из рекламы это стена:
       он пришёл спросить и заплатить, а не заводить учётную запись на незнакомом
       сайте. Аккаунт нужен нам не чтобы ПРИНЯТЬ заявку, а чтобы ВЫДАТЬ курс, —
       значит он может появиться после оплаты, и порядок шагов был лишним.
       Строку в purchases здесь не создаём: без сессии её запрещает RLS (и это
       правильно — иначе кто угодно писал бы в чужую таблицу). Учётом на этом
       этапе служит само сообщение в WhatsApp, а короткий код заказа даёт то же,
       что и номер: возможность сослаться на конкретную заявку в переписке. */
    if (!session) {
      authNote.textContent = 'Аккаунт заводить не нужно — просто напишите нам, пришлём реквизиты Kaspi. ' +
        'Доступ откроем сразу после оплаты.';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!consent.checked) {
          consent.closest('.consent').classList.add('consent--error');
          return;
        }
        const code = 'G' + Date.now().toString(36).toUpperCase().slice(-5);
        toWhatsApp('Здравствуйте! Хочу оплатить тариф «' + plan.title + '» за ' + plan.newPrice +
          '. Код заказа: ' + code + '.');
      });
      return;
    }

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!consent.checked) {
        consent.closest('.consent').classList.add('consent--error');
        return;
      }
      btn.classList.add('btn--disabled');
      const prevText = btn.textContent;
      btn.textContent = 'Готовим заявку…';

      const invId = Date.now().toString() + Math.floor(Math.random() * 1000);
      const amount = Number(plan.newPrice.replace(/\D/g, ''));

      const { data: created, error } = await supabaseClient.from('purchases').insert({
        user_id: session.user.id,
        plan: key,
        amount,
        invoice_id: invId,
        status: 'pending'
      }).select('order_no').single();

      if (error) {
        btn.textContent = prevText;
        btn.classList.remove('btn--disabled');
        authNote.textContent = 'Не удалось создать заказ, попробуйте ещё раз.';
        return;
      }

      // Номер клиента — постоянный, номер заказа — короткий и растущий.
      // Оба уходят в WhatsApp, чтобы при ручной отметке «оплачено» в Supabase
      // Table Editor (см. supabase-setup/README.md) заявку можно было найти
      // глазами, не сверяя длинный invoice_id и не гадая, чей это email.
      const { data: profile } = await supabaseClient
        .from('profiles').select('client_no').eq('user_id', session.user.id).single();

      const parts = ['Здравствуйте! Хочу оплатить тариф «' + plan.title + '» за ' + plan.newPrice + '.'];
      if (profile && profile.client_no) parts.push('Клиент №' + profile.client_no + '.');
      if (created && created.order_no) parts.push('Заказ №' + created.order_no + '.');
      parts.push('Мой email в личном кабинете: ' + session.user.email);
      toWhatsApp(parts.join(' '));
    });
  });
})();
