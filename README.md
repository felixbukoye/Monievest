# Monievest

**Invest in stocks. Build real wealth.**

Monievest is a modern investment web app: buy and sell stocks and ETFs, build a diversified
portfolio, track performance against the market, and manage your cash — all in a soft, rounded
light interface (light-grey canvas, white cards, violet accent) with a complete dark theme.

> ⚠️ **Demo product.** Every price, quote, fill, dividend, headline and balance is **simulated
> locally in your browser**. There is no broker, no exchange connection and no real money.
> Nothing here is investment advice.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

No API keys, no database, no sign-up required. The demo account arrives pre-funded with cash and a
populated portfolio so everything is meaningful on first load. (Optionally add a market-data key to
run on live prices instead of the simulator — see [Configuration](#configuration-api-keys).)

```bash
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint (flat config, next/core-web-vitals + typescript)
npm run typecheck
```

### Running it on your own computer

1. **Install Node.js 20.9 or newer** (LTS is fine) from [nodejs.org](https://nodejs.org), then check
   with `node -v`.
2. **Get the code.** With Git:

   ```bash
   git clone https://github.com/felixbukoye/Monievest.git
   cd Monievest
   git checkout arena/01a09298-monievest
   ```

   Without Git: download the branch as a ZIP —
   <https://github.com/felixbukoye/Monievest/archive/refs/heads/arena/01a09298-monievest.zip> —
   unzip it and open that folder in a terminal.
3. **Install dependencies:** `npm install`
4. **Create your env file.** It is git-ignored, so your key never leaves your machine.

   ```bash
   cp .env.example .env.local              # macOS / Linux
   Copy-Item .env.example .env.local       # Windows PowerShell
   ```

5. **Open `.env.local` in a plain-text editor** (VS Code, Notepad, or TextEdit in plain-text mode)
   and fill in two lines:

   ```bash
   MARKET_DATA_PROVIDER="finnhub"
   FINNHUB_API_KEY="your_key_here"
   ```

6. **Run it:** `npm run dev` → <http://localhost:3000>

Leave the key lines blank and Monievest runs entirely on the local simulator — nothing breaks.

## Stack

| Layer      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack)                                |
| Language   | TypeScript (strict)                                               |
| UI         | React 19, Tailwind CSS v4, shadcn/ui-style components on Radix UI |
| Charts     | Recharts 3 + hand-rolled SVG sparklines                           |
| Theming    | next-themes (class strategy, no flash on load)                    |
| Fonts      | Geist Sans / Geist Mono, self-hosted via the `geist` package      |
| State      | `useReducer` + React context, persisted per user                  |
| Backend    | Supabase (Postgres + RLS, email/password auth) — optional         |
| Auth       | `@supabase/ssr` cookie sessions, guarded by `src/proxy.ts`        |
| Market     | Local deterministic simulator (seeded PRNG + Brownian bridges)    |
| Toasts     | sonner                                                            |

## Features

**Dashboard**

- Horizontally scrolling stock rail: circular brand tiles, live price and the move **vs last month**
- **Portfolio Values** card — total value, return chip, a plain-English profit sentence, a
  Today / Invested / Cash strip, and **Worst / Top Performance** pills that re-scope the chart,
  plus a data-driven tip banner
- **Statistics** card — rose area chart over the last month (compact `k` axis, dashed marker and a
  value pill on the latest point). It plots the whole portfolio, or the strongest / weakest holding
- **My Stock** table — sortable by name, invest date, volume, change and price, with sparklines and
  inline buy / sell actions
- Portfolio performance vs the S&P 500, sector allocation donut, live market movers, resting
  orders, watchlist, index snapshot and recent activity

**Trading**

- Market orders (instant fill) and limit orders that rest on the book and **auto-fill** the moment
  the simulated price crosses your level
- Fractional shares, quick-allocation buttons (25 / 50 / 75 / Max)
- Pre-flight validation: buying power and share availability are checked before an order is placed
- Order ticket available globally (`⌘K` → pick an instrument, or the **Trade** button) and inline
  on every stock page
- Cancel resting orders; voided orders are logged with a reason

**Portfolio**

- Live total value, day P&L, unrealised and realised returns, buying power
- Reconstructed performance curve (the cash + share ledger is replayed against simulated history)
  with an S&P 500 benchmark overlay
- Allocation donut by sector or by holding, concentration warnings, best/worst performer
- Full holdings table with sparklines, weight bars and one-click buy/sell
- CSV export of positions and summary

**Markets**

- 44 instruments (large-cap stocks + index/thematic ETFs) across 12 sectors
- Filter by search, sector and type; sort by symbol, price, change, market cap, volume or yield
  (clickable headers + select)
- Gainers / losers / most-active boards, index snapshot (the scrolling ticker tape runs on the
  landing page)
- Stock detail page: 1D–5Y charts (area or line, optional volume), day and 52-week range bars,
  full statistics, simulated news, peer comparison and your position history

**Account**

- Wallet with deposits, withdrawals, funding methods and reserved-by-open-orders buying power
- Activity log with filters (trades, cash, orders) and JSON export
- Watchlist with live cards and suggestions
- Settings: theme, live ticking, limit auto-fill, compact tables, default chart range, profile,
  data export and demo reset
- `⌘K` / `Ctrl+K` command-palette search across every instrument
- Multi-tab sync — trade in one tab, watch the others update

**Accounts (optional — needs the Supabase env vars)**

- Email + password sign-up and sign-in on `/signup` and `/login`, with friendly error copy
- `/app/*` is protected: signed-out visitors are bounced to `/login?next=…` and returned afterwards
- Your watchlist, positions, orders, cash and activity persist in Postgres and follow you to any
  device; a live **Sync** indicator in the account menu reports saving / saved / failed
- Strict per-user isolation enforced by Row Level Security (`auth.uid() = user_id`) in the database
- **Reset account** wipes your rows server-side and re-credits the $25,000 starting cash
- **Support** page (`/app/feedback`) — send bug reports and feedback, see team replies
- Without the env vars the app is unchanged: a local demo portfolio, open to everyone

**Admin (optional — needs Supabase + the admin role)**

- Accounts with `profiles.role = 'admin'` land on the **admin dashboard** instead of their personal
  one, and carry an **Admin** badge in the chrome
- User management: name / email / sign-up date / wallet balance per user, plus active / disabled
  status to block a spam or abusive account
- Demo trading activity: every order across all users, and portfolio value per user with anomaly
  flags (negative balances and other impossible data)
- Stock universe: add / edit / remove tradable demo stocks, disable built-ins, and check where
  price data is coming from and whether it's updating
- Analytics: total sign-ups, total demo trades, most-traded stocks and a 14-day sign-up chart
- Support inbox: reply to feedback and bug reports from the in-app Support page
- Promoted via one SQL statement in Supabase (see [Admin dashboard](#admin-dashboard)); every admin
  query is locked down by admin-only RLS policies in the database

**Theming**

- Light-first palette: `#f2f2f5` canvas, white cards with hairline borders and a soft shadow,
  20 px radii, violet `#8b5cf6` brand, emerald gains / rose losses, rose statistics chart
- A complete dark theme, not an inversion: every surface, chart, table, toast and tooltip is
  driven by CSS custom properties in `src/app/globals.css`
- Light / dark / auto via the segmented control in the sidebar footer (a compact toggle sits on the
  landing page), applied before first paint with no flash

## How the simulated market works

`src/lib/market/engine.ts`

1. **Reference data** — `catalog.ts` holds 44 curated instruments with a reference price,
   volatility, 52-week range, fundamentals and an accent colour.
2. **Deterministic history** — seeded PRNG (`mulberry32`, seeded from the ticker) drives piecewise
   **Brownian bridges**, so a generated series passes exactly through the anchors it should:
   the previous close and the current price on 1D, the published 52-week high/low on 1Y, and a
   drift-derived start on longer ranges. Reload the page and the chart is identical.
3. **Live ticking** — every ~2.2s each quote takes a volatility-calibrated random-walk step with
   mild mean reversion toward its reference price, plus occasional "headline" shocks. The intraday
   path is kept on each quote for sparklines.
4. **Distribution** — quotes live in a tiny external store consumed through `useSyncExternalStore`.
   The server snapshot is the empty board, so SSR markup and the first client render always match;
   prices appear the instant the store boots. One shared interval serves the whole app, and it
   pauses when the tab is hidden or live prices are switched off.

## How state works

`src/lib/store/`

- `types.ts` — the shape of the account: cash, positions, orders, activity ledger, watchlist, settings
- `seed.ts` — the demo account. Cash is **derived from the ledger** (deposits − buys + sells +
  dividends), so the seeded numbers always reconcile
- `reducer.ts` — all mutations. Fills are applied through a single `executeFill` path that updates
  cash, weighted-average cost, realised P&L and the activity ledger atomically, and voids orders
  that can no longer be satisfied
- `provider.tsx` — context, persistence (per-user `localStorage` key `monievest.portfolio.v1[:u:<id>]`),
  Supabase hydration, cross-tab sync, and validated action helpers that raise toasts
- `supabase-sync.ts` — the Postgres ↔ state mapping: loads a signed-in user's rows into a
  `PortfolioState`, and writes changes back (debounced, with an append-only delta for the ledger)
- `selectors.ts` — holdings, portfolio summary, allocation, movers, search and the replayed
  performance series

**Two invariants hold after every action** (verified during development):

```
state.cash  ===  Σ activity.amount
Σ positions ===  Σ buy quantities − Σ sell quantities, per symbol
```

## Accounts, sign-in & Supabase

Monievest has two modes and **both are fully functional**:

| Mode | When | Where data lives | `/app/*` |
| --- | --- | --- | --- |
| **Guest** | No Supabase env vars | `localStorage` (this browser only) | Open to everyone |
| **Accounts** | `NEXT_PUBLIC_SUPABASE_URL` + `..._ANON_KEY` set | Postgres, one row-set per user | Sign-in required |

### Set it up in five minutes

1. **Create the tables.** Supabase dashboard → your project → **SQL Editor** → *New query* → paste
   the whole of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**.
   It creates six tables, their indexes, Row Level Security policies, and the sign-up trigger.
   Then run [`supabase/migrations/0002_admin.sql`](supabase/migrations/0002_admin.sql) the same
   way — it adds the admin role, account status, the feedback table and the admin stock universe
   (see [Admin dashboard](#admin-dashboard)). Both scripts are idempotent, so re-running them is
   harmless.
2. **Copy the keys.** Dashboard → **Settings** → **API** → copy the *Project URL* and the *anon /
   publishable* key into `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi…"
   ```

3. **Restart the dev server** (`npm run dev`) so the new env is picked up.
4. **Open `/signup`** and create an account. If *Confirm email* is enabled in
   **Authentication → Providers → Email**, check your inbox for the verification link first;
   disable it while testing and sign-up lands you straight in the dashboard.
5. Done — buy a stock, reload, sign out, sign back in. It is all still there.

New accounts start with **$25,000** of demo cash, credited by the `handle_new_user()` trigger
(change the `starting_cash` value in the migration if you want a different number).

### What is stored where

**In Supabase (per user):** `profiles` (name, tier, account number), `portfolios` (cash, realised
P&L), `positions`, `orders`, `activity` (the ledger), `watchlist`.
**On the device only:** `settings` — theme, compact tables, default chart range, price engine
toggles. Preferences should not follow you between a phone and a desktop.

Writes are debounced ~0.9 s after the last change, then upserted. The ledger is append-only, so only
new entries are sent; a **Reset account** wipes the user's rows in Postgres and re-credits the
starting cash. `localStorage` keeps a per-user cache, which makes reloads instant and keeps the app
usable if Supabase is briefly unreachable — the database stays the source of truth.

### How isolation is enforced

Not in the UI — in Postgres. Every table has `user_id uuid references auth.users(id)` and RLS
policies of the form:

```sql
create policy "positions: read own" on public.positions
  for select using (auth.uid() = user_id);
```

`auth.uid()` comes from the signed-in user's JWT, so a query for someone else's rows returns nothing
even if the client tries. That is also why the **anon key is safe to ship to the browser**: it is a
publishable key whose permissions are defined by RLS. The `service_role` key bypasses RLS entirely —
it must never appear in this repo or in any `NEXT_PUBLIC_` variable.

Route protection lives in [`src/proxy.ts`](src/proxy.ts) (Next 16's replacement for `middleware.ts`):
it refreshes the session cookie on every `/app/*`, `/login` and `/signup` request, bounces signed-out
visitors to `/login?next=<where-they-were-going>`, and sends signed-in visitors away from the auth
pages. With no env vars configured the proxy is a pass-through, so guest mode is untouched.

### Files

```
src/lib/supabase/config.ts     Reads NEXT_PUBLIC_SUPABASE_* (edge-safe, no deps)
src/lib/supabase/client.ts     Browser client (session in cookies)
src/lib/supabase/server.ts     Server client + getCurrentUser() — `server-only`
src/lib/supabase/session.ts    Cookie refresh + route protection used by the proxy
src/proxy.ts                   Next 16 request proxy (matcher: /app/*, /login, /signup)
src/app/(auth)/                /login and /signup pages, layout, server actions
src/components/auth/           The sign-in / sign-up form (useActionState)
src/lib/store/supabase-sync.ts Row ↔ state mapping, debounced writes, reset
supabase/migrations/0001_init.sql   Paste into the Supabase SQL Editor
supabase/migrations/0002_admin.sql  Admin role, status, feedback, demo stocks
```

### Troubleshooting

- **Redirected to `/login` forever** — the URL/key pair is wrong or the project is paused. The
  sign-in form reports Supabase's own error message.
- **"Could not reach Supabase"** in Settings → *Account & sync* — check the URL and that the
  project is active.
- **Signed up but got no account rows** — the migration wasn't run, so the trigger doesn't exist.
  Run it, then use **Reset account** (or sign up again) to bootstrap the rows.
- **Email confirmation** — *Authentication → Providers → Email → Confirm email*. The app handles
  both settings: with confirmation on, sign-up shows a "check your inbox" message instead of
  redirecting.
- **Confirmation emails link to the wrong place** — Supabase only honours a redirect URL that is
  listed in *Authentication → URL Configuration → Redirect URLs*. Add every host you browse from
  (localhost, your preview URL, your production domain). The app sends the request's own `Origin`,
  so proxied previews work once that origin is allow-listed.
- **Deploying** — set both env vars on the host, add your production URL to
  *Authentication → URL Configuration* (site URL + redirect URLs), and set `NEXT_PUBLIC_APP_URL`
  so confirmation emails land on the right origin.

## Admin dashboard

One or more accounts can carry the **admin** role. When an admin signs in, `/app` lands them on
the **admin dashboard** (`/app/admin`) instead of the personal dashboard; every other user keeps
seeing their own portfolio exactly as before.

**What's inside** — five tabs:

- **Overview (analytics)** — total sign-ups (plus a 14-day chart), total demo trades placed,
  most-traded stocks, open feedback and disabled-account counts.
- **Users** — every account with name, email, sign-up date, demo wallet balance and status.
  Disable a spam/abusive account with one click — the user is signed out and blocked; re-enable
  them just as easily.
- **Trading** — every order any user placed (stock, side, qty, price, status, time) and the
  portfolio value per user, with automatic flags for suspicious data (negative cash, negative
  portfolio value, cash over $1M, negative positions).
- **Stocks & data** — the tradable demo universe: add new stocks, edit or remove them, or disable
  built-in catalog stocks (changes reach every user on their next page load), plus a live health
  panel for the price source (simulator vs. live provider, last tick, provider errors).
- **Support** — the inbox for messages sent from the **Support** page (`/app/feedback`); reply,
  close or delete. Replies appear on the user's Support page.

**Where it lives**

```
src/app/app/admin/page.tsx         Route guard + entry point
src/components/views/admin-view.tsx Tab shell (Overview/Users/Trading/Stocks/Support)
src/components/admin/              One component per tab
src/lib/admin/data.ts              Admin queries & mutations (browser client + RLS)
src/app/app/feedback/page.tsx      The user-facing feedback form
src/app/api/stocks/route.ts        Publishes the admin stock universe to clients
supabase/migrations/0002_admin.sql Role, status, feedback, demo_stocks, admin RLS
```

**How access control works.** The role is a column: `profiles.role = 'admin'`. The app's route
guard (`requireAdminProfile()`) redirects non-admins, and — more importantly — every admin query is
protected a second time in Postgres by policies that call a `public.is_admin()` function, so a
hand-edited client can never read cross-user data. A trigger stops ordinary users from promoting
themselves via the profile update path, and disabled accounts are bounced by the `/app` layout
before anything renders.

### Making someone an admin

There is deliberately no in-app "promote" button — admin is granted in Supabase. In the Supabase
dashboard → **SQL Editor**, run one of:

```sql
-- by user id (Authentication → Users → copy the UID)
update public.profiles
   set role = 'admin'
 where id = 'PASTE-USER-ID-HERE';

-- or by email
update public.profiles p
   set role = 'admin'
  from auth.users u
 where p.id = u.id
   and lower(u.email) = lower('you@example.com');
```

Check it worked: `select display_name, email, role, status from public.profiles;`
Demote the same way with `set role = 'user'`. The change takes effect on the person's next page
load — they get the **Admin** badge, an *Administration* section in the sidebar, and land on the
admin dashboard instead of their portfolio.

## Hydration strategy

Anything that depends on stored data or live prices renders a skeleton on the server and on the
first client render, then resolves — so there is never a flash of a wrong number, and never a
hydration mismatch:

- `useMarket().ready` gates quotes, charts and the ticker tape
- `usePortfolio().hydrated` gates cash, holdings and P&L
- `useMounted()` (built on `useSyncExternalStore`) gates theme-dependent chrome

State that must reset when props change (open dialogs, re-pointed order tickets) is derived during
render rather than in effects, which keeps render cascades — and the React Compiler — happy.

## Project structure

```
src/
├── app/
│   ├── layout.tsx              Root layout: fonts, metadata, provider stack
│   ├── page.tsx                Marketing landing page (uses the real, live components)
│   ├── (auth)/
│   │   ├── layout.tsx          Split brand panel + form card
│   │   ├── login/page.tsx      /login
│   │   ├── signup/page.tsx     /signup
│   │   └── actions.ts          Server actions: signIn, signUp, signOut
│   ├── not-found.tsx           404 with suggested tickers
│   ├── icon.svg                Monievest monogram
│   ├── globals.css             Design tokens (light + dark), utilities, animations
│   └── app/
│       ├── layout.tsx          App shell layout
│       ├── page.tsx            /app            Dashboard
│       ├── markets/page.tsx    /app/markets    Markets
│       ├── portfolio/page.tsx  /app/portfolio  Portfolio
│       ├── watchlist/page.tsx  /app/watchlist  Watchlist
│       ├── activity/page.tsx   /app/activity   Activity
│       ├── wallet/page.tsx     /app/wallet     Wallet
│       ├── settings/page.tsx   /app/settings   Settings
│       └── stock/[symbol]/     /app/stock/AAPL Stock detail (dynamic metadata)
├── components/
│   ├── app/                    Shell: sidebar (nav + theme control), topbar, search palette,
│   │                           sync indicator
│   ├── auth/                   Sign-in / sign-up form (useActionState)
│   ├── dashboard/              Stock rail, Portfolio Values + Statistics cards, My Stock table
│   ├── charts/                 Price/performance/allocation charts + range selector
│   ├── market/                 MarketProvider (quote board + limit auto-fill)
│   ├── portfolio/              Holdings table
│   ├── shared/                 Live prices, change chips, sparkline, avatars, empty states
│   ├── trade/                  Order ticket (form + dialog)
│   ├── ui/                     shadcn/ui-style primitives
│   ├── views/                  One client view per route
│   ├── brand.tsx               Logo + wordmark
│   ├── mode-toggle.tsx         Light / dark / system (landing page)
│   └── providers.tsx           Provider composition
├── proxy.ts                    Session refresh + /app/* route protection
└── lib/
    ├── hooks/use-mounted.ts
    ├── market/                 types, catalog, engine, store, news, providers/
    ├── store/                  types, seed, reducer, provider, selectors, supabase-sync
    ├── supabase/               config, browser client, server client, session
    ├── format.ts               Money, percent, share, date and P&L formatting
    └── utils.ts                cn(), seeded PRNG, gaussian, helpers
```

## Configuration (API keys)

Monievest runs fully offline on its simulator. To point it at a live provider, drop your key into a
local env file:

```bash
cp .env.example .env.local      # .env.local is git-ignored
# then edit .env.local: paste your key + set MARKET_DATA_PROVIDER
```

| Variable                    | Purpose                                                                | Default       |
| --------------------------- | ---------------------------------------------------------------------- | ------------- |
| `MARKET_DATA_PROVIDER`      | `simulated` \| `finnhub` \| `polygon` \| `alphavantage` \| `twelvedata` | `simulated`   |
| `FINNHUB_API_KEY`           | Finnhub key                                                             | _empty_       |
| `POLYGON_API_KEY`           | Polygon.io key                                                          | _empty_       |
| `ALPHA_VANTAGE_API_KEY`     | Alpha Vantage key                                                       | _empty_       |
| `TWELVE_DATA_API_KEY`       | Twelve Data key                                                         | _empty_       |
| `MARKET_DATA_BASE_URL`      | Override the provider base URL (proxies, sandboxes)                     | provider URL  |
| `MARKET_DATA_CACHE_SECONDS` | Server-side quote cache lifetime **and** client poll interval (0–3600)  | `45`          |
| `NEXT_PUBLIC_APP_URL`       | Absolute origin for metadata / OG URLs **and** auth email redirects      | `localhost`   |
| `NEXT_PUBLIC_SUPABASE_URL`  | Supabase project URL — enables accounts, persistence and route protection | _empty_ (guest mode) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable anon key. Safe in the browser **because of RLS**          | _empty_ (guest mode) |

**Key handling**

- `.gitignore` blocks `.env`, `.env.*` and `.env*.local`; only the blank **`.env.example`** template
  is committed. Never paste a real key into `.env.example`.
- Every secret above is a **server-only** name (no `NEXT_PUBLIC_` prefix), so Next.js never inlines
  it into the browser bundle. `src/lib/config/env.ts` imports `server-only` to enforce that it is
  only reachable from route handlers / server components / server actions.
- `getMarketConfig()` resolves the provider once and **degrades gracefully**: if the provider is
  named but its key is blank, it returns `live: false`, falls back to the simulator and reports the
  reason in `warning` instead of rendering empty charts.
- The dev server reloads automatically when an env file changes — no rebuild needed.

## Live market data (Finnhub)

Set `MARKET_DATA_PROVIDER="finnhub"` plus `FINNHUB_API_KEY` and the app switches from the local
simulator to real prices. The key stays on the server: the browser only ever calls our own route
handlers.

| Route                    | Purpose                                                                  |
| ------------------------ | ------------------------------------------------------------------------ |
| `GET /api/market/config` | Tells the client whether live data is on (never returns the key)          |
| `POST /api/market/quotes`| Real quotes for up to 40 symbols per call                                 |
| `GET /api/market/candles`| Real history, with `source: "finnhub" \| "simulated" \| "unavailable"`     |
| `GET /api/market/search` | Symbol search across the provider's whole listed universe                 |

**What goes live**

- Prices for **every** catalogued instrument plus your positions and watchlist, merged over the
  board (the first poll primes the whole list, then it is refreshed in rotating chunks)
- Search beyond the 44 curated instruments — the full US-listed universe
- Deep links to any resolved ticker (`/app/stock/RIVN`), resolved server-side from quote + profile
- Real candles on the stock page when your plan permits them

**What still falls back to the simulator (deliberately)**

- Candles when the key is premium-gated — `/stock/candle` answers `no_permission` on many free
  tiers, so the capability is probed once, switched off, and history is served locally with
  `source: "simulated"`
- Any symbol the provider does not cover, plus `volume` (Finnhub's `/quote` does not return it)
- Portfolio analytics that replay history, until real candles for those symbols are cached
- Simulated news

**Staying inside the free tier.** Finnhub has no batch quote endpoint, so each symbol costs one
call. The board is therefore refreshed in rotating chunks: enabling live data primes every symbol
once (up to 48), then 12 symbols are polled every ~15s. With the default 60s server cache that
lands at ≈48 calls/minute. The server additionally budgets 55 calls/minute, queues briefly, then
serves the cached value, so a slow network can never trip a 429. Turning off **Live prices** in
Settings stops provider polling entirely.

**Seeing what is real.** The Markets page prints a banner — `Real prices via Finnhub · 44 of 44
symbols live · updated 14:02:11 · 48 API calls in the last minute` — and every row with a real
price carries a violet dot. If the key is missing, invalid or the endpoint is not on your plan, an
amber banner shows the provider's actual error instead of silently displaying simulated numbers.
The topbar pill reads `LIVE`, `STALE` or `SIM`.

**Knowing which mode you are in.** The pill in the topbar reads `LIVE` (real prices, with the
provider name and last update on hover), `STALE` (a poll failed) or `SIM` (simulator). The stock
page swaps its "Simulated data" badge for the provider badge in live mode.

## Swapping in real market data

The data layer is deliberately narrow. To go live:

1. Read the key with `getMarketConfig()` (`src/lib/config/env.ts`) inside a route handler — never in
   client code.
2. Implement `buildQuotes()` / `tickQuotes()` / `getHistory()` in `src/lib/market/engine.ts`
   against that provider, keeping the `Quote` / `Candle` shapes.
3. Replace `catalog.ts` with provider reference data, keeping the `Instrument` shape.
4. Everything else — charts, tables, portfolio maths, order routing — is unchanged.

To persist accounts server-side, replace `PortfolioProvider`'s `localStorage` load/save with API
calls; the `Action` union and reducer are already transport-agnostic.

## Disclaimer

Monievest is a design and engineering demonstration. It is not a broker-dealer, not a registered
investment adviser, and not connected to any market. Simulated results say nothing about how real
investments would perform. Do not use it as the basis for a financial decision.
