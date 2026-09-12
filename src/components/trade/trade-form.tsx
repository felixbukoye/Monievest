"use client";

import { AlertTriangleIcon, ArrowDownRightIcon, ArrowUpRightIcon, InfoIcon, ZapIcon } from "lucide-react";
import * as React from "react";

import { useMarket } from "@/components/market/market-provider";
import { ChangeChip, LivePrice } from "@/components/shared/prices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney, formatShares } from "@/lib/format";
import { getInstrument } from "@/lib/market/catalog";
import { usePortfolio } from "@/lib/store/provider";
import type { OrderSide, OrderType } from "@/lib/store/types";
import { cn } from "@/lib/utils";

const QUICK_ALLOCATIONS = [0.25, 0.5, 0.75, 1];

export type TradeFormProps = {
  symbol: string;
  initialSide?: OrderSide;
  /** Called after a successful submission. */
  onDone?: () => void;
  layout?: "dialog" | "card";
  className?: string;
};

/**
 * The order ticket. Used inside the global trade dialog and inline on the
 * stock detail page, so the buying experience is identical everywhere.
 */
export function TradeForm({ symbol, initialSide = "buy", onDone, layout = "card", className }: TradeFormProps) {
  const instrument = getInstrument(symbol);
  const { state, placeOrder } = usePortfolio();
  const { quote, ready } = useMarket();

  const [side, setSide] = React.useState<OrderSide>(initialSide);
  const [orderType, setOrderType] = React.useState<OrderType>("market");
  const [qtyInput, setQtyInput] = React.useState("");
  const [limitInput, setLimitInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const q = quote(symbol);
  const marketPrice = q?.price ?? instrument?.price ?? 0;
  const position = state.positions.find((p) => p.symbol === symbol);
  const held = position?.qty ?? 0;

  // Reset the ticket when it is pointed at a different instrument or side.
  // Derived during render so no extra render pass is scheduled.
  const resetKey = `${symbol}:${initialSide}`;
  const [prevResetKey, setPrevResetKey] = React.useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setSide(initialSide);
    setOrderType("market");
    setQtyInput("");
    setError(null);
    if (instrument) setLimitInput(instrument.price.toFixed(2));
  }

  if (!instrument) {
    return (
      <p className={cn("p-4 text-sm text-muted-foreground", className)}>
        Unknown instrument “{symbol}”.
      </p>
    );
  }

  const qty = Number.parseFloat(qtyInput);
  const validQty = Number.isFinite(qty) && qty > 0 ? qty : 0;
  const limitPrice = Number.parseFloat(limitInput);
  const executionPrice = orderType === "limit" && Number.isFinite(limitPrice) && limitPrice > 0 ? limitPrice : marketPrice;
  const estimatedTotal = validQty * executionPrice;

  const maxQty = side === "buy" ? (executionPrice > 0 ? state.cash / executionPrice : 0) : held;

  function setAllocation(fraction: number) {
    if (maxQty <= 0) return;
    const value = maxQty * fraction;
    setQtyInput(value >= 10 ? value.toFixed(2) : value >= 1 ? value.toFixed(4) : value.toFixed(6));
  }

  function submit() {
    if (validQty <= 0) {
      setError("Enter a quantity to continue.");
      return;
    }
    if (side === "buy" && estimatedTotal > state.cash) {
      setError(`Order exceeds your buying power of ${formatMoney(state.cash)}.`);
      return;
    }
    if (side === "sell" && validQty > held) {
      setError(`You hold ${formatShares(held)} ${symbol} shares.`);
      return;
    }
    setSubmitting(true);
    const result = placeOrder({
      symbol,
      side,
      type: orderType,
      qty: validQty,
      limitPrice: orderType === "limit" ? executionPrice : null,
      marketPrice,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.reason ?? "Order could not be placed.");
      return;
    }
    setError(null);
    setQtyInput("");
    onDone?.();
  }

  return (
    <div className={cn("space-y-4", className)}>
      {layout === "card" && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LivePrice symbol={symbol} size="lg" />
            <ChangeChip pct={q?.changePct ?? instrument.changePct} size="sm" />
          </div>
          {held > 0 && (
            <p className="tnum text-[11.5px] text-muted-foreground">You own {formatShares(held)}</p>
          )}
        </div>
      )}

      <Tabs value={side} onValueChange={(value) => setSide(value as OrderSide)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="buy" className={cn(side === "buy" && "text-gain")}>
            <ArrowUpRightIcon />
            Buy
          </TabsTrigger>
          <TabsTrigger value="sell" className={cn(side === "sell" && "text-loss")}>
            <ArrowDownRightIcon />
            Sell
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`qty-${symbol}-${layout}`}>Quantity</Label>
          <span className="tnum text-[11.5px] text-muted-foreground">
            {side === "buy" ? `${formatMoney(state.cash)} available` : `${formatShares(held)} held`}
          </span>
        </div>
        <Input
          id={`qty-${symbol}-${layout}`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={qtyInput}
          onChange={(event) => {
            setQtyInput(event.target.value.replace(/[^0-9.]/g, ""));
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          className="tnum h-11 text-base font-semibold"
        />
        <div className="flex gap-1.5">
          {QUICK_ALLOCATIONS.map((fraction) => (
            <Button
              key={fraction}
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 flex-1 text-[11px]"
              disabled={maxQty <= 0}
              onClick={() => setAllocation(fraction)}
            >
              {fraction === 1 ? "Max" : `${fraction * 100}%`}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Order type</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { id: "market", label: "Market", hint: "Fill immediately", icon: ZapIcon },
              { id: "limit", label: "Limit", hint: "Fill at your price", icon: InfoIcon },
            ] as const
          ).map((option) => {
            const active = orderType === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setOrderType(option.id)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-all",
                  active
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-background/40 hover:border-muted-foreground/40",
                )}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <option.icon className="size-3.5" />
                  {option.label}
                </span>
                <span className="text-[11px] text-muted-foreground">{option.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {orderType === "limit" && (
        <div className="space-y-2">
          <Label htmlFor={`limit-${symbol}-${layout}`}>Limit price</Label>
          <Input
            id={`limit-${symbol}-${layout}`}
            inputMode="decimal"
            autoComplete="off"
            value={limitInput}
            onChange={(event) => {
              setLimitInput(event.target.value.replace(/[^0-9.]/g, ""));
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            className="tnum h-10 text-base font-semibold"
          />
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
            <InfoIcon className="mt-px size-3 shrink-0" />
            {side === "buy"
              ? "Buys when price falls to or below your limit."
              : "Sells when price rises to or above your limit."}{" "}
            {state.settings.autoFillLimits ? "Fills automatically." : "Auto-fill is off in Settings."}
          </p>
        </div>
      )}

      <Separator />

      <dl className="space-y-2 text-sm">
        <TicketRow label="Estimated price" value={formatMoney(executionPrice)} />
        <TicketRow label="Quantity" value={`${formatShares(validQty)} ${symbol}`} />
        <TicketRow
          label={side === "buy" ? "Estimated cost" : "Estimated proceeds"}
          value={formatMoney(estimatedTotal)}
          emphasis
        />
        {side === "sell" && position && validQty > 0 && (
          <TicketRow
            label="Estimated gain / loss"
            value={`${estimatedTotal - position.avgCost * validQty >= 0 ? "+" : "−"}${formatMoney(
              Math.abs(estimatedTotal - position.avgCost * validQty),
            )}`}
            tone={estimatedTotal - position.avgCost * validQty >= 0 ? "gain" : "loss"}
          />
        )}
        <TicketRow label="Commission" value={<span className="text-gain">$0.00</span>} />
      </dl>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-loss/30 bg-loss-soft px-3 py-2 text-xs font-medium text-loss">
          <AlertTriangleIcon className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}

      <Button
        size="lg"
        className={cn(
          "w-full",
          side === "buy" ? "bg-gain text-gain-foreground hover:bg-gain/90" : "bg-loss text-loss-foreground hover:bg-loss/90",
        )}
        onClick={submit}
        disabled={!ready || submitting}
      >
        {side === "buy" ? <ArrowUpRightIcon /> : <ArrowDownRightIcon />}
        {orderType === "limit"
          ? `Place ${side} order`
          : side === "buy"
            ? `Buy ${symbol}`
            : `Sell ${symbol}`}
      </Button>

      <p className="text-center text-[11px] leading-snug text-muted-foreground">
        Simulated execution · no real money or securities involved
      </p>
    </div>
  );
}

export function TicketRow({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={cn("text-muted-foreground", emphasis && "font-medium text-foreground")}>{label}</dt>
      <dd
        className={cn(
          "tnum text-right",
          emphasis ? "text-base font-semibold tracking-tight" : "font-medium",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-loss",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
