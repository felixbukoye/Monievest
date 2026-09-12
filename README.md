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
| State      | `useReducer` + React context, persisted to `localStorage`         |
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
- `provider.tsx` — context, `localStorage` persistence (key `monievest.portfolio.v1`), cross-tab
  sync, and validated action helpers that raise toasts
- `selectors.ts` — holdings, portfolio summary, allocation, movers, search and the replayed
  performance series

**Two invariants hold after every action** (verified during development):

```
state.cash  ===  Σ activity.amount
Σ positions ===  Σ buy quantities − Σ sell quantities, per symbol
```

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
│   ├── app/                    Shell: sidebar (nav + theme control), topbar, search palette
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
└── lib/
    ├── hooks/use-mounted.ts
    ├── market/                 types, catalog, engine, store, news
    ├── store/                  types, seed, reducer, provider, selectors
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
| `NEXT_PUBLIC_APP_URL`       | Absolute origin for metadata / OG URLs                                  | `localhost`   |

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

- Prices for your positions, watchlist and the catalogued instruments, polled on an interval
  (`MARKET_DATA_CACHE_SECONDS`, default 45s) and merged over the board
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
call. The server budgets 50 calls/minute, queues briefly, then serves the cached value; the client
caps each poll at 40 symbols, prioritising open positions and the watchlist. At the default 45s
interval that is ≈53 calls/minute — inside the limit. Turning off **Live prices** in Settings stops
provider polling entirely.

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
