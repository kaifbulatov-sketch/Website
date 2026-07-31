// Supabase Edge Function: принимает уведомление от Kaspi об успешной оплате
// и помечает соответствующую заявку в таблице purchases как оплаченную.
//
// Деплой (Supabase CLI, `supabase login` + `supabase link` уже сделаны):
//   supabase functions deploy kaspi-webhook --no-verify-jwt
//
// Секрет задаётся один раз, значение берётся из кабинета Kaspi после
// подключения Webpay:
//   supabase secrets set KASPI_WEBHOOK_SECRET=выданный_секрет
//
// После деплоя URL функции указывается в кабинете Kaspi как адрес уведомлений
// об оплате — Kaspi будет дёргать его после каждого успешного платежа.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ВНИМАНИЕ — эта функция ещё НЕ ГОТОВА к приёму реальных денег.            │
// │                                                                         │
// │ Kaspi выдаёт точную спецификацию вебхука (имена полей, алгоритм и        │
// │ формат подписи) только после одобрения заявки на подключение Webpay.     │
// │ Выдумывать её нельзя: неверная проверка подписи означает, что кто        │
// │ угодно сможет пометить заказ оплаченным и забрать курс бесплатно.        │
// │                                                                         │
// │ Что сделать перед запуском оплаты (отмечено TODO ниже):                  │
// │  1. Свериться с документацией Kaspi: как называются поля с номером       │
// │     заказа, суммой и подписью.                                          │
// │  2. Реализовать verifySignature() по их алгоритму.                       │
// │  3. Сверить сумму платежа с суммой заказа в БД.                          │
// │  4. Проверить формат ответа, который Kaspi ждёт в теле.                  │
// │                                                                         │
// │ Пока KASPI_WEBHOOK_SECRET не задан, функция отвечает 503 и ничего в БД   │
// │ не меняет — это защита от случайного деплоя в незавершённом виде.        │
// └─────────────────────────────────────────────────────────────────────────┘

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const KASPI_WEBHOOK_SECRET = Deno.env.get('KASPI_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * TODO(kaspi): реализовать по документации Kaspi.
 * Пока всегда возвращает false — намеренно, чтобы недописанная проверка
 * подписи не могла пропустить неподтверждённый платёж.
 */
function verifySignature(_params: Record<string, string>, _raw: string): boolean {
  return false;
}

Deno.serve(async (req) => {
  // Не задан секрет — интеграция ещё не настроена, ничего не трогаем.
  if (!KASPI_WEBHOOK_SECRET) {
    return new Response('kaspi webhook is not configured yet', { status: 503 });
  }

  const raw = req.method === 'POST' ? await req.text() : '';
  let params: Record<string, string>;

  if (req.method === 'POST') {
    // Kaspi может слать как form-urlencoded, так и JSON — разбираем оба.
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      params = JSON.parse(raw || '{}');
    } else {
      params = Object.fromEntries(new URLSearchParams(raw).entries());
    }
  } else {
    params = Object.fromEntries(new URL(req.url).searchParams.entries());
  }

  if (!verifySignature(params, raw)) {
    return new Response('bad signature', { status: 400 });
  }

  // TODO(kaspi): сверить имена полей с документацией.
  const orderId = params.order_id ?? '';
  const paidAmount = Number(params.amount ?? 0);

  if (!orderId) {
    return new Response('missing order id', { status: 400 });
  }

  // Сумма из вебхука должна совпасть с суммой заказа — иначе заказ можно было
  // бы закрыть, заплатив меньше.
  const { data: purchase, error: findError } = await supabase
    .from('purchases')
    .select('amount, status')
    .eq('invoice_id', orderId)
    .single();

  if (findError || !purchase) {
    return new Response('order not found', { status: 404 });
  }

  if (Number(purchase.amount) !== paidAmount) {
    return new Response('amount mismatch', { status: 400 });
  }

  const { error } = await supabase
    .from('purchases')
    .update({ status: 'paid' })
    .eq('invoice_id', orderId);

  if (error) {
    return new Response('db error', { status: 500 });
  }

  // TODO(kaspi): сверить ожидаемый формат ответа — иначе Kaspi будет
  // повторять уведомление, считая его недоставленным.
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
