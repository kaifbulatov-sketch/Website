# Настройка личного кабинета (Supabase)

Всё, что происходит на самом сайте (регистрация, вход, личный кабинет), уже готово и лежит в
[supabase-config.js](../supabase-config.js), [auth.js](../auth.js), [cabinet.js](../cabinet.js),
[payment.js](../payment.js). Ниже — что нужно сделать один раз в самом Supabase, чтобы это заработало.

## 1. Создать проект

1. Зарегистрироваться на [supabase.com](https://supabase.com) (бесплатно, свой аккаунт — этот шаг только вручную).
2. Создать новый проект (New project), выбрать любой регион.
3. Зайти в **Settings → API** — там будут `Project URL` и `anon public` ключ.
4. Вставить их в [supabase-config.js](../supabase-config.js):
   ```js
   const SUPABASE_URL = 'https://xxxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```
   Это публичные значения, их можно спокойно хранить в открытом коде сайта на GitHub — это не пароль.

После этого шага регистрация/вход/личный кабинет на сайте уже заработают (без оплаты пока).

## 2. Создать таблицу purchases

В Supabase → **SQL Editor** — вставить и выполнить содержимое [schema.sql](schema.sql).

## 3. Подключить Robokassa к базе (автоматическая выдача доступа после оплаты)

Это опционально на первое время — без этого шага регистрация и кабинет работают, но статус
оплаты придётся проставлять вручную (см. пункт 4 ниже).

1. Установить Supabase CLI, `supabase login`, `supabase link` к своему проекту.
2. Скопировать папку `robokassa-webhook` в `supabase/functions/robokassa-webhook` в проекте
   (структура, которую ожидает CLI).
3. Задать секрет с "Паролем #2" из настроек Robokassa:
   ```
   supabase secrets set ROBOKASSA_PASSWORD2=ваш_пароль2
   ```
4. Задеплоить:
   ```
   supabase functions deploy robokassa-webhook --no-verify-jwt
   ```
5. Скопировать URL функции (вида `https://xxxxx.supabase.co/functions/v1/robokassa-webhook`)
   и вписать его в Robokassa как **Result URL** в настройках магазина.

Как только это настроено — после реальной оплаты Robokassa сам сообщит об этом функции,
она пометит покупку оплаченной, и материалы появятся в личном кабинете покупателя автоматически.

## 4. Временный ручной вариант (пока не настроен пункт 3)

Пока автоматический вебхук не подключен, после того как увидите оплату (в личном кабинете
Robokassa или на почту), можно вручную зайти в Supabase → **Table Editor → purchases**,
найти нужную строку по `invoice_id` (это число, которое приходило в адресе оплаты как `InvId=`)
и поменять `status` с `pending` на `paid` — доступ в кабинете покупателя откроется сразу.

## Важно про безопасность

- В `supabase-config.js` (публичный код сайта) — только `anon key`, это нормально и безопасно.
- `ROBOKASSA_PASSWORD2` и `service_role key` **никогда** не должны попадать в файлы сайта или
  в публичный GitHub-репозиторий — они живут только как секреты внутри Supabase Edge Function.
