-- ============================================================================
-- Monievest — notifications (the bell in the top bar)
--
-- Run this AFTER 0001_init.sql and 0002_admin.sql:
--   SQL Editor → New query → paste → Run.
-- It is idempotent, so re-running it is safe.
--
-- What this adds
--   • `public.notifications` — one inbox with two audiences:
--       audience = 'user'  → the investor's own bell (fills, funding, replies
--                            from support, account changes).
--       audience = 'admin' → the admin console bell (new sign-ups, incoming
--                            feedback): platform events, visible to admins only.
--   • Triggers that write those rows for you — nothing in the app has to
--     remember to notify anyone:
--       – new account            → admin: "New investor joined"
--                                  user:  "Welcome to Monievest"
--       – feedback submitted     → admin: "New bug report / feedback"
--       – admin replies / closes → user:  "Support replied to your message"
--       – account disabled or
--         role changed           → user:  "Your account was disabled", …
--   • Row Level Security, so a user only ever reads their own rows and only an
--     admin can read the admin feed.
--
-- Read state: `read_at` is used for a user's own rows. Admin rows are shared
-- platform events — one admin clearing the bell must not clear it for the
-- next — so the app keeps admin read state per browser and admin rows are
-- deliberately not updatable through the API.
--
-- Optional housekeeping (nothing schedules this for you):
--   select public.prune_notifications();            -- drops rows older than 90d
--   select public.prune_notifications(interval '30 days');
-- ============================================================================

-- ------------------------------------------------------------------- table
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  -- Who the event is about. For audience = 'admin' this is the subject of the
  -- event (the new account, the person who wrote the feedback), not the reader.
  user_id    uuid not null references auth.users (id) on delete cascade,
  audience   text not null default 'user' check (audience in ('user', 'admin')),
  kind       text not null default 'info' check (kind in ('info', 'success', 'warning', 'alert')),
  title      text not null check (char_length(trim(title)) between 1 and 160),
  body       text check (body is null or char_length(trim(body)) <= 600),
  /** In-app destination the bell navigates to, e.g. '/app/admin?tab=support'. */
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notifications. audience = ''user'' rows belong to one account; audience = ''admin'' rows are platform events shown in the admin console bell.';

create index if not exists notifications_user_audience_created_idx
  on public.notifications (user_id, audience, created_at desc);
create index if not exists notifications_audience_created_idx
  on public.notifications (audience, created_at desc);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.notifications enable row level security;

-- A user reads, writes and clears their own investor notifications ----------
drop policy if exists "notifications: read own"   on public.notifications;
drop policy if exists "notifications: insert own" on public.notifications;
drop policy if exists "notifications: update own" on public.notifications;
drop policy if exists "notifications: delete own" on public.notifications;

create policy "notifications: read own" on public.notifications
  for select using (audience = 'user' and auth.uid() = user_id);

-- Lets the app record what just happened to your portfolio (an order filled,
-- a deposit landed). You can only ever insert rows addressed to yourself.
create policy "notifications: insert own" on public.notifications
  for insert with check (audience = 'user' and auth.uid() = user_id);

create policy "notifications: update own" on public.notifications
  for update using (audience = 'user' and auth.uid() = user_id)
  with check (audience = 'user' and auth.uid() = user_id);

create policy "notifications: delete own" on public.notifications
  for delete using (audience = 'user' and auth.uid() = user_id);

-- The admin feed -----------------------------------------------------------
drop policy if exists "notifications: admin read all"   on public.notifications;
drop policy if exists "notifications: admin insert any" on public.notifications;
drop policy if exists "notifications: admin delete any" on public.notifications;

create policy "notifications: admin read all" on public.notifications
  for select using (audience = 'admin' and public.is_admin());

-- Admins may write notifications for anyone (e.g. a broadcast from the
-- console). There is deliberately no admin *update* policy: admin read state
-- lives in the browser, so no client can mark the shared feed read for
-- everybody else.
create policy "notifications: admin insert any" on public.notifications
  for insert with check (public.is_admin());

create policy "notifications: admin delete any" on public.notifications
  for delete using (public.is_admin());

-- ===========================================================================
-- Triggers — the events that raise a notification
--
-- All are `security definer`: they run as the table owner and therefore write
-- through RLS, which is what lets a new sign-up notify the admins and an
-- admin's reply notify the user.
-- ===========================================================================

-- ------------------------------------------------- sign-up: welcome + admins
-- Redefines the bootstrap trigger from 0002_admin.sql, unchanged apart from
-- the two notification inserts at the end.
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

  -- The deterministic ids make every insert idempotent: a retried trigger can
  -- never produce a duplicate row.
  insert into public.notifications (id, user_id, audience, kind, title, body, href, created_at)
  values (
    md5('ntf_welcome_' || new.id::text)::uuid,
    new.id,
    'user',
    'success',
    'Welcome to Monievest',
    'Your demo account is ready with $' || to_char(starting_cash, 'FM999,999') || ' of simulated cash.',
    '/app',
    now()
  )
  on conflict (id) do nothing;

  insert into public.notifications (id, user_id, audience, kind, title, body, href, created_at)
  values (
    md5('ntf_signup_' || new.id::text)::uuid,
    new.id,
    'admin',
    'info',
    'New investor joined',
    initcap(handle) || ' (' || lower(coalesce(new.email, 'no email')) || ') created an account.',
    '/app/admin?tab=users',
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- -------------------------------------------------- feedback: tell the admins
create or replace function public.notify_admin_of_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (id, user_id, audience, kind, title, body, href, created_at)
  values (
    md5('ntf_feedback_' || new.id::text)::uuid,
    new.user_id,
    'admin',
    case new.category when 'bug' then 'alert' else 'info' end,
    case new.category
      when 'bug'     then 'New bug report'
      when 'feature' then 'New feature request'
      else                'New feedback'
    end,
    left(coalesce(new.email, 'A user') || ': ' || new.message, 600),
    '/app/admin?tab=support',
    coalesce(new.created_at, now())
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists feedback_notify_admin on public.feedback;
create trigger feedback_notify_admin
  after insert on public.feedback
  for each row execute function public.notify_admin_of_feedback();

-- ------------------------------------------------ feedback: tell the reporter
create or replace function public.notify_user_of_feedback_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- An admin wrote (or rewrote) a reply.
  if new.admin_reply is not null
     and new.admin_reply is distinct from old.admin_reply then
    insert into public.notifications (id, user_id, audience, kind, title, body, href, created_at)
    values (
      md5('ntf_reply_' || new.id::text || coalesce(new.replied_at::text, ''))::uuid,
      new.user_id,
      'user',
      'info',
      'Support replied to your message',
      left(new.admin_reply, 600),
      '/app/feedback',
      coalesce(new.replied_at, now())
    )
    on conflict (id) do nothing;
  end if;

  -- The ticket was closed. One notification per ticket, however often it is
  -- reopened and closed again.
  if new.status = 'closed' and old.status is distinct from 'closed' then
    insert into public.notifications (id, user_id, audience, kind, title, body, href, created_at)
    values (
      md5('ntf_closed_' || new.id::text)::uuid,
      new.user_id,
      'user',
      'success',
      'Your support ticket was closed',
      'An administrator marked your report as resolved. Reply from the Support page to reopen it.',
      '/app/feedback',
      now()
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists feedback_notify_user on public.feedback;
create trigger feedback_notify_user
  after update on public.feedback
  for each row execute function public.notify_user_of_feedback_change();

-- ------------------------------------------- profiles: status / role changes
create or replace function public.notify_user_of_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (id, user_id, audience, kind, title, body, href, created_at)
    values (
      md5('ntf_status_' || new.id::text || new.status)::uuid,
      new.id,
      'user',
      case when new.status = 'disabled' then 'alert' else 'success' end,
      case when new.status = 'disabled' then 'Your account was disabled'
           else                              'Your account was re-enabled' end,
      case when new.status = 'disabled'
        then 'An administrator disabled this account, so sign-in is blocked until it is re-enabled.'
        else 'You can sign in and use Monievest again.' end,
      '/app',
      now()
    )
    on conflict (id) do nothing;
  end if;

  if new.role is distinct from old.role then
    insert into public.notifications (id, user_id, audience, kind, title, body, href, created_at)
    values (
      md5('ntf_role_' || new.id::text || new.role)::uuid,
      new.id,
      'user',
      'info',
      case when new.role = 'admin' then 'You are now an administrator'
           else                         'Administrator access removed' end,
      case when new.role = 'admin'
        then 'The admin console is in your menu now — users, trading oversight, the stock universe and the support inbox. Trading and the wallet are switched off on admin accounts.'
        else 'Your account no longer has access to the admin console.' end,
      case when new.role = 'admin' then '/app/admin' else '/app' end,
      now()
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- After the `protect_profile_admin_fields` guard from 0002_admin.sql: only an
-- admin (or direct SQL) can change role/status, so only they can raise these.
drop trigger if exists profiles_notify_change on public.profiles;
create trigger profiles_notify_change
  after update on public.profiles
  for each row execute function public.notify_user_of_profile_change();

-- ---------------------------------------------------------------- retention
create or replace function public.prune_notifications(older_than interval default interval '90 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.notifications where created_at < now() - older_than;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.prune_notifications(interval) is
  'Deletes notifications older than the given interval and returns how many went. Run it by hand (or from a pg_cron job).';

-- ===========================================================================
-- Backfill — so the bell is not empty the first time it is opened
--
-- Deterministic ids (md5 of the source row) mean these never duplicate what
-- the triggers above have already written, and re-running is a no-op.
-- ===========================================================================

-- Admins: one row per account that already exists.
insert into public.notifications (id, user_id, audience, kind, title, body, href, created_at)
select md5('ntf_signup_' || p.id::text)::uuid,
       p.id,
       'admin',
       'info',
       'New investor joined',
       coalesce(initcap(p.display_name), 'An account') || ' (' || coalesce(p.email, 'no email') || ') created an account.',
       '/app/admin?tab=users',
       coalesce(p.created_at, now())
  from public.profiles p
on conflict (id) do nothing;

-- Users: the welcome note, for accounts created before this migration.
insert into public.notifications (id, user_id, audience, kind, title, body, href, created_at)
select md5('ntf_welcome_' || p.id::text)::uuid,
       p.id,
       'user',
       'success',
       'Welcome to Monievest',
       'Your demo account is ready with $25,000 of simulated cash.',
       '/app',
       coalesce(p.created_at, now())
  from public.profiles p
on conflict (id) do nothing;

-- Users: replies an admin already wrote.
insert into public.notifications (id, user_id, audience, kind, title, body, href, created_at)
select md5('ntf_reply_' || f.id::text || coalesce(f.replied_at::text, ''))::uuid,
       f.user_id,
       'user',
       'info',
       'Support replied to your message',
       left(f.admin_reply, 600),
       '/app/feedback',
       coalesce(f.replied_at, f.created_at)
  from public.feedback f
 where f.admin_reply is not null
on conflict (id) do nothing;
