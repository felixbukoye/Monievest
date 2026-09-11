"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  Building2Icon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  InfoIcon,
  LayersIcon,
  NewspaperIcon,
  Share2Icon,
  StarIcon,
  Table2Icon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import * as React from "react";

import { useTrade } from "@/components/app/app-shell";
import { MarketStatus } from "@/components/app/market-status";
import { PriceChart, RangeSelector, type ChartStyle } from "@/components/charts/price-chart";
import { ChangeChip, LivePrice } from "@/components/shared/prices";
import { Sparkline } from "@/components/shared/sparkline";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { SimulatedBadge } from "@/components/shared/states";
import { TradeForm } from "@/components/trade/trade-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatCompactMoney,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatShares,
  formatVolume,
  relativeTime,
} from "@/lib/format";
import { CATALOG, getInstrument } from "@/lib/market/catalog";
import { getNews, sentimentLabel } from "@/lib/market/news";
import { RANGES, type Range } from "@/lib/market/types";
import { usePortfolio } from "@/lib/store/provider";
import { cn } from "@/lib/utils";
import { useMarket } from "@/components/market/market-provider";

export function StockView({ symbol }: { symbol: string }) {
  const instrument = getInstrument(symbol);
  const { quotes, ready } = useMarket();
  const { state, hydrated, toggleWatchlist } = usePortfolio();
  const { openTrade } = useTrade();

  const [range, setRange] = React.useState<Range>(state.settings.defaultRange as Range);
  const [style, setStyle] = React.useState<ChartStyle>("area");
  const [showVolume, setShowVolume] = React.useState(true);

  const quote = instrument ? quotes[instrument.symbol] : undefined;
  const position = state.positions.find((p) => p.symbol === instrument?.symbol);
  const orders = state.orders.filter((order) => order.symbol === instrument?.symbol);
  const watched = instrument ? state.watchlist.includes(instrument.symbol) : false;
  // Memoised on the symbol (a primitive) rather than the instrument object so
  // the compiler can prove the dependency is stable.
  const news = React.useMemo(() => {
    const found = getInstrument(symbol);
    return found ? getNews(found) : [];
  }, [symbol]);
  const peers = React.useMemo(() => {
    const found = getInstrument(symbol);
    if (!found) return [];
    return CATALOG.filter((item) => item.sector === found.sector && item.symbol !== found.symbol).slice(0, 5);
  }, [symbol]);

  // Guard placed after every hook so the hook order stays stable.
  if (!instrument) notFound();

  const price = quote?.price ?? instrument.price;
  const changePct = quote?.changePct ?? instrument.changePct;
  const dayLow = quote?.dayLow ?? instrument.week52Low;
  const dayHigh = quote?.dayHigh ?? instrument.week52High;

  const marketValue = position ? position.qty * price : 0;
  const costBasis = position ? position.qty * position.avgCost : 0;
  const unrealized = marketValue - costBasis;

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------- breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <Link href="/app" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          Dashboard
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <Link href="/app/markets" className="transition-colors hover:text-foreground">
          Markets
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <Link href={`/app/stock/${instrument.symbol}`} className="font-mono font-medium text-foreground">
          {instrument.symbol}
        </Link>
      </nav>

      {/* ------------------------------------------------------------ header */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-start gap-4">
            <StockAvatar symbol={instrument.symbol} size="lg" />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{instrument.name}</h1>
                <Badge variant="muted" className="font-mono">
                  {instrument.symbol}
                </Badge>
                {instrument.kind === "etf" && <Badge variant="default">ETF</Badge>}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2Icon className="size-3.5" />
                  {instrument.exchange}
                </span>
                <span>{instrument.sector}</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">{instrument.industry}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <LivePrice symbol={instrument.symbol} size="xl" showFlash={false} />
                <div className="mb-1 flex items-center gap-2">
                  <ChangeChip
                    value={quote?.change ?? price * (changePct / 100)}
                    pct={changePct}
                    size="md"
                  />
                  <span className="text-[12px] text-muted-foreground">
                    {quote ? `Updated ${new Date(quote.updatedAt).toLocaleTimeString()}` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <MarketStatus />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={watched ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => toggleWatchlist(instrument.symbol)}
              >
                <StarIcon className={watched ? "fill-current" : undefined} />
                {watched ? "Watching" : "Watch"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => openTrade(instrument.symbol, "sell")}
                disabled={!position}
                title={position ? `Sell ${instrument.symbol}` : "You don't hold this instrument"}
              >
                Sell
              </Button>
              <Button variant="glow" size="sm" className="h-9" onClick={() => openTrade(instrument.symbol, "buy")}>
                <ArrowUpRightIcon />
                Buy {instrument.symbol}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {instrument.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10.5px]">
                  {tag}
                </Badge>
              ))}
              <SimulatedBadge />
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- quick stats */}
        <div className="grid grid-cols-2 gap-px border-t bg-border/60 sm:grid-cols-3 lg:grid-cols-6">
          <QuickStat label="Open" value={formatMoney(quote?.open ?? instrument.price)} />
          <QuickStat label="Prev close" value={formatMoney(quote?.prevClose ?? instrument.price / (1 + instrument.changePct / 100))} />
          <QuickStat label="Market cap" value={formatCompactMoney(instrument.marketCap)} />
          <QuickStat label="P/E ratio" value={instrument.pe ? formatNumber(instrument.pe, 1) : "—"} />
          <QuickStat label="Dividend yield" value={instrument.dividendYield > 0 ? `${instrument.dividendYield.toFixed(2)}%` : "—"} />
          <QuickStat label="Volume" value={formatVolume(quote?.volume ?? instrument.avgVolume)} />
        </div>
      </Card>

      {/* ------------------------------------------------- chart + ticket */}
      <div className="grid gap-4 xl:grid-cols-[1.62fr_1fr]">
        <div className="space-y-4">
          <Card className="p-0">
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b p-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUpIcon className="size-4 text-primary" />
                  Price chart
                </CardTitle>
                <CardDescription>
                  Simulated history anchored to the reference price of {instrument.symbol}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg bg-muted/70 p-1">
                  {(["area", "line"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setStyle(option)}
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-all",
                        style === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <Button
                  variant={showVolume ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setShowVolume((value) => !value)}
                  disabled={range === "1D"}
                >
                  Volume
                </Button>
                <RangeSelector range={range} onChange={setRange} ranges={RANGES} size="sm" />
              </div>
            </CardHeader>
            <CardContent className="p-3">
              <PriceChart
                instrument={instrument}
                quote={quote}
                range={range}
                ready={ready}
                style={style}
                showVolume={showVolume && range !== "1D"}
                height={360}
                color={instrument.color}
              />
            </CardContent>

            <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
              <RangeBar
                label="Day range"
                low={dayLow}
                high={dayHigh}
                value={price}
                leftLabel={formatMoney(dayLow)}
                rightLabel={formatMoney(dayHigh)}
              />
              <RangeBar
                label="52-week range"
                low={instrument.week52Low}
                high={instrument.week52High}
                value={price}
                leftLabel={formatMoney(instrument.week52Low)}
                rightLabel={formatMoney(instrument.week52High)}
              />
            </div>
          </Card>

          {/* ---------------------------------------------------------- tabs */}
          <Card className="p-0">
            <Tabs defaultValue="overview" className="gap-0">
              <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b bg-transparent p-0">
                {[
                  { value: "overview", label: "Overview", icon: InfoIcon },
                  { value: "statistics", label: "Statistics", icon: Table2Icon },
                  { value: "position", label: "Your position", icon: LayersIcon },
                  { value: "news", label: "News", icon: NewspaperIcon },
                  { value: "peers", label: "Peers", icon: UsersIcon },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-11 flex-1 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 text-[12.5px] data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:flex-none"
                  >
                    <tab.icon className="hidden size-3.5 sm:block" />
                    {tab.label}
                    {tab.value === "position" && position && (
                      <span className="tnum rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                        {formatShares(position.qty)}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="p-5">
                <p className="max-w-3xl text-[14.5px] leading-relaxed text-muted-foreground">{instrument.about}</p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FactTile icon={Building2Icon} label="Headquarters" value={instrument.hq} />
                  <FactTile icon={UsersIcon} label="Employees" value={instrument.employees} />
                  <FactTile icon={CalendarIcon} label="Public since" value={String(instrument.ipoYear)} />
                  <FactTile icon={Share2Icon} label="Chief executive" value={instrument.ceo} />
                </div>

                <Separator className="my-6" />

                <div className="grid gap-4 sm:grid-cols-3">
                  <Highlight label="Beta" value={instrument.beta.toFixed(2)} hint="Volatility vs the market" />
                  <Highlight
                    label="EPS"
                    value={instrument.eps != null ? `$${instrument.eps.toFixed(2)}` : "—"}
                    hint="Trailing earnings per share"
                  />
                  <Highlight
                    label="Avg volume"
                    value={formatVolume(instrument.avgVolume)}
                    hint="Typical daily shares traded"
                  />
                </div>
              </TabsContent>

              <TabsContent value="statistics" className="p-5">
                <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Market cap", formatCompactMoney(instrument.marketCap)],
                    ["Shares outstanding", formatVolume(instrument.sharesOutstanding)],
                    ["Enterprise sector", instrument.sector],
                    ["Industry", instrument.industry],
                    ["P/E (trailing)", instrument.pe ? formatNumber(instrument.pe, 2) : "—"],
                    ["EPS (trailing)", instrument.eps != null ? formatMoney(instrument.eps) : "—"],
                    ["Dividend yield", instrument.dividendYield > 0 ? `${instrument.dividendYield.toFixed(2)}%` : "None"],
                    ["Beta (5y monthly)", instrument.beta.toFixed(2)],
                    ["52-week high", formatMoney(instrument.week52High)],
                    ["52-week low", formatMoney(instrument.week52Low)],
                    ["Day open", formatMoney(quote?.open ?? instrument.price)],
                    ["Previous close", formatMoney(quote?.prevClose ?? instrument.price)],
                    ["Average volume", formatVolume(instrument.avgVolume)],
                    ["Today's volume", formatVolume(quote?.volume ?? instrument.avgVolume)],
                    ["Exchange", instrument.exchange],
                    ["Instrument type", instrument.kind === "etf" ? "Exchange traded fund" : "Common stock"],
                    ["IPO year", String(instrument.ipoYear)],
                    ["Headquarters", instrument.hq],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2.5 text-[13px] last:border-0"
                    >
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="tnum text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="position" className="p-5">
                {!hydrated ? (
                  <Skeleton className="h-40 w-full rounded-lg" />
                ) : !position ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <span className="grid size-12 place-items-center rounded-xl border bg-muted/60 text-muted-foreground">
                      <LayersIcon className="size-5" />
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold">You don’t hold {instrument.symbol} yet</p>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        Use the order ticket to open a position. Fractional shares are supported, so you can start
                        with as little as a few dollars.
                      </p>
                    </div>
                    <Button variant="glow" onClick={() => openTrade(instrument.symbol, "buy")}>
                      <ArrowUpRightIcon />
                      Buy {instrument.symbol}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Metric label="Shares held" value={formatShares(position.qty)} />
                      <Metric label="Average cost" value={formatMoney(position.avgCost)} />
                      <Metric label="Market value" value={formatMoney(marketValue)} />
                      <Metric
                        label="Unrealised P&L"
                        value={`${unrealized >= 0 ? "+" : "−"}${formatMoney(Math.abs(unrealized))}`}
                        hint={formatPercent(costBasis > 0 ? (unrealized / costBasis) * 100 : 0)}
                        tone={unrealized >= 0 ? "gain" : "loss"}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="success" className="bg-gain text-gain-foreground hover:bg-gain/90" onClick={() => openTrade(instrument.symbol, "buy")}>
                        Buy more
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openTrade(instrument.symbol, "sell")}>
                        Sell shares
                      </Button>
                      <span className="text-[12px] text-muted-foreground">
                        Opened {formatDate(position.openedAt)} · cost basis {formatMoney(costBasis)}
                      </span>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Order history for {instrument.symbol}
                      </p>
                      {orders.length === 0 ? (
                        <p className="py-4 text-sm text-muted-foreground">No orders yet.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Placed</TableHead>
                              <TableHead>Side</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">Price</TableHead>
                              <TableHead className="text-right">Notional</TableHead>
                              <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {orders.slice(0, 8).map((order) => (
                              <TableRow key={order.id}>
                                <TableCell className="text-[12.5px] text-muted-foreground">
                                  {formatDateTime(order.createdAt)}
                                </TableCell>
                                <TableCell>
                                  <span className={cn("text-[12.5px] font-semibold capitalize", order.side === "buy" ? "text-gain" : "text-loss")}>
                                    {order.side}
                                  </span>
                                </TableCell>
                                <TableCell className="text-[12.5px] capitalize text-muted-foreground">{order.type}</TableCell>
                                <TableCell className="tnum text-right text-[12.5px]">{formatShares(order.qty)}</TableCell>
                                <TableCell className="tnum text-right text-[12.5px]">
                                  {formatMoney(order.filledPrice ?? order.limitPrice ?? 0)}
                                </TableCell>
                                <TableCell className="tnum text-right text-[12.5px]">{formatMoney(order.notional)}</TableCell>
                                <TableCell className="text-right">
                                  <Badge
                                    variant={
                                      order.status === "filled" ? "success" : order.status === "pending" ? "default" : "muted"
                                    }
                                    className="capitalize"
                                  >
                                    {order.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="news" className="p-5">
                <p className="mb-4 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-[12px] leading-snug text-muted-foreground">
                  <InfoIcon className="mt-px size-3.5 shrink-0" />
                  Headlines are generated locally to make the demo feel complete. They are fictional and must not be
                  read as news or investment advice.
                </p>
                <ul className="space-y-3">
                  {news.map((item) => (
                    <li key={item.id} className="rounded-xl border p-4 transition-colors hover:border-primary/40">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge
                          variant={
                            item.sentiment === "positive" ? "success" : item.sentiment === "negative" ? "destructive" : "muted"
                          }
                        >
                          {sentimentLabel(item.sentiment)}
                        </Badge>
                        <span className="font-medium text-foreground">{item.source}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="size-3" />
                          {relativeTime(item.publishedAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-[14.5px] font-semibold leading-snug tracking-tight">{item.headline}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{item.summary}</p>
                    </li>
                  ))}
                </ul>
              </TabsContent>

              <TabsContent value="peers" className="p-5">
                {peers.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">No peers listed in this category.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Last</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                        <TableHead className="hidden text-right md:table-cell">Market cap</TableHead>
                        <TableHead className="hidden text-right md:table-cell">P/E</TableHead>
                        <TableHead className="hidden text-right lg:table-cell">Div yield</TableHead>
                        <TableHead className="hidden w-[6rem] text-right lg:table-cell">Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {peers.map((peer) => (
                        <TableRow key={peer.symbol}>
                          <TableCell>
                            <Link href={`/app/stock/${peer.symbol}`} className="flex items-center gap-2.5">
                              <StockAvatar symbol={peer.symbol} size="sm" />
                              <span>
                                <span className="block font-mono text-[12.5px] font-semibold">{peer.symbol}</span>
                                <span className="block max-w-[12rem] truncate text-[11px] text-muted-foreground">
                                  {peer.name}
                                </span>
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">
                            <LivePrice symbol={peer.symbol} size="sm" showFlash={false} />
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex justify-end">
                              <ChangeChip pct={quotes[peer.symbol]?.changePct ?? peer.changePct} size="sm" showIcon={false} />
                            </span>
                          </TableCell>
                          <TableCell className="tnum hidden text-right text-[12.5px] text-muted-foreground md:table-cell">
                            {formatCompactMoney(peer.marketCap)}
                          </TableCell>
                          <TableCell className="tnum hidden text-right text-[12.5px] text-muted-foreground md:table-cell">
                            {peer.pe ? formatNumber(peer.pe, 1) : "—"}
                          </TableCell>
                          <TableCell className="tnum hidden text-right text-[12.5px] text-muted-foreground lg:table-cell">
                            {peer.dividendYield > 0 ? `${peer.dividendYield.toFixed(2)}%` : "—"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex justify-end">
                              <Sparkline
                                data={(quotes[peer.symbol]?.intraday ?? []).slice(-40).map((p) => p.p)}
                                width={72}
                                height={24}
                                fill={false}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* ------------------------------------------------------ right rail */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Order ticket</CardTitle>
              <CardDescription>Buy or sell {instrument.symbol} instantly</CardDescription>
            </CardHeader>
            <CardContent>
              <TradeForm key={instrument.symbol} symbol={instrument.symbol} initialSide="buy" layout="card" />
            </CardContent>
          </Card>

          {position && hydrated && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-[15px]">Your position</CardTitle>
                <CardDescription>
                  Opened {relativeTime(position.openedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Market value
                    </p>
                    <p className="tnum text-2xl font-semibold tracking-tight">{formatMoney(marketValue)}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("tnum text-sm font-semibold", unrealized >= 0 ? "text-gain" : "text-loss")}>
                      {unrealized >= 0 ? "+" : "−"}
                      {formatMoney(Math.abs(unrealized))}
                    </p>
                    <p className={cn("tnum text-[11.5px]", unrealized >= 0 ? "text-gain" : "text-loss")}>
                      {formatPercent(costBasis > 0 ? (unrealized / costBasis) * 100 : 0)}
                    </p>
                  </div>
                </div>

                <Separator />

                <dl className="space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Shares</dt>
                    <dd className="tnum font-medium">{formatShares(position.qty)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Average cost</dt>
                    <dd className="tnum font-medium">{formatMoney(position.avgCost)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cost basis</dt>
                    <dd className="tnum font-medium">{formatMoney(costBasis)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Open orders</dt>
                    <dd className="tnum font-medium">{orders.filter((o) => o.status === "pending").length}</dd>
                  </div>
                </dl>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openTrade(instrument.symbol, "sell")}>
                    Sell
                  </Button>
                  <Button size="sm" className="flex-1 bg-gain text-gain-foreground hover:bg-gain/90" onClick={() => openTrade(instrument.symbol, "buy")}>
                    Buy more
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="p-0">
            <CardHeader className="border-b p-4">
              <CardTitle className="text-[15px]">More in {instrument.sector}</CardTitle>
            </CardHeader>
            <ul className="divide-y divide-border/60">
              {peers.slice(0, 4).map((peer) => (
                <li key={peer.symbol}>
                  <Link
                    href={`/app/stock/${peer.symbol}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50"
                  >
                    <StockAvatar symbol={peer.symbol} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[12.5px] font-semibold">{peer.symbol}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{peer.name}</p>
                    </div>
                    <span
                      className={cn(
                        "tnum text-[12px] font-semibold",
                        (quotes[peer.symbol]?.changePct ?? peer.changePct) >= 0 ? "text-gain" : "text-loss",
                      )}
                    >
                      {formatPercent(quotes[peer.symbol]?.changePct ?? peer.changePct)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="tnum mt-0.5 text-[13.5px] font-semibold">{value}</p>
    </div>
  );
}

function RangeBar({
  label,
  low,
  high,
  value,
  leftLabel,
  rightLabel,
}: {
  label: string;
  low: number;
  high: number;
  value: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const position = Math.min(Math.max(((value - low) / (high - low || 1)) * 100, 1), 99);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
        <span className="tnum text-[12px] font-medium">{formatMoney(value)}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted">
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-primary/40 to-primary"
          style={{ left: 0, width: `${position}%` }}
        />
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="tnum mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function FactTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2Icon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/25 p-3.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        <Icon className="size-3.5" />
        {label}
      </span>
      <p className="mt-1 text-[13.5px] font-medium">{value}</p>
    </div>
  );
}

function Highlight({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="tnum mt-1 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="rounded-xl border bg-muted/25 p-3.5">
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className={cn("tnum mt-1 text-lg font-semibold tracking-tight", tone === "gain" && "text-gain", tone === "loss" && "text-loss")}>
        {value}
      </p>
      {hint && <p className="tnum text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
