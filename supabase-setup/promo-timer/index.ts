// Supabase Edge Function: выдаёт настоящий дедлайн акции -50% для конкретного IP.
// Первый визит с IP — заводит окно в 24 часа (deadline = now()+24h) и запоминает его в БД.
// Любой следующий запрос с того же IP получает ТОТ ЖЕ дедлайн — обновление страницы или
// повторный заход не продлевают и не обнуляют оставшееся время. По истечении 24 часов
// сайт (script.js) сам переключает цену на обычную — таймер не фейковый, скидка правда кончается.
//
// Деплой (Supabase CLI, `supabase login` + `supabase link` уже сделаны):
//   supabase functions deploy promo-timer --no-verify-jwt
//
// Секретов не требует — использует стандартные SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY,
// которые Supabase сам прокидывает в каждую Edge Function.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';

  // ON CONFLICT DO NOTHING на уровне БД (через upsert+ignoreDuplicates) — атомарно:
  // при двух одновременных первых запросах с одного IP дедлайн не задвоится и не перезапишется.
  const { error: upsertError } = await supabase
    .from('promo_windows')
    .upsert({ ip }, { onConflict: 'ip', ignoreDuplicates: true });

  if (upsertError) {
    return new Response(JSON.stringify({ error: 'db error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await supabase
    .from('promo_windows')
    .select('deadline')
    .eq('ip', ip)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ deadline: data.deadline }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
