// Supabase Edge Function: принимает уведомление от Robokassa об успешной оплате
// и помечает соответствующую заявку в таблице purchases как оплаченную.
//
// Деплой (когда будет установлен Supabase CLI и сделан `supabase login` + `supabase link`):
//   supabase functions deploy robokassa-webhook --no-verify-jwt
//
// Секрет, который нужно задать самостоятельно (Robokassa даёт его в настройках техпараметров,
// это "Пароль #2" — не тот, что используется при формировании ссылки на оплату):
//   supabase secrets set ROBOKASSA_PASSWORD2=ваш_пароль2
//
// После деплоя скопировать URL функции и указать его в Robokassa как "Result URL" (ResultURL2)
// в настройках магазина — Robokassa будет дёргать этот адрес после каждой успешной оплаты.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import md5 from 'https://esm.sh/md5@2.3.0';

const ROBOKASSA_PASSWORD2 = Deno.env.get('ROBOKASSA_PASSWORD2') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  let params: Record<string, string>;

  if (req.method === 'POST') {
    const form = await req.formData();
    params = Object.fromEntries(form.entries()) as Record<string, string>;
  } else {
    params = Object.fromEntries(new URL(req.url).searchParams.entries());
  }

  const outSum = params.OutSum ?? '';
  const invId = params.InvId ?? '';
  const signature = params.SignatureValue ?? '';

  const expected = md5(`${outSum}:${invId}:${ROBOKASSA_PASSWORD2}`);

  if (expected.toLowerCase() !== signature.toLowerCase()) {
    return new Response('bad signature', { status: 400 });
  }

  const { error } = await supabase
    .from('purchases')
    .update({ status: 'paid' })
    .eq('invoice_id', invId);

  if (error) {
    return new Response('db error', { status: 500 });
  }

  // Robokassa ожидает именно такой ответ в теле — иначе будет повторять уведомление.
  return new Response(`OK${invId}`, { status: 200 });
});
