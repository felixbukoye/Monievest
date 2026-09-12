-- ============================================================================
-- Monievest — initial schema
--
-- Run this once in your Supabase project:  SQL Editor → New query → paste → Run.
-- It is idempotent, so re-running it is safe.
--
-- Design notes
--   • Every table is keyed by `user_id uuid references auth.users(id)`, and
--     Row Level Security restricts all access to `auth.uid() = user_id`. That
--     is what makes "a user can only see their own stock" true at the database
--     level — not just in the UI. The anon key can be public *because* of this.
--   • `profiles` + `portfolios` are created automatically by a trigger the
--     moment someone signs up, so a new account is immediately usable.
--   • Money is numeric(18,4) and share counts numeric(18,8) to match the
--     app's fractional-share support without floating-point drift.
--   • Timestamps are stored as timestamptz; the app works in epoch millis and
--     converts at the boundary.
-- ============================================================================

-- ---------------------------------------------------------------- extensions
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ profiles
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text not null default 'Investor',
  tier           text not null default 'Monievest Plus',
  account_number text not null,
  created_at     timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user: the display identity shown in the app chrome.';

-- ---------------------------------------------------------------- portfolios
create table if not exists public.portfolios (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  cash          numeric(18, 4) not null default 0,
  realized_pnl  numeric(18, 4) not null default 0,
  state_version int not null default 1,
  updated_at    timestamptz not null default now()
);

comment on table public.portfolios is 'Cash balance and realised P&L. Positions, orders and activity live in their own tables.';

-- ----------------------------------------------------------------- positions
create table if not exists public.positions (
  user_id   uuid not null references auth.users (id) on delete cascade,
  symbol    text not null,
  qty       numeric(18, 8) not null check (qty >= 0),
  avg_cost  numeric(18, 4) not null default 0,
  opened_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create index if not exists positions_user_id_idx on public.positions (user_id);

-- -------------------------------------------------------------------- orders
create table if not exists public.orders (
  id           text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  symbol       text not null,
  side         text not null check (side in ('buy', 'sell')),
  type         text not null check (type in ('market', 'limit')),
  qty          numeric(18, 8) not null,
  limit_price  numeric(18, 4),
  filled_price numeric(18, 4),
  notional     numeric(18, 4) not null default 0,
  status       text not null check (status in ('filled', 'pending', 'cancelled')),
  created_at   timestamptz not null,
  filled_at    timestamptz
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);

-- ------------------------------------------------------------------ activity
create table if not exists public.activity (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null check (type in ('buy', 'sell', 'deposit', 'withdraw', 'cancel', 'dividend', 'fee')),
  symbol     text,
  qty        numeric(18, 8),
  price      numeric(18, 4),
  amount     numeric(18, 4) not null default 0,
  note       text,
  order_id   text,
  created_at timestamptz not null
);

create index if not exists activity_user_created_idx on public.activity (user_id, created_at desc);

comment on table public.activity is 'Append-only cash/share ledger. The app replays it to reconstruct the performance curve.';

-- ----------------------------------------------------------------- watchlist
create table if not exists public.watchlist (
  user_id    uuid not null references auth.users (id) on delete cascade,
  symbol     text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create index if not exists watchlist_user_id_idx on public.watchlist (user_id);

-- ===========================================================================
-- Row Level Security — the actual "users only see their own stock" guarantee
-- ===========================================================================
alter table public.profiles   enable row level security;
alter table public.portfolios enable row level security;
alter table public.positions  enable row level security;
alter table public.orders     enable row level security;
alter table public.activity   enable row level security;
alter table public.watchlist  enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;

create policy "profiles: read own"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- portfolios ----------------------------------------------------------------
drop policy if exists "portfolios: read own"   on public.portfolios;
drop policy if exists "portfolios: insert own" on public.portfolios;
drop policy if exists "portfolios: update own" on public.portfolios;

create policy "portfolios: read own"   on public.portfolios for select using (auth.uid() = user_id);
create policy "portfolios: insert own" on public.portfolios for insert with check (auth.uid() = user_id);
create policy "portfolios: update own" on public.portfolios for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- positions -----------------------------------------------------------------
drop policy if exists "positions: read own"   on public.positions;
drop policy if exists "positions: insert own" on public.positions;
drop policy if exists "positions: update own" on public.positions;
drop policy if exists "positions: delete own" on public.positions;

create policy "positions: read own"   on public.positions for select using (auth.uid() = user_id);
create policy "positions: insert own" on public.positions for insert with check (auth.uid() = user_id);
create policy "positions: update own" on public.positions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "positions: delete own" on public.positions for delete using (auth.uid() = user_id);

-- orders --------------------------------------------------------------------
drop policy if exists "orders: read own"   on public.orders;
drop policy if exists "orders: insert own" on public.orders;
drop policy if exists "orders: update own" on public.orders;
drop policy if exists "orders: delete own" on public.orders;

create policy "orders: read own"   on public.orders for select using (auth.uid() = user_id);
create policy "orders: insert own" on public.orders for insert with check (auth.uid() = user_id);
create policy "orders: update own" on public.orders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "orders: delete own" on public.orders for delete using (auth.uid() = user_id);

-- activity ------------------------------------------------------------------
drop policy if exists "activity: read own"   on public.activity;
drop policy if exists "activity: insert own" on public.activity;
drop policy if exists "activity: delete own" on public.activity;

create policy "activity: read own"   on public.activity for select using (auth.uid() = user_id);
create policy "activity: insert own" on public.activity for insert with check (auth.uid() = user_id);
create policy "activity: delete own" on public.activity for delete using (auth.uid() = user_id);

-- watchlist -----------------------------------------------------------------
drop policy if exists "watchlist: read own"   on public.watchlist;
drop policy if exists "watchlist: insert own" on public.watchlist;
drop policy if exists "watchlist: delete own" on public.watchlist;

create policy "watchlist: read own"   on public.watchlist for select using (auth.uid() = user_id);
create policy "watchlist: insert own" on public.watchlist for insert with check (auth.uid() = user_id);
create policy "watchlist: delete own" on public.watchlist for delete using (auth.uid() = user_id);

-- ===========================================================================
-- New-user bootstrap
-- ===========================================================================
-- Starting demo cash for a brand-new account. This is a simulated brokerage,
-- so accounts are funded on creation — change this number to taste.
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

  insert into public.profiles (id, display_name, account_number)
  values (
    new.id,
    initcap(handle),
    'MV-' || upper(substr(encode(sha256(new.id::text::bytea), 'hex'), 1, 8))
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portfolios_touch_updated_at on public.portfolios;
create trigger portfolios_touch_updated_at
  before update on public.portfolios
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Optional: live sync between tabs/devices.
-- Uncomment to broadcast watchlist + position changes over Supabase Realtime.
-- ===========================================================================
-- alter publication supabase_realtime add table public.watchlist;
-- alter publication supabase_realtime add table public.positions;
