// Настройки проекта Supabase (бесплатный бэкенд: авторизация + база данных).
// Взять значения: supabase.com → ваш проект → Settings → API.
// SUPABASE_ANON_KEY — публичный ключ, его можно спокойно хранить в открытом коде сайта, это не пароль.
// Пока здесь заглушки — регистрация/кабинет покажут "скоро заработает" вместо ошибки.
const SUPABASE_URL = 'https://ВАШ-ПРОЕКТ.supabase.co';
const SUPABASE_ANON_KEY = 'ВСТАВЬТЕ_ANON_KEY';

const SUPABASE_CONFIGURED = SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('ВАШ-ПРОЕКТ');

const supabaseClient = (SUPABASE_CONFIGURED && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
