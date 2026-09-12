"use client";

import Link from "next/link";
import { ArrowDownRightIcon, ArrowUpRightIcon, MoreHorizontalIcon, StarIcon } from "lucide-react";
import * as React from "react";

import { Sparkline } from "@/components/shared/sparkline";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompactMoney, formatMoney, formatPercent, formatShares } from "@/lib/format";
import type { Holding } from "@/lib/store/selectors";
import { usePortfolio } from "@/lib/store/provider";
import type { OrderSide } from "@/lib/store/types";
import { cn } from "@/lib/utils";

export function HoldingsTable({
  holdings,
  onTrade,
  variant = "full",
  emptyMessage = "No positions yet",
}: {
  holdings: Holding[];
  onTrade: (symbol: string, side: OrderSide) => void;
  variant?: "full" | "compact";
  emptyMessage?: string;
}) {
  const { state, toggleWatchlist } = usePortfolio();

  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-xl border bg-muted/60 text-muted-foreground">
          <ArrowUpRightIcon className="size-5" />
        </span>
        <div>
          <p className="text-[15px] font-semibold">{emptyMessage}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Head to Markets, pick an instrument and place your first order. Fractional shares are supported.
          </p>
        </div>
        <Button asChild variant="default" className="mt-1">
          <Link href="/app/markets">Browse markets</Link>
        </Button>
      </div>
    );
  }

  const compact = variant === "compact";

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">Instrument</TableHead>
          <TableHead className="text-right">Last</TableHead>
          <TableHead className="text-right">Day</TableHead>
          {!compact && <TableHead className="hidden text-right md:table-cell">Qty</TableHead>}
          {!compact && <TableHead className="hidden text-right lg:table-cell">Avg cost</TableHead>}
          <TableHead className="text-right">Value</TableHead>
          {!compact && <TableHead className="hidden text-right xl:table-cell">Day P&amp;L</TableHead>}
          <TableHead className="text-right">Total P&amp;L</TableHead>
          {!compact && <TableHead className="hidden w-[9.5rem] xl:table-cell">Weight</TableHead>}
          <TableHead className="hidden w-[6.5rem] pr-4 text-right lg:table-cell">Trend</TableHead>
          <TableHead className="w-10 pr-3" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {holdings.map((holding) => {
          const { instrument } = holding;
          const watched = state.watchlist.includes(instrument.symbol);
          const totalUp = holding.unrealizedPnl >= 0;
          const dayUp = holding.dayChange >= 0;

          return (
            <TableRow key={instrument.symbol} className="group">
              <TableCell className="pl-4">
                <Link href={`/app/stock/${instrument.symbol}`} className="flex items-center gap-2.5">
                  <StockAvatar symbol={instrument.symbol} size="sm" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-[13px] font-semibold">{instrument.symbol}</span>
                      {watched && <StarIcon className="size-3 fill-warning text-warning" />}
                      {instrument.kind === "etf" && (
                        <Badge variant="muted" className="px-1 py-0 text-[9px]">
                          ETF
                        </Badge>
                      )}
                    </span>
                    <span className="block max-w-[11rem] truncate text-[11.5px] text-muted-foreground">
                      {instrument.name}
                    </span>
                  </span>
                </Link>
              </TableCell>

              <TableCell className="tnum text-right text-[13px] font-medium">{formatMoney(holding.price)}</TableCell>

              <TableCell className="text-right">
                <span className={cn("tnum text-[12.5px] font-semibold", dayUp ? "text-gain" : "text-loss")}>
                  {formatPercent(holding.dayChangePct)}
                </span>
              </TableCell>

              {!compact && (
                <TableCell className="tnum hidden text-right text-[13px] text-muted-foreground md:table-cell">
                  {formatShares(holding.qty)}
                </TableCell>
              )}
              {!compact && (
                <TableCell className="tnum hidden text-right text-[13px] text-muted-foreground lg:table-cell">
                  {formatMoney(holding.avgCost)}
                </TableCell>
              )}

              <TableCell className="tnum text-right text-[13px] font-semibold">
                {compact ? formatCompactMoney(holding.marketValue) : formatMoney(holding.marketValue)}
              </TableCell>

              {!compact && (
                <TableCell className="tnum hidden text-right text-[12.5px] xl:table-cell">
                  <span className={dayUp ? "text-gain" : "text-loss"}>
                    {dayUp ? "+" : "−"}
                    {formatMoney(Math.abs(holding.dayChange))}
                  </span>
                </TableCell>
              )}

              <TableCell className="text-right">
                <div className="flex flex-col items-end">
                  <span className={cn("tnum text-[13px] font-semibold", totalUp ? "text-gain" : "text-loss")}>
                    {totalUp ? "+" : "−"}
                    {formatMoney(Math.abs(holding.unrealizedPnl))}
                  </span>
                  <span className={cn("tnum text-[11px]", totalUp ? "text-gain/80" : "text-loss/80")}>
                    {formatPercent(holding.unrealizedPnlPct)}
                  </span>
                </div>
              </TableCell>

              {!compact && (
                <TableCell className="hidden xl:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(holding.weight, 100)}%`, background: instrument.color }}
                      />
                    </div>
                    <span className="tnum text-[11.5px] text-muted-foreground">{holding.weight.toFixed(1)}%</span>
                  </div>
                </TableCell>
              )}

              <TableCell className="hidden pr-4 lg:table-cell">
                <div className="flex justify-end">
                  <Sparkline data={holding.spark.slice(-60)} width={88} height={28} />
                </div>
              </TableCell>

              <TableCell className="pr-3">
                <div className="flex items-center justify-end gap-1">
                  <div className="hidden items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
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
                      disabled={holding.qty <= 0}
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
                      <DropdownMenuItem onClick={() => onTrade(instrument.symbol, "sell")} disabled={holding.qty <= 0}>
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
