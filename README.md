# Monievest

**Invest in stocks. Build real wealth.**

Monievest is a modern investment web app: buy and sell stocks and ETFs, build a diversified
portfolio, track performance against the market, and manage your cash — all in a dark-first
fintech interface with a complete light theme.

> ⚠️ **Demo product.** Every price, quote, fill, dividend, headline and balance is **simulated
> locally in your browser**. There is no broker, no exchange connection and no real money.
> Nothing here is investment advice.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

No `.env` file, no API keys, no database, no sign-up. The demo account arrives pre-funded with
cash and a populated portfolio so everything is meaningful on first load.

```bash
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint (flat config, next/core-web-vitals + typescript)
npm run typecheck
```

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
- Gainers / losers / most-active boards, index snapshot, scrolling ticker tape
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

- Dark-first fintech palette (deep navy surfaces, violet brand, emerald gains / rose losses)
- A complete light theme, not an inversion: every surface, chart, table, toast and tooltip is
  driven by CSS custom properties
- Light / dark / system, applied before first paint

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
│   ├── app/                    Shell: sidebar, topbar, ticker tape, search palette, nav
│   ├── charts/                 Price/performance/allocation charts + range selector
│   ├── market/                 MarketProvider (quote board + limit auto-fill)
│   ├── portfolio/              Holdings table
│   ├── shared/                 Live prices, change chips, sparkline, avatars, empty states
│   ├── trade/                  Order ticket (form + dialog)
│   ├── ui/                     shadcn/ui-style primitives
│   ├── views/                  One client view per route
│   ├── brand.tsx               Logo + wordmark
│   ├── mode-toggle.tsx         Light / dark / system
│   └── providers.tsx           Provider composition
└── lib/
    ├── hooks/use-mounted.ts
    ├── market/                 types, catalog, engine, store, news
    ├── store/                  types, seed, reducer, provider, selectors
    ├── format.ts               Money, percent, share, date and P&L formatting
    └── utils.ts                cn(), seeded PRNG, gaussian, helpers
```

## Swapping in real market data

The data layer is deliberately narrow. To go live:

1. Implement `buildQuotes()` / `tickQuotes()` / `getHistory()` in `src/lib/market/engine.ts`
   against a real provider (Finnhub, Polygon, Alpha Vantage, Twelve Data…).
2. Replace `catalog.ts` with provider reference data, keeping the `Instrument` shape.
3. Everything else — charts, tables, portfolio maths, order routing — is unchanged.

To persist accounts server-side, replace `PortfolioProvider`'s `localStorage` load/save with API
calls; the `Action` union and reducer are already transport-agnostic.

## Disclaimer

Monievest is a design and engineering demonstration. It is not a broker-dealer, not a registered
investment adviser, and not connected to any market. Simulated results say nothing about how real
investments would perform. Do not use it as the basis for a financial decision.
