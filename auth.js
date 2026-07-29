(() => {
  const form = document.getElementById('authForm');
  if (!form) return;

  const emailInput = form.querySelector('input[type="email"]');
  const passInput = form.querySelector('input[type="password"]');
  const submitBtn = document.getElementById('authSubmit');
  const toggleLink = document.getElementById('authToggle');
  const modeLabel = document.getElementById('authModeLabel');
  const msg = document.getElementById('authMsg');
  const card = document.getElementById('authCard');

  let mode = 'signup'; // signup | signin

  const setMsg = (text, isError) => {
    msg.textContent = text || '';
    msg.classList.toggle('auth-msg--error', !!isError);
  };

  const applyMode = () => {
    if (mode === 'signup') {
      submitBtn.textContent = 'Зарегистрироваться';
      modeLabel.textContent = 'Уже есть аккаунт?';
      toggleLink.textContent = 'Войти';
    } else {
      submitBtn.textContent = 'Войти';
      modeLabel.textContent = 'Ещё нет аккаунта?';
      toggleLink.textContent = 'Зарегистрироваться';
    }
    setMsg('');
  };

  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    mode = mode === 'signup' ? 'signin' : 'signup';
    applyMode();
  });

  applyMode();

  if (!SUPABASE_CONFIGURED) {
    setMsg('Личный кабинет скоро заработает — идёт подключение.', false);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      setMsg('Личный кабинет скоро заработает — идёт подключение.', false);
      return;
    }

    const email = emailInput.value.trim();
    const password = passInput.value;
    submitBtn.disabled = true;
    setMsg(mode === 'signup' ? 'Регистрируем…' : 'Входим…', false);

    const redirectParam = new URLSearchParams(location.search).get('redirect');
    const nextUrl = redirectParam ? decodeURIComponent(redirectParam) : 'cabinet.html';

    try {
      if (mode === 'signup') {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          location.href = nextUrl;
        } else {
          setMsg('Проверьте почту — там письмо для подтверждения аккаунта.', false);
        }
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.href = nextUrl;
      }
    } catch (err) {
      setMsg(err.message || 'Что-то пошло не так, попробуйте ещё раз.', true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  if (supabaseClient) {
    supabaseClient.auth.getSession().then(({ data }) => {
      if (data.session && card) {
        const redirectParam = new URLSearchParams(location.search).get('redirect');
        const nextUrl = redirectParam ? decodeURIComponent(redirectParam) : 'cabinet.html';
        card.innerHTML =
          '<p class="lead">Вы уже вошли как ' + data.session.user.email + '.</p>' +
          '<a href="' + nextUrl + '" class="btn btn--fill w100">' +
          (redirectParam ? 'Продолжить оплату' : 'Перейти в личный кабинет') + '</a>';
      }
    });
  }
})();
