-- ============================================================================
-- Monievest — admin dashboard schema
--
-- Run this AFTER 0001_init.sql:  SQL Editor → New query → paste → Run.
-- It is idempotent, so re-running it is safe.
--
-- What this adds
--   • `profiles.role`   — 'user' | 'admin'. Admins see the admin dashboard.
--   • `profiles.status` — 'active' | 'disabled'. Lets you block a spam or
--                         abusive account; disabled users are signed out.
--   • `profiles.email`  — denormalised from auth.users so the admin UI can
--                         show it (RLS on auth.users is not readable).
--   • `public.feedback` — bug reports / feedback from users, replyable by
--                         admins (the Support tab).
--   • `public.demo_stocks` — admin-managed stock universe: add new demo
--                         stocks, edit their reference price, or disable
--                         built-in catalog stocks.
--   • `public.is_admin()` + admin read policies on the per-user tables, so
--                         the admin dashboard can aggregate across users while
--                         ordinary users still only ever see their own rows.
--
-- How to make someone an admin (run in the SQL Editor):
--
--   update public.profiles
--      set role = 'admin'
--    where id = '<USER_ID>';                    -- from Authentication → Users
--
--   -- or by email:
--   update public.profiles p
--      set role = 'admin'
--     from auth.users u
--    where p.id = u.id
--      and lower(u.email) = lower('you@example.com');
-- ============================================================================

-- ------------------------------------------------------- profiles: new cols
alter table public.profiles
  add column if not exists role text not null default 'user' check (role in ('user', 'admin'));

alter table public.profiles
  add column if not exists status text not null default 'active' check (status in ('active', 'disabled'));

alter table public.profiles
  add column if not exists email text;

-- Backfill emails for accounts created before this migration.
update public.profiles p
   set email = lower(u.email)
  from auth.users u
 where p.id = u.id
   and p.email is null;

-- ---------------------------------------------------------------- is_admin()
-- Security-definer so it can answer the question without the caller needing
-- read access to anyone else's profile row. STABLE lets Postgres cache it
-- inside a single query.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and role = 'admin'
  );
$$;

-- ------------------------------------------------------- guard admin fields
-- The original "profiles: update own" policy lets any user update their own
-- row — including the new columns. This trigger closes that hole: only an
-- admin may change `role` or `status`.
create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Only an admin can change role or status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_fields on public.profiles;
create trigger profiles_protect_admin_fields
  before update on public.profiles
  for each row execute function public.protect_profile_admin_fields();

-- ------------------------------------------- bootstrap: also store the email
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  starting_cash numeric(18, 4) := 25000;
  handle        text;
begin
  handle := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Investor'
  );

  insert into public.profiles (id, display_name, account_number, email)
  values (
    new.id,
    initcap(handle),
    'MV-' || upper(substr(encode(sha256(new.id::text::bytea), 'hex'), 1, 8)),
    lower(new.email)
  )
  on conflict (id) do nothing;

  insert into public.portfolios (user_id, cash, realized_pnl, state_version)
  values (new.id, starting_cash, 0, 1)
  on conflict (user_id) do nothing;

  insert into public.activity (id, user_id, type, amount, note, created_at)
  values (
    'act_signup_' || new.id::text,
    new.id,
    'deposit',
    starting_cash,
    'Welcome bonus — demo cash credited on sign-up',
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ------------------------------------------------------------------ feedback
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email       text,
  category    text not null default 'feedback' check (category in ('feedback', 'bug', 'feature')),
  message     text not null check (char_length(trim(message)) between 1 and 4000),
  status      text not null default 'open' check (status in ('open', 'replied', 'closed')),
  admin_reply text,
  replied_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);
create index if not exists feedback_user_id_idx on public.feedback (user_id);

comment on table public.feedback is 'Bug reports and feedback submitted from the Support page. Admins reply from the admin dashboard.';

-- --------------------------------------------------------------- demo_stocks
-- Admin-managed stock universe.
--   • source = 'custom'  → a stock the admin added; tradable while enabled.
--   • source = 'catalog' → an override for a built-in catalog stock; used to
--                          disable it (enabled = false) or tweak its price.
create table if not exists public.demo_stocks (
  symbol          text primary key check (symbol ~ '^[A-Z][A-Z0-9.\-]{0,9}$'),
  name            text not null check (char_length(trim(name)) between 1 and 120),
  kind            text not null default 'stock' check (kind in ('stock', 'etf')),
  sector          text not null default 'Technology',
  reference_price numeric(18, 4) not null check (reference_price > 0),
  source          text not null default 'custom' check (source in ('custom', 'catalog')),
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.demo_stocks is 'Admin-curated demo stock universe: added stocks and overrides for the built-in catalog.';

drop trigger if exists demo_stocks_touch_updated_at on public.demo_stocks;
create trigger demo_stocks_touch_updated_at
  before update on public.demo_stocks
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Row Level Security — admin additions
-- ===========================================================================
alter table public.feedback    enable row level security;
alter table public.demo_stocks enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists "profiles: admin read all"  on public.profiles;
drop policy if exists "profiles: admin update all" on public.profiles;

create policy "profiles: admin read all"   on public.profiles for select using (public.is_admin());
create policy "profiles: admin update all" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- Cross-user read access for the admin dashboard ----------------------------
drop policy if exists "portfolios: admin read all" on public.portfolios;
drop policy if exists "positions: admin read all"  on public.positions;
drop policy if exists "orders: admin read all"     on public.orders;
drop policy if exists "activity: admin read all"   on public.activity;
drop policy if exists "watchlist: admin read all"  on public.watchlist;

create policy "portfolios: admin read all" on public.portfolios for select using (public.is_admin());
create policy "positions: admin read all"  on public.positions  for select using (public.is_admin());
create policy "orders: admin read all"     on public.orders     for select using (public.is_admin());
create policy "activity: admin read all"   on public.activity   for select using (public.is_admin());
create policy "watchlist: admin read all"  on public.watchlist  for select using (public.is_admin());

-- feedback ------------------------------------------------------------------
drop policy if exists "feedback: read own"        on public.feedback;
drop policy if exists "feedback: insert own"      on public.feedback;
drop policy if exists "feedback: admin read all"   on public.feedback;
drop policy if exists "feedback: admin update all" on public.feedback;
drop policy if exists "feedback: admin delete all" on public.feedback;

create policy "feedback: read own"   on public.feedback for select using (auth.uid() = user_id);
create policy "feedback: insert own" on public.feedback for insert with check (auth.uid() = user_id);
create policy "feedback: admin read all"   on public.feedback for select using (public.is_admin());
create policy "feedback: admin update all" on public.feedback
  for update using (public.is_admin()) with check (public.is_admin());
create policy "feedback: admin delete all" on public.feedback for delete using (public.is_admin());

-- demo_stocks ---------------------------------------------------------------
-- Every signed-in user can read the universe (the app needs it to build the
-- tradable board); only admins may change it.
drop policy if exists "demo_stocks: read authenticated" on public.demo_stocks;
drop policy if exists "demo_stocks: admin insert"       on public.demo_stocks;
drop policy if exists "demo_stocks: admin update"       on public.demo_stocks;
drop policy if exists "demo_stocks: admin delete"       on public.demo_stocks;

create policy "demo_stocks: read authenticated" on public.demo_stocks
  for select using (auth.role() = 'authenticated');
create policy "demo_stocks: admin insert" on public.demo_stocks
  for insert with check (public.is_admin());
create policy "demo_stocks: admin update" on public.demo_stocks
  for update using (public.is_admin()) with check (public.is_admin());
create policy "demo_stocks: admin delete" on public.demo_stocks
  for delete using (public.is_admin());
