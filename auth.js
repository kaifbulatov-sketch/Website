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

  /* Supabase отвечает по-английски: «Invalid login credentials» и т.п. Показывать
     это покупателю нельзя — на сайте всё на русском, человек пришёл из рекламы и
     на английской ошибке просто уходит, решив, что сайт сломан. Переводим в текст,
     который говорит не «что случилось», а «что теперь делать». */
  function ruError(err) {
    const raw = String((err && err.message) || '');
    const m = raw.toLowerCase();
    if (m.includes('invalid login credentials')) {
      return 'Неверный email или пароль. Если аккаунта ещё нет — нажмите «Зарегистрироваться», если забыли пароль — «Забыли пароль?».';
    }
    if (m.includes('user already registered') || m.includes('already been registered')) {
      return 'На этот email аккаунт уже есть — нажмите «Войти».';
    }
    if (m.includes('password should be at least')) {
      return 'Пароль слишком короткий — нужно минимум 6 символов.';
    }
    if (m.includes('unable to validate email') || m.includes('invalid email')) {
      return 'Email указан с ошибкой — проверьте адрес.';
    }
    if (m.includes('email rate limit') || m.includes('over_email_send_rate_limit') || m.includes('too many requests') || m.includes('rate limit')) {
      return 'Слишком много писем за короткое время. Подождите час или напишите нам в WhatsApp — откроем доступ вручную.';
    }
    if (m.includes('email not confirmed')) {
      return 'Почта не подтверждена. Напишите нам в WhatsApp — подтвердим вручную.';
    }
    if (m.includes('failed to fetch') || m.includes('networkerror')) {
      return 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
    }
    return raw || 'Что-то пошло не так, попробуйте ещё раз.';
  }

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

        /* Supabase намеренно не говорит прямо «такой email уже есть» — иначе по
           форме регистрации можно было бы перебором узнать, кто у нас купил курс.
           Вместо ошибки он возвращает «успех» с пустым identities. Отличить это
           можно только так, и отличать обязательно: иначе человек, который просто
           забыл, что уже регистрировался, видел бы предложение проверить почту —
           а письмо не придёт никогда, потому что подтверждение почты отключено. */
        const alreadyRegistered = data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
        if (alreadyRegistered) {
          mode = 'signin';
          applyMode();
          setMsg('На этот email аккаунт уже есть. Введите пароль и нажмите «Войти» — или нажмите «Забыли пароль?».', true);
          return;
        }

        if (data.session) {
          // Сообщаем рекламным площадкам о регистрации до ухода со страницы:
          // по этому событию они и учатся находить похожую аудиторию.
          // neuraTrack появляется только когда пиксель настроен (см. analytics.js),
          // поэтому проверяем — иначе без пикселя здесь была бы ошибка и человек
          // застрял бы на форме вместо перехода в кабинет.
          if (typeof window.neuraTrack === 'function') window.neuraTrack('CompleteRegistration');
          location.href = nextUrl;
        } else {
          setMsg('Аккаунт создан. Нажмите «Войти» с этим же паролем.', false);
          mode = 'signin';
          applyMode();
        }
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.href = nextUrl;
      }
    } catch (err) {
      /* Если оказалось, что аккаунт уже есть, — сами переводим форму в режим
         входа. Иначе подсказка «нажмите Войти» висит над кнопкой, на которой
         написано «Зарегистрироваться», и человек жмёт её снова по кругу. */
      const already = /already.*regist/i.test(String((err && err.message) || ''));
      const text = ruError(err);
      if (already && mode === 'signup') { mode = 'signin'; applyMode(); }
      setMsg(text, true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* Восстановление пароля. Без него единственным выходом для забывшего пароль
     был бы новый email — а к нему привязана покупка, и человек потерял бы доступ
     к оплаченному курсу. */
  const resetLink = document.getElementById('authReset');
  if (resetLink) {
    resetLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      if (!email) { setMsg('Впишите email в поле выше — на него придёт ссылка для смены пароля.', true); return; }
      if (!supabaseClient) { setMsg('Личный кабинет скоро заработает — идёт подключение.', false); return; }
      setMsg('Отправляем письмо…', false);
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + '/cabinet.html'
      });
      setMsg(error ? ruError(error)
        : 'Письмо со ссылкой отправлено на ' + email + '. Если его нет — проверьте «Спам».', !!error);
    });
  }

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
