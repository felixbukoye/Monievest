"use client";

import Link from "next/link";
import { ArrowUpDownIcon, ListFilterIcon, SearchIcon, SlidersHorizontalIcon, StarIcon } from "lucide-react";
import * as React from "react";

import { useTrade } from "@/components/app/app-shell";
import { useMarket } from "@/components/market/market-provider";
import { ChangeChip, LivePrice } from "@/components/shared/prices";
import { Sparkline } from "@/components/shared/sparkline";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompactMoney, formatMoney, formatNumber, formatVolume } from "@/lib/format";
import { CATALOG, SECTORS } from "@/lib/market/catalog";
import type { Instrument } from "@/lib/market/types";
import { usePortfolio } from "@/lib/store/provider";
import { cn } from "@/lib/utils";

type SortKey = "symbol" | "price" | "change" | "marketCap" | "volume" | "dividend";
type KindFilter = "all" | "stock" | "etf";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "symbol", label: "Symbol" },
  { id: "change", label: "% change" },
  { id: "price", label: "Price" },
  { id: "marketCap", label: "Market cap" },
  { id: "volume", label: "Volume" },
  { id: "dividend", label: "Dividend yield" },
];

/** Clickable column header wired to the sort state. */
function SortableHead({
  label,
  sortKey,
  sort,
  ascending,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  ascending: boolean;
  onSort: (key: SortKey) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const active = sort === sortKey;
  return (
    <TableHead
      className={cn(align === "right" ? "text-right" : "text-left", className)}
      aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        className={cn(
          "inline-flex items-center gap-1 rounded transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
        {active ? (
          <span className="text-[9px] leading-none">{ascending ? "\u25B2" : "\u25BC"}</span>
        ) : (
          <ArrowUpDownIcon className="size-3 opacity-45" />
        )}
      </button>
    </TableHead>
  );
}

export function MarketsView() {
  const { quotes, ready } = useMarket();
  const { state, toggleWatchlist } = usePortfolio();
  const { openTrade } = useTrade();

  const [query, setQuery] = React.useState("");
  const [sector, setSector] = React.useState<string>("all");
  const [kind, setKind] = React.useState<KindFilter>("all");
  const [sort, setSort] = React.useState<SortKey>("change");
  const [ascending, setAscending] = React.useState(false);
  const [watchlistOnly, setWatchlistOnly] = React.useState(false);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = CATALOG.filter((instrument) => {
      if (kind !== "all" && instrument.kind !== kind) return false;
      if (sector !== "all" && instrument.sector !== sector) return false;
      if (watchlistOnly && !state.watchlist.includes(instrument.symbol)) return false;
      if (!q) return true;
      return (
        instrument.symbol.toLowerCase().includes(q) ||
        instrument.name.toLowerCase().includes(q) ||
        instrument.industry.toLowerCase().includes(q) ||
        instrument.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });

    const valueOf = (instrument: Instrument): number => {
      const quote = quotes[instrument.symbol];
      switch (sort) {
        case "price":
          return quote?.price ?? instrument.price;
        case "change":
          return quote?.changePct ?? instrument.changePct;
        case "marketCap":
          return instrument.marketCap;
        case "volume":
          return quote?.volume ?? instrument.avgVolume;
        case "dividend":
          return instrument.dividendYield;
        default:
          return 0;
      }
    };

    list = [...list].sort((a, b) => {
      if (sort === "symbol") {
        return ascending ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
      }
      return ascending ? valueOf(a) - valueOf(b) : valueOf(b) - valueOf(a);
    });

    return list;
  }, [query, sector, kind, sort, ascending, watchlistOnly, state.watchlist, quotes]);

  function toggleSort(key: SortKey) {
    if (key === sort) setAscending((value) => !value);
    else {
      setSort(key);
      setAscending(key === "symbol");
    }
  }

  const advancing = rows.filter((row) => (quotes[row.symbol]?.changePct ?? row.changePct) > 0).length;
  const declining = rows.filter((row) => (quotes[row.symbol]?.changePct ?? row.changePct) < 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Markets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {CATALOG.length} simulated instruments ·{" "}
            <span className="text-gain">{advancing} advancing</span> ·{" "}
            <span className="text-loss">{declining} declining</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={advancing >= declining ? "success" : "destructive"} className="gap-1.5">
            <ArrowUpDownIcon className="size-3" />
            Breadth {advancing >= declining ? "positive" : "negative"}
          </Badge>
        </div>
      </div>

      {/* --------------------------------------------------------- filters */}
      <Card className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[13rem] flex-1">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by symbol, company, industry or theme…"
              className="h-10 pl-9"
              aria-label="Filter instruments"
            />
          </div>

          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger className="h-10 w-[11.5rem]" aria-label="Filter by sector">
              <SlidersHorizontalIcon className="size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sectors</SelectItem>
              {SECTORS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={kind} onValueChange={(value) => setKind(value as KindFilter)}>
            <SelectTrigger className="h-10 w-[8rem]" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="stock">Stocks</SelectItem>
              <SelectItem value="etf">ETFs</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger className="h-10 w-[10.5rem]" aria-label="Sort by">
              <ListFilterIcon className="size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  Sort: {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={ascending ? "default" : "outline"}
            size="sm"
            className="h-10"
            onClick={() => setAscending((value) => !value)}
            aria-label="Toggle sort direction"
          >
            <ArrowUpDownIcon />
            {ascending ? "Asc" : "Desc"}
          </Button>

          <Button
            variant={watchlistOnly ? "default" : "outline"}
            size="sm"
            className="h-10"
            onClick={() => setWatchlistOnly((value) => !value)}
          >
            <StarIcon className={watchlistOnly ? "fill-current" : undefined} />
            Watchlist
          </Button>
        </div>

        {(query || sector !== "all" || kind !== "all" || watchlistOnly) && (
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
            <span>
              Showing <span className="font-semibold text-foreground">{rows.length}</span> of {CATALOG.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11.5px]"
              onClick={() => {
                setQuery("");
                setSector("all");
                setKind("all");
                setWatchlistOnly(false);
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </Card>

      {/* ---------------------------------------------------------- table */}
      <Card className="overflow-hidden p-0">
        {!ready ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-xl border bg-muted/60 text-muted-foreground">
              <SearchIcon className="size-5" />
            </span>
            <p className="text-[15px] font-semibold">Nothing matches those filters</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Try a different sector, clear the search box, or switch back to “All types”.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setSector("all");
                setKind("all");
                setWatchlistOnly(false);
              }}
            >
              Reset filters
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead label="Instrument" sortKey="symbol" className="pl-4" sort={sort} ascending={ascending} onSort={toggleSort} />
                <TableHead className="hidden lg:table-cell">Sector</TableHead>
                <SortableHead label="Last" sortKey="price" align="right" sort={sort} ascending={ascending} onSort={toggleSort} />
                <SortableHead label="Change" sortKey="change" align="right" sort={sort} ascending={ascending} onSort={toggleSort} />
                <TableHead className="hidden w-[8.5rem] xl:table-cell">Day range</TableHead>
                <SortableHead label="Market cap" sortKey="marketCap" align="right" className="hidden md:table-cell" sort={sort} ascending={ascending} onSort={toggleSort} />
                <TableHead className="hidden text-right lg:table-cell">P/E</TableHead>
                <SortableHead label="Div yield" sortKey="dividend" align="right" className="hidden lg:table-cell" sort={sort} ascending={ascending} onSort={toggleSort} />
                <SortableHead label="Volume" sortKey="volume" align="right" className="hidden xl:table-cell" sort={sort} ascending={ascending} onSort={toggleSort} />
                <TableHead className="hidden w-[6rem] pr-2 text-right lg:table-cell">Trend</TableHead>
                <TableHead className="w-[5.5rem] pr-3 text-right">Trade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((instrument) => {
                const quote = quotes[instrument.symbol];
                const watched = state.watchlist.includes(instrument.symbol);
                const pct = quote?.changePct ?? instrument.changePct;
                const low = quote?.dayLow ?? instrument.week52Low;
                const high = quote?.dayHigh ?? instrument.week52High;
                const price = quote?.price ?? instrument.price;
                const position = Math.min(Math.max(((price - low) / (high - low || 1)) * 100, 2), 98);

                return (
                  <TableRow key={instrument.symbol} className="group">
                    <TableCell className="pl-4">
                      <Link href={`/app/stock/${instrument.symbol}`} className="flex items-center gap-2.5">
                        <StockAvatar symbol={instrument.symbol} size="sm" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="font-mono text-[13px] font-semibold">{instrument.symbol}</span>
                            {instrument.kind === "etf" && (
                              <Badge variant="muted" className="px-1 py-0 text-[9px]">
                                ETF
                              </Badge>
                            )}
                          </span>
                          <span className="block max-w-[13rem] truncate text-[11.5px] text-muted-foreground">
                            {instrument.name}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleWatchlist(instrument.symbol);
                          }}
                          aria-label={watched ? `Remove ${instrument.symbol} from watchlist` : `Add ${instrument.symbol} to watchlist`}
                          className={cn(
                            "rounded-md p-1 transition-colors",
                            watched ? "text-warning" : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-warning",
                          )}
                        >
                          <StarIcon className={cn("size-4", watched && "fill-current")} />
                        </button>
                      </Link>
                    </TableCell>

                    <TableCell className="hidden text-[12.5px] text-muted-foreground lg:table-cell">
                      {instrument.sector}
                    </TableCell>

                    <TableCell className="text-right">
                      <LivePrice symbol={instrument.symbol} size="sm" />
                    </TableCell>

                    <TableCell className="text-right">
                      <span className="inline-flex justify-end">
                        <ChangeChip pct={pct} size="sm" showIcon={false} />
                      </span>
                    </TableCell>

                    <TableCell className="hidden xl:table-cell">
                      <div className="space-y-1">
                        <div className="relative h-1.5 rounded-full bg-muted">
                          <span className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-card bg-primary" style={{ left: `calc(${position}% - 5px)` }} />
                        </div>
                        <div className="tnum flex justify-between text-[10px] text-muted-foreground">
                          <span>{formatMoney(low, { decimals: false })}</span>
                          <span>{formatMoney(high, { decimals: false })}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="tnum hidden text-right text-[12.5px] text-muted-foreground md:table-cell">
                      {formatCompactMoney(instrument.marketCap)}
                    </TableCell>
                    <TableCell className="tnum hidden text-right text-[12.5px] text-muted-foreground lg:table-cell">
                      {instrument.pe ? formatNumber(instrument.pe, 1) : "—"}
                    </TableCell>
                    <TableCell className="tnum hidden text-right text-[12.5px] text-muted-foreground lg:table-cell">
                      {instrument.dividendYield > 0 ? `${instrument.dividendYield.toFixed(2)}%` : "—"}
                    </TableCell>
                    <TableCell className="tnum hidden text-right text-[12.5px] text-muted-foreground xl:table-cell">
                      {formatVolume(quote?.volume ?? instrument.avgVolume)}
                    </TableCell>

                    <TableCell className="hidden pr-2 lg:table-cell">
                      <div className="flex justify-end">
                        <Sparkline
                          data={(quote?.intraday ?? []).slice(-40).map((point) => point.p)}
                          width={72}
                          height={26}
                          fill={false}
                        />
                      </div>
                    </TableCell>

                    <TableCell className="pr-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2.5 text-[11.5px]"
                        onClick={() => openTrade(instrument.symbol, "buy")}
                      >
                        Buy
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <p className="text-center text-[11.5px] text-muted-foreground">
        Prices are generated by a local random-walk simulator calibrated to each instrument’s volatility.
        Nothing on this page is a real quote or investment advice.
      </p>
    </div>
  );
}
