// Настройки проекта Supabase (бесплатный бэкенд: авторизация + база данных).
// Взять значения: supabase.com → ваш проект → Settings → API Keys.
//
// SUPABASE_ANON_KEY — публикуемый (publishable) ключ. Его можно спокойно держать
// в открытом коде сайта на GitHub: это не пароль, он лишь позволяет обратиться к
// API проекта, а что именно этому обращению разрешено — решают политики RLS в
// базе (см. supabase-setup/schema.sql). Secret-ключ (sb_secret_…) сюда попадать
// не должен никогда — он обходит RLS и даёт полный доступ к данным.
const SUPABASE_URL = 'https://cenjaxfrfabvrqyiyvcb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_k2OcQN5P0VqhDnqf-aF7xg__xtMFSF_';

const SUPABASE_CONFIGURED = SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('ВАШ-ПРОЕКТ');

const supabaseClient = (SUPABASE_CONFIGURED && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
