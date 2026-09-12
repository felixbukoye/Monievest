"use client";

import * as React from "react";
import { useMarket } from "@/components/market/market-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MarketStatus({ className, showLabel = true }: { className?: string; showLabel?: boolean }) {
  const { session, ready, lastTickAt, source, providerLabel, liveUpdatedAt, liveError } = useMarket();
  const [now, setNow] = React.useState<string>("");

  React.useEffect(() => {
    const update = () =>
      setNow(
        new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
      );
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  const live = source === "live";
  const stale = live && Boolean(liveError);

  const title = !ready
    ? "Booting market data"
    : live
      ? stale
        ? `Live prices via ${providerLabel} — last update failed: ${liveError}`
        : `Real prices via ${providerLabel} · updated ${new Date(liveUpdatedAt).toLocaleTimeString()}`
      : `Simulated prices · last tick ${new Date(lastTickAt).toLocaleTimeString()}`;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-border/80 bg-muted/50 py-1 pr-2 pl-2.5",
        className,
      )}
      title={title}
    >
      <span className="relative flex size-2">
        <span
          className={cn(
            "absolute inline-flex size-full rounded-full opacity-70",
            session.open ? "animate-pulse-dot bg-gain" : "bg-muted-foreground",
          )}
        />
        <span className={cn("relative inline-flex size-2 rounded-full", session.open ? "bg-gain" : "bg-muted-foreground")} />
      </span>

      {showLabel && (
        <span className="text-[11.5px] font-medium text-muted-foreground">
          {session.label}
          <span className="tnum ml-1.5 hidden text-foreground/70 lg:inline">{now} ET</span>
        </span>
      )}

      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider uppercase",
          stale
            ? "bg-warning/15 text-warning"
            : live
              ? "bg-primary/12 text-primary"
              : "bg-muted text-muted-foreground",
        )}
      >
        {stale ? "stale" : live ? "live" : "sim"}
      </span>
    </div>
  );
}

export function LiveSourceBadge({ className }: { className?: string }) {
  const { source, providerLabel, liveWarning } = useMarket();
  if (source !== "live") return null;

  return (
    <Badge variant="muted" className={cn("gap-1 border-primary/25 bg-primary/10 text-primary", className)} title={liveWarning ?? `Real prices via ${providerLabel}`}>
      <span className="size-1.5 rounded-full bg-primary" />
      {providerLabel}
    </Badge>
  );
}

export function PendingBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <Badge variant="default" className={cn("tnum h-5 min-w-5 justify-center px-1.5 text-[10px]", className)}>
      {count}
    </Badge>
  );
}
