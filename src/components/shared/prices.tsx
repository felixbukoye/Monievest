"use client";

import { TrendingDownIcon, TrendingUpIcon, MinusIcon } from "lucide-react";
import * as React from "react";

import { useMarket } from "@/components/market/market-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatPercent, formatSignedMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Adds a short background flash whenever a value moves — the "live board" feel. */
export function useFlash(value: number | null | undefined, enabled = true) {
  const previous = React.useRef(value);
  const [tone, setTone] = React.useState<"up" | "down" | null>(null);

  React.useEffect(() => {
    if (!enabled || value == null || previous.current == null) {
      previous.current = value ?? previous.current;
      return;
    }
    if (value > previous.current) setTone("up");
    else if (value < previous.current) setTone("down");
    previous.current = value;

    const id = window.setTimeout(() => setTone(null), 700);
    return () => window.clearTimeout(id);
  }, [value, enabled]);

  return tone ? (tone === "up" ? "flash-up" : "flash-down") : undefined;
}

export function LivePrice({
  symbol,
  className,
  size = "md",
  showFlash = true,
}: {
  symbol: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showFlash?: boolean;
}) {
  const { quote, ready } = useMarket();
  const q = quote(symbol);
  const flash = useFlash(q?.price ?? null, ready && showFlash && size !== "xl");

  const sizeClass = {
    sm: "text-[13px]",
    md: "text-sm",
    lg: "text-base",
    xl: "text-3xl sm:text-4xl",
  }[size];

  if (!ready || !q) {
    return <Skeleton className={cn("h-4 w-16 rounded", size === "xl" && "h-10 w-32", className)} />;
  }

  return (
    <span className={cn("tnum font-semibold tracking-tight rounded-sm px-0.5", sizeClass, flash, className)}>
      {formatMoney(q.price)}
    </span>
  );
}

export function ChangeChip({
  value,
  pct,
  className,
  showIcon = true,
  size = "md",
}: {
  value?: number;
  pct?: number;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}) {
  const reference = pct ?? value ?? 0;
  const tone = reference > 0.000001 ? "gain" : reference < -0.000001 ? "loss" : "muted";
  const Icon = tone === "gain" ? TrendingUpIcon : tone === "loss" ? TrendingDownIcon : MinusIcon;

  return (
    <span
      className={cn(
        "tnum inline-flex items-center gap-1 rounded-md font-semibold whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        tone === "gain" && "bg-gain-soft text-gain",
        tone === "loss" && "bg-loss-soft text-loss",
        tone === "muted" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {showIcon && <Icon className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={2.4} />}
      {pct !== undefined ? (
        <span>{formatPercent(pct)}</span>
      ) : (
        <span>{formatSignedMoney(value ?? 0)}</span>
      )}
    </span>
  );
}

export function LiveChange({ symbol, className }: { symbol: string; className?: string }) {
  const { quote, ready } = useMarket();
  const q = quote(symbol);
  if (!ready || !q) return <Skeleton className={cn("h-5 w-16 rounded-md", className)} />;
  return <ChangeChip pct={q.changePct} className={className} />;
}

/** Money value that only renders after localStorage hydration, avoiding flashes. */
export function Money({
  value,
  ready,
  className,
  decimals = true,
  skeletonWidth = "w-20",
}: {
  value: number;
  ready: boolean;
  className?: string;
  decimals?: boolean;
  skeletonWidth?: string;
}) {
  if (!ready) return <Skeleton className={cn("h-4 rounded", skeletonWidth, className)} />;
  return <span className={cn("tnum font-semibold tracking-tight", className)}>{formatMoney(value, { decimals })}</span>;
}
