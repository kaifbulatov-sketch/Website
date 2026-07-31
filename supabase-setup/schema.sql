-- Выполнить один раз в Supabase → SQL Editor.

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  amount numeric not null,
  invoice_id text not null unique,
  status text not null default 'pending', -- pending | paid
  created_at timestamptz not null default now()
);

alter table purchases enable row level security;

-- Пользователь видит только свои покупки.
create policy "select own purchases"
  on purchases for select
  using (auth.uid() = user_id);

-- Пользователь может создать (только) свою заявку на оплату со статусом pending.
create policy "insert own purchases"
  on purchases for insert
  with check (auth.uid() = user_id and status = 'pending');

-- Обновлять status на 'paid' может только сервисная роль (Edge Function с service_role key),
-- обычные пользователи такого права не получают — политики update нет намеренно.

-- Таймер акции -50%: у каждого IP — своё настоящее окно в 24 часа с первого визита.
-- Строка создаётся один раз (см. promo-timer Edge Function) и больше не трогается,
-- поэтому обновление страницы или повторный заход с того же IP не продлевают и не сбрасывают время.
create table if not exists promo_windows (
  ip text primary key,
  deadline timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

alter table promo_windows enable row level security;
-- Политик для anon/authenticated нет специально — таблицу читает и пишет только
-- promo-timer Edge Function через service_role key (обходит RLS).
