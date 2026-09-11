"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BarChart3Icon,
  BotIcon,
  CandlestickChartIcon,
  GaugeIcon,
  LayersIcon,
  MoonIcon,
  PieChartIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SunIcon,
  WalletIcon,
  ZapIcon,
} from "lucide-react";
import * as React from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { TickerTape } from "@/components/app/ticker-tape";
import { Wordmark, LogoMark } from "@/components/brand";
import { useMarket } from "@/components/market/market-provider";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { PerformanceChart, PriceChart, RangeSelector } from "@/components/charts/price-chart";
import { ChangeChip, LivePrice } from "@/components/shared/prices";
import { SimulatedBadge } from "@/components/shared/states";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCompactMoney, formatMoney, formatPercent, formatShares } from "@/lib/format";
import { getInstrument } from "@/lib/market/catalog";
import { buildPerformance, allocationBy, buildHoldings, summarise, topMovers } from "@/lib/store/selectors";
import { usePortfolio } from "@/lib/store/provider";
import type { Range } from "@/lib/market/types";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: ZapIcon,
    title: "Trade in seconds",
    body: "Market and limit orders with fractional shares, instant fills and zero commission. Resting limit orders execute on their own the moment price touches them.",
  },
  {
    icon: PieChartIcon,
    title: "Portfolio intelligence",
    body: "See unrealised and realised returns, sector allocation, weighting concentration and daily P&L at a glance — recalculated on every tick.",
  },
  {
    icon: CandlestickChartIcon,
    title: "Charts that go deep",
    body: "Intraday to five-year history with volume, 52-week range markers, key statistics and a benchmark overlay against the S&P 500.",
  },
  {
    icon: WalletIcon,
    title: "Cash you control",
    body: "Fund your account, withdraw back to the bank, and always know exactly how much buying power is available before you commit.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Practise without risk",
    body: "Every quote, fill and balance is simulated locally in your browser. Learn the mechanics of investing before a single real dollar is on the line.",
  },
  {
    icon: MoonIcon,
    title: "Light & dark, done properly",
    body: "A full dual-theme design system — not an inverted stylesheet. Switch instantly, follow your system, and never get a white flash on load.",
  },
];

const STEPS = [
  { title: "Fund the account", body: "Your demo wallet starts loaded with cash. Top it up any time from the Wallet page." },
  { title: "Pick your positions", body: "Search 44 stocks and ETFs across 12 sectors, study the chart, then buy whole or fractional shares." },
  { title: "Watch it compound", body: "Track allocation, daily moves and total return against the market — then rebalance." },
];

export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <FeatureGrid />
        <HowItWorks />
        <MarketSnapshot />
        <ThemeShowcase />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SiteHeader() {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        scrolled ? "border-border/70 bg-background/80 backdrop-blur-xl" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Wordmark />

        <nav className="hidden items-center gap-1 md:flex">
          {[
            { href: "#features", label: "Features" },
            { href: "#how-it-works", label: "How it works" },
            { href: "#markets", label: "Markets" },
            { href: "#themes", label: "Themes" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
          <Button asChild variant="ghost" className="hidden sm:flex">
            <Link href="/app">Sign in</Link>
          </Button>
          <Button asChild variant="glow">
            <Link href="/app">
              Open app
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 surface-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/18 blur-[130px]" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-20 lg:pb-24">
        <div className="animate-rise">
          <Badge variant="outline" className="mb-5 gap-2 border-primary/30 bg-primary/8 py-1 pr-3 pl-1.5 text-xs">
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">NEW</span>
            Fractional shares &amp; limit orders are live
          </Badge>

          <h1 className="text-balance text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Invest in stocks.
            <br />
            <span className="bg-[linear-gradient(100deg,var(--color-primary),var(--color-gain))] bg-clip-text text-transparent">
              Build real wealth.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-[15.5px] leading-relaxed text-muted-foreground sm:text-base">
            Monievest puts a full brokerage in your browser — live prices, market and limit orders,
            fractional shares, portfolio analytics and a cash wallet. Practise the whole workflow on a
            simulated market before you put real money to work.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="xl" variant="glow">
              <Link href="/app">
                Start investing free
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/app/markets">Explore markets</Link>
            </Button>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t pt-6">
            {[
              { label: "Instruments", value: "44" },
              { label: "Commission", value: "$0.00" },
              { label: "Demo cash", value: "$35k" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{stat.label}</dt>
                <dd className="tnum mt-1 text-2xl font-semibold tracking-tight">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <HeroPanel />
      </div>

      <TickerTape className="border-y" />
    </section>
  );
}

/** A live, working slice of the real dashboard — not a mockup image. */
function HeroPanel() {
  const { state, hydrated } = usePortfolio();
  const { quotes, ready } = useMarket();
  const [range, setRange] = React.useState<Range>("3M");

  const summary = React.useMemo(() => summarise(state, quotes), [state, quotes]);
  const holdings = React.useMemo(() => buildHoldings(state, quotes), [state, quotes]);
  const slices = React.useMemo(() => allocationBy(holdings, "sector"), [holdings]);
  const performance = React.useMemo(() => buildPerformance(state, range), [state, range]);

  const hero = getInstrument("NVDA")!;

  return (
    <div className="relative animate-rise [animation-delay:120ms]">
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-primary/10 blur-3xl" />

      <Card className="relative overflow-hidden rounded-2xl p-0 shadow-2xl glow-ring">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/25 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Portfolio value</p>
            <p className="tnum mt-0.5 text-2xl font-semibold tracking-tight">
              {hydrated ? formatMoney(summary.totalValue) : "—"}
            </p>
          </div>
          <div className="text-right">
            {hydrated && (
              <>
                <ChangeChip value={summary.dayChange} pct={summary.dayChangePct} />
                <p className="mt-1 text-[11px] text-muted-foreground">today</p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <BarChart3Icon className="size-4 text-primary" />
            Performance vs S&amp;P 500
          </div>
          <RangeSelector range={range} onChange={setRange} ranges={["1M", "3M", "1Y", "5Y"]} size="sm" />
        </div>

        <div className="px-1 pt-1">
          <PerformanceHero data={performance} ready={ready} />
        </div>

        <div className="grid grid-cols-3 gap-px border-y bg-border/60">
          <MiniStat label="Invested" value={hydrated ? formatCompactMoney(summary.marketValue) : "—"} />
          <MiniStat
            label="Unrealised"
            value={hydrated ? formatMoney(summary.unrealizedPnl) : "—"}
            tone={summary.unrealizedPnl >= 0 ? "gain" : "loss"}
          />
          <MiniStat label="Cash" value={hydrated ? formatCompactMoney(summary.cash) : "—"} />
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1">
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Top holdings
            </p>
            {holdings.slice(0, 4).map((holding) => (
              <Link
                key={holding.instrument.symbol}
                href={`/app/stock/${holding.instrument.symbol}`}
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-accent/60"
              >
                <StockAvatar symbol={holding.instrument.symbol} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[12.5px] font-semibold">{holding.instrument.symbol}</p>
                  <p className="tnum text-[11px] text-muted-foreground">
                    {formatShares(holding.qty)} sh · {formatCompactMoney(holding.marketValue)}
                  </p>
                </div>
                <span
                  className={cn(
                    "tnum text-[12px] font-semibold",
                    holding.unrealizedPnlPct >= 0 ? "text-gain" : "text-loss",
                  )}
                >
                  {formatPercent(holding.unrealizedPnlPct)}
                </span>
              </Link>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center gap-2">
            <AllocationChart slices={slices} size={126} centerValue={hydrated ? `${slices.length}` : "—"} centerLabel="Sectors" />
            <p className="text-[11px] text-muted-foreground">Allocation</p>
          </div>
        </div>
      </Card>

      {/* Floating trade card */}
      <Card className="absolute -bottom-8 -left-4 hidden w-[16.5rem] p-3.5 shadow-xl sm:block lg:-left-10">
        <div className="flex items-center gap-2.5">
          <StockAvatar symbol={hero.symbol} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold">{hero.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{hero.symbol} · {hero.exchange}</p>
          </div>
          <LivePrice symbol={hero.symbol} size="sm" />
        </div>
        <div className="mt-2.5">
          <PriceChart instrument={hero} quote={quotes[hero.symbol]} range="1M" ready={ready} height={54} showVolume={false} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <ChangeChip pct={quotes[hero.symbol]?.changePct ?? hero.changePct} size="sm" />
          <Button asChild size="sm" variant="default" className="h-7 text-[11px]">
            <Link href={`/app/stock/${hero.symbol}`}>Trade</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PerformanceHero({
  data,
  ready,
}: {
  data: { t: number; value: number; benchmark?: number }[];
  ready: boolean;
}) {
  if (!ready || data.length < 2) return <div className="h-[188px] animate-pulse rounded-lg bg-muted/40" />;
  return <PerformanceChart data={data} height={188} />;
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "gain" | "loss" }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className={cn("tnum mt-0.5 text-sm font-semibold", tone === "gain" && "text-gain", tone === "loss" && "text-loss")}>
        {value}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function FeatureGrid() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
      <div className="max-w-2xl">
        <Badge variant="default" className="mb-4">
          <SparklesIcon />
          Everything included
        </Badge>
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          A brokerage-grade toolkit, without the brokerage-grade friction
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Monievest is built the way a modern investing product should feel: fast, legible, and honest
          about numbers. Every feature below is working in the app right now.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <Card
            key={feature.title}
            className="group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
          >
            <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
            <span className="grid size-10 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <feature.icon className="size-5" strokeWidth={2} />
            </span>
            <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{feature.title}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{feature.body}</p>
            <span className="tnum absolute top-4 right-4 text-[11px] font-semibold text-muted-foreground/40">
              0{index + 1}
            </span>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y bg-muted/25 py-20 lg:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <Badge variant="default" className="mb-4">
              <GaugeIcon />
              Three steps
            </Badge>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              From first deposit to a diversified portfolio
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              The demo account arrives pre-loaded with cash and a handful of positions, so you can see a
              populated portfolio immediately — or reset it and start completely from scratch.
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link href="/app/wallet">
                <WalletIcon />
                Open the wallet
              </Link>
            </Button>
          </div>

          <ol className="space-y-4">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <Card className="flex gap-4 p-5">
                  <span className="tnum grid size-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(140deg,var(--color-primary),var(--color-gain))] text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function MarketSnapshot() {
  const { quotes, ready } = useMarket();
  const movers = React.useMemo(() => topMovers(quotes), [quotes]);
  const rows = ready ? movers.gainers.slice(0, 5) : [];

  return (
    <section id="markets" className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <Badge variant="default" className="mb-4">
            <LayersIcon />
            Live board
          </Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Prices that actually move while you look at them
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            A local simulator advances every instrument on a volatility-calibrated random walk, so the
            whole product feels alive — no API key, no rate limit, no blank screens.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <SimulatedBadge label="Simulated market · no API key" />
          <Button asChild variant="outline">
            <Link href="/app/markets">
              Open full market list
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </div>

      <Card className="mt-10 overflow-hidden p-0">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b bg-muted/30 px-4 py-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sm:grid-cols-[1.6fr_1fr_auto_auto] sm:px-5">
          <span>Instrument</span>
          <span className="hidden sm:block">Sector</span>
          <span className="text-right">Price</span>
          <span className="text-right">Change</span>
        </div>

        {!ready ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : (
          rows.map((row) => (
            <Link
              key={row.instrument.symbol}
              href={`/app/stock/${row.instrument.symbol}`}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border/60 px-4 py-3 transition-colors last:border-0 hover:bg-accent/50 sm:grid-cols-[1.6fr_1fr_auto_auto] sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <StockAvatar symbol={row.instrument.symbol} size="sm" />
                <span className="min-w-0">
                  <span className="block font-mono text-[13px] font-semibold">{row.instrument.symbol}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">{row.instrument.name}</span>
                </span>
              </span>
              <span className="hidden text-[12.5px] text-muted-foreground sm:block">{row.instrument.sector}</span>
              <span className="text-right">
                <LivePrice symbol={row.instrument.symbol} size="sm" />
              </span>
              <span className="flex justify-end">
                <ChangeChip pct={row.quote.changePct} size="sm" />
              </span>
            </Link>
          ))
        )}
      </Card>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function ThemeShowcase() {
  return (
    <section id="themes" className="scroll-mt-20 border-y bg-muted/25 py-20 lg:py-24">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <Badge variant="default" className="mb-4">
            <SunIcon />
            Light &amp; dark
          </Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Two themes, one design system
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Every surface, chart, table and toast is token-driven, so dark mode is a first-class design
            rather than an inversion. Gain-green and loss-red stay legible on both backgrounds, and the
            theme is applied before first paint — no flash of the wrong colour.
          </p>

          <ul className="mt-7 space-y-3">
            {[
              { icon: BotIcon, text: "Token-driven palette in CSS custom properties" },
              { icon: ShieldCheckIcon, text: "Flash-free hydration via next-themes" },
              { icon: BadgeCheckIcon, text: "Charts, tables and toasts re-colour automatically" },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-[14px]">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background text-primary">
                  <item.icon className="size-4" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex items-center gap-3">
            <ModeToggle />
            <span className="text-[13px] text-muted-foreground">Try it — the whole page re-themes instantly.</span>
          </div>
        </div>

        <div className="relative">
          <div className="grid gap-4 sm:grid-cols-2">
            <ThemePreviewCard mode="dark" />
            <ThemePreviewCard mode="light" className="sm:mt-10" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ThemePreviewCard({ mode, className }: { mode: "dark" | "light"; className?: string }) {
  const dark = mode === "dark";
  return (
    <div
      className={cn("rounded-2xl border p-4 shadow-xl", className)}
      style={{
        background: dark ? "#0b111c" : "#ffffff",
        borderColor: dark ? "#1b2536" : "#e1e7f1",
        color: dark ? "#e6edf9" : "#0b1220",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark className="size-6 rounded-lg" />
          <span className="text-[13px] font-semibold">Monievest</span>
        </div>
        {dark ? <MoonIcon className="size-4" /> : <SunIcon className="size-4" />}
      </div>

      <p className="mt-4 text-[10.5px] font-semibold tracking-wider uppercase" style={{ color: dark ? "#8494ad" : "#5d6c86" }}>
        Total value
      </p>
      <p className="tnum text-xl font-semibold tracking-tight">$91,133.54</p>
      <span
        className="tnum mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
        style={{
          color: dark ? "#2ee59b" : "#0f9d58",
          background: dark ? "#2ee59b1f" : "#0f9d581a",
        }}
      >
        +2.14% today
      </span>

      <div
        className="mt-4 h-16 w-full rounded-lg"
        style={{
          background: dark
            ? "linear-gradient(180deg, rgba(124,108,246,0.35), rgba(124,108,246,0))"
            : "linear-gradient(180deg, rgba(91,70,232,0.22), rgba(91,70,232,0))",
        }}
      >
        <svg viewBox="0 0 200 60" className="h-full w-full" preserveAspectRatio="none">
          <path
            d="M0,46 C22,40 34,50 52,42 C70,34 82,44 100,32 C118,20 130,28 148,18 C166,8 180,14 200,6"
            fill="none"
            stroke={dark ? "#7c6cf6" : "#5b46e8"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="mt-3 space-y-1.5">
        {[
          { s: "AAPL", v: "+1.82%", up: true },
          { s: "TSLA", v: "−0.64%", up: false },
        ].map((row) => (
          <div
            key={row.s}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px]"
            style={{ background: dark ? "#131b2b" : "#f0f3f9" }}
          >
            <span className="font-mono font-semibold">{row.s}</span>
            <span className="tnum font-semibold" style={{ color: row.up ? (dark ? "#2ee59b" : "#0f9d58") : dark ? "#fb5c78" : "#e11d48" }}>
              {row.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function FinalCta() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-0 surface-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
      <div className="relative mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
        <LogoMark className="mx-auto size-12 rounded-2xl" />
        <h2 className="mt-6 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Your portfolio is one click away
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground">
          No sign-up, no card, no download. Open Monievest and start building a portfolio against a live
          simulated market — your data stays in your browser.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="xl" variant="glow">
            <Link href="/app">
              Launch the app
              <ArrowRightIcon />
            </Link>
          </Button>
          <Button asChild size="xl" variant="outline">
            <Link href="/app/portfolio">View sample portfolio</Link>
          </Button>
        </div>
        <p className="mt-6 text-[12px] text-muted-foreground">
          Simulated data for demonstration and education only. Nothing here is investment advice.
        </p>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t bg-sidebar/60">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark showTagline />
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            A modern investment workspace for stocks and ETFs — built with Next.js, Tailwind and a fully
            local market simulator.
          </p>
        </div>

        {[
          {
            title: "Product",
            links: [
              { label: "Dashboard", href: "/app" },
              { label: "Markets", href: "/app/markets" },
              { label: "Portfolio", href: "/app/portfolio" },
              { label: "Wallet", href: "/app/wallet" },
            ],
          },
          {
            title: "Explore",
            links: [
              { label: "Apple", href: "/app/stock/AAPL" },
              { label: "NVIDIA", href: "/app/stock/NVDA" },
              { label: "S&P 500 ETF", href: "/app/stock/SPY" },
              { label: "Watchlist", href: "/app/watchlist" },
            ],
          },
          {
            title: "Resources",
            links: [
              { label: "Activity log", href: "/app/activity" },
              { label: "Settings", href: "/app/settings" },
              { label: "Features", href: "#features" },
              { label: "How it works", href: "#how-it-works" },
            ],
          },
        ].map((column) => (
          <div key={column.title}>
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{column.title}</p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-[12px] text-muted-foreground sm:px-6">
          <p>© {new Date().getFullYear()} Monievest. Demo product — simulated market data.</p>
          <p className="flex items-center gap-4">
            <span>Not investment advice</span>
            <span className="hidden sm:inline">·</span>
            <span>No real orders are placed</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
