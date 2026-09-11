"use client";

import Link from "next/link";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ChevronsUpDownIcon,
  MoreHorizontalIcon,
  StarIcon,
} from "lucide-react";
import * as React from "react";

import { LivePrice } from "@/components/shared/prices";
import { Sparkline } from "@/components/shared/sparkline";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney, formatPercent, formatShares } from "@/lib/format";
import type { Holding } from "@/lib/store/selectors";
import { usePortfolio } from "@/lib/store/provider";
import type { Activity, OrderSide } from "@/lib/store/types";
import { cn } from "@/lib/utils";

type SortKey = "name" | "date" | "volume" | "change" | "price";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Name Stock" },
  { key: "date", label: "Invest Date" },
  { key: "volume", label: "Volume", align: "right" },
  { key: "change", label: "Change", align: "right" },
  { key: "price", label: "Price/stock", align: "right" },
];

export type MyStockRow = Holding & { investedAt: number | null };

/**
 * Builds the "My Stock" rows: every open position plus the date it was first
 * bought, taken from the immutable activity ledger.
 */
export function buildMyStockRows(
  holdings: Holding[],
  activity: Pick<Activity, "type" | "symbol" | "createdAt">[],
): MyStockRow[] {
  const firstBuy = new Map<string, number>();
  for (const entry of activity) {
    if (entry.type !== "buy" || !entry.symbol) continue;
    const existing = firstBuy.get(entry.symbol);
    if (existing === undefined || entry.createdAt < existing) firstBuy.set(entry.symbol, entry.createdAt);
  }

  return holdings.map((holding) => ({
    ...holding,
    investedAt: firstBuy.get(holding.instrument.symbol) ?? null,
  }));
}

export function MyStockTable({
  rows,
  onTrade,
}: {
  rows: MyStockRow[];
  onTrade: (symbol: string, side: OrderSide) => void;
}) {
  const { state, toggleWatchlist } = usePortfolio();
  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({ key: "volume", dir: "desc" });

  const sorted = React.useMemo(() => {
    const value = (row: MyStockRow): number | string => {
      switch (sort.key) {
        case "name":
          return row.instrument.symbol;
        case "date":
          return row.investedAt ?? 0;
        case "volume":
          return row.qty;
        case "change":
          return row.unrealizedPnlPct;
        case "price":
          return row.price;
      }
    };

    return [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const cmp = typeof left === "string" && typeof right === "string" ? left.localeCompare(right) : Number(left) - Number(right);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort]);

  function toggle(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/70 hover:bg-transparent">
          {COLUMNS.map((column) => {
            const active = sort.key === column.key;
            return (
              <TableHead
                key={column.key}
                aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                className={cn("py-3 text-[11.5px] font-semibold text-muted-foreground", column.align === "right" && "text-right")}
              >
                <button
                  type="button"
                  onClick={() => toggle(column.key)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md transition-colors hover:text-foreground",
                    column.align === "right" && "flex-row-reverse",
                    active && "text-foreground",
                  )}
                >
                  {column.label}
                  <ChevronsUpDownIcon className={cn("size-3", active ? "opacity-90" : "opacity-45")} />
                </button>
              </TableHead>
            );
          })}
          <TableHead className="hidden w-[7.5rem] py-3 text-[11.5px] font-semibold text-right text-muted-foreground lg:table-cell">
            Trend
          </TableHead>
          <TableHead className="w-10 pr-3" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {sorted.map((row) => {
          const { instrument } = row;
          const watched = state.watchlist.includes(instrument.symbol);
          const up = row.unrealizedPnlPct >= 0;

          return (
            <TableRow key={instrument.symbol} className="group border-border/60">
              <TableCell className="py-3 pl-4">
                <Link href={`/app/stock/${instrument.symbol}`} className="flex items-center gap-3">
                  <StockAvatar symbol={instrument.symbol} size="md" tone="solid" className="rounded-full" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-semibold tracking-tight">{instrument.symbol}</span>
                      {watched && <StarIcon className="size-3 shrink-0 fill-warning text-warning" />}
                    </span>
                    <span className="block max-w-[12rem] truncate text-[11.5px] text-muted-foreground">
                      {instrument.name}
                    </span>
                  </span>
                </Link>
              </TableCell>

              <TableCell className="tnum py-3 text-[12.5px] text-muted-foreground">
                {row.investedAt ? formatDate(row.investedAt) : "—"}
              </TableCell>

              <TableCell className="tnum py-3 text-right text-[13px] font-medium">
                {formatShares(row.qty)}
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">sh</span>
              </TableCell>

              <TableCell className="py-3 text-right">
                <span
                  className={cn(
                    "tnum inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold",
                    up ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss",
                  )}
                  title={`${up ? "+" : "−"}${formatMoney(Math.abs(row.unrealizedPnl))} unrealised`}
                >
                  <span aria-hidden="true">{up ? "↑" : "↓"}</span>
                  {formatPercent(Math.abs(row.unrealizedPnlPct))}
                </span>
              </TableCell>

              <TableCell className="py-3 pr-4 text-right lg:pr-0">
                <LivePrice symbol={instrument.symbol} size="md" className="block" />
                <span className="tnum block text-[11px] text-muted-foreground">
                  {formatMoney(row.marketValue)} value
                </span>
              </TableCell>

              <TableCell className="hidden py-3 pr-4 lg:table-cell">
                <div className="flex justify-end">
                  <Sparkline data={row.spark.slice(-60)} width={92} height={28} />
                </div>
              </TableCell>

              <TableCell className="pr-3">
                <div className="flex items-center justify-end gap-0.5">
                  <div className="hidden items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-gain hover:bg-gain-soft hover:text-gain"
                      aria-label={`Buy ${instrument.symbol}`}
                      onClick={() => onTrade(instrument.symbol, "buy")}
                    >
                      <ArrowUpRightIcon className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-loss hover:bg-loss-soft hover:text-loss"
                      aria-label={`Sell ${instrument.symbol}`}
                      onClick={() => onTrade(instrument.symbol, "sell")}
                    >
                      <ArrowDownRightIcon className="size-4" />
                    </Button>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${instrument.symbol}`}>
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[11rem]">
                      <DropdownMenuItem onClick={() => onTrade(instrument.symbol, "buy")}>
                        <ArrowUpRightIcon />
                        Buy {instrument.symbol}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onTrade(instrument.symbol, "sell")}>
                        <ArrowDownRightIcon />
                        Sell {instrument.symbol}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => toggleWatchlist(instrument.symbol)}>
                        <StarIcon className={watched ? "fill-warning text-warning" : undefined} />
                        {watched ? "Remove from watchlist" : "Add to watchlist"}
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/app/stock/${instrument.symbol}`}>View details</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
