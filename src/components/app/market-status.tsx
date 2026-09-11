"use client";

import * as React from "react";
import { useMarket } from "@/components/market/market-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MarketStatus({ className, showLabel = true }: { className?: string; showLabel?: boolean }) {
  const { session, ready, lastTickAt } = useMarket();
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

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-border/80 bg-muted/50 py-1 pr-3 pl-2.5",
        className,
      )}
      title={ready ? `Last simulated tick ${new Date(lastTickAt).toLocaleTimeString()}` : "Booting market simulator"}
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
    </div>
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
