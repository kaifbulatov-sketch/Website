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
  const link = ROBOKASSA_LINKS[key];

  const disableBtn = (text) => {
    btn.href = '#';
    btn.classList.add('btn--disabled');
    btn.textContent = text;
  };

  if (!link) {
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

  supabaseClient.auth.getSession().then(({ data }) => {
    const session = data.session;
    if (!session) {
      const redirectTo = 'oplata.html?plan=' + key;
      authNote.textContent = 'Нужен аккаунт — сейчас перенаправим на регистрацию/вход…';
      setTimeout(() => {
        location.href = 'index.html?redirect=' + encodeURIComponent(redirectTo) + '#cta';
      }, 1200);
      disableBtn('Сначала вход в аккаунт');
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
      btn.textContent = 'Готовим оплату…';

      const invId = Date.now().toString() + Math.floor(Math.random() * 1000);
      const amount = Number(plan.newPrice.replace(/\D/g, ''));

      const { error } = await supabaseClient.from('purchases').insert({
        user_id: session.user.id,
        plan: key,
        amount,
        invoice_id: invId,
        status: 'pending'
      });

      if (error) {
        btn.textContent = prevText;
        btn.classList.remove('btn--disabled');
        authNote.textContent = 'Не удалось создать заказ, попробуйте ещё раз.';
        return;
      }

      const sep = link.includes('?') ? '&' : '?';
      location.href = link + sep + 'InvId=' + invId;
    });
  });
})();
