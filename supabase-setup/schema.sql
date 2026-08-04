-- Выполнить в Supabase → SQL Editor. Скрипт можно запускать повторно:
-- таблицы создаются через if not exists, политики пересоздаются (create policy
-- сам по себе падает с ошибкой, если политика уже есть, — а README просит
-- перезапустить этот файл после добавления promo_windows).

-- Порядковый номер клиента. Нужен, чтобы в заявках из WhatsApp не путаться:
-- в сообщении приходит «Клиент №7», и по этому же номеру строка ищется в
-- Table Editor. Номер выдаётся автоматически при регистрации (см. триггер ниже)
-- и больше никогда не меняется — в отличие от email, который пользователь
-- может сменить, и от uuid, который нечитаем.
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_no bigint generated always as identity,
  email text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Пользователь видит только свой профиль (свой номер клиента).
drop policy if exists "select own profile" on profiles;
create policy "select own profile"
  on profiles for select
  using (auth.uid() = user_id);

-- Политик insert/update для пользователей нет намеренно: строку создаёт триггер
-- ниже с правами security definer, сам пользователь свой номер выдать или
-- поменять не может.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Выдать номера тем, кто зарегистрировался до появления этой таблицы.
-- Порядок — по дате регистрации, чтобы номера шли в том же порядке, что и люди.
insert into profiles (user_id, email)
select u.id, u.email from auth.users u
  left join profiles p on p.user_id = u.id
  where p.user_id is null
  order by u.created_at;

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  amount numeric not null,
  invoice_id text not null unique,
  status text not null default 'pending', -- pending | paid
  created_at timestamptz not null default now()
);

-- Короткий порядковый номер заказа — по нему заявку и ищут глазами.
-- invoice_id остаётся как есть: он длинный и нечитаемый, но именно он
-- уйдёт в Kaspi, если позже подключится автоматический приём платежей.
alter table purchases add column if not exists order_no bigint generated always as identity;

alter table purchases enable row level security;

-- Пользователь видит только свои покупки.
drop policy if exists "select own purchases" on purchases;
create policy "select own purchases"
  on purchases for select
  using (auth.uid() = user_id);

-- Пользователь может создать (только) свою заявку на оплату со статусом pending.
drop policy if exists "insert own purchases" on purchases;
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
