"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlusIcon, SparklesIcon } from "lucide-react";
import * as React from "react";

import { Wordmark } from "@/components/brand";
import { useMarket } from "@/components/market/market-provider";
import { ChangeChip } from "@/components/shared/prices";
import { SimulatedBadge } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { summarise } from "@/lib/store/selectors";
import { usePortfolio } from "@/lib/store/provider";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarContent({
  onNavigate,
  onTrade,
}: {
  onNavigate?: () => void;
  onTrade?: (symbol?: string) => void;
}) {
  const pathname = usePathname();
  const { state, hydrated } = usePortfolio();
  const { quotes } = useMarket();
  const summary = React.useMemo(() => summarise(state, quotes), [state, quotes]);
  const pending = state.orders.filter((order) => order.status === "pending").length;

  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <div className="px-2 pt-1 pb-3">
        <Wordmark showTagline />
      </div>

      <Button
        variant="glow"
        className="mb-2 h-10 w-full justify-start gap-2 rounded-xl"
        onClick={() => {
          onTrade?.();
          onNavigate?.();
        }}
      >
        <PlusIcon />
        New trade
      </Button>

      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors outline-none",
                "focus-visible:ring-[3px] focus-visible:ring-ring/40",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <item.icon className={cn("size-[18px] shrink-0", active ? "text-primary" : "")} strokeWidth={2} />
              <span className="flex-1">{item.label}</span>
              {item.href === "/app/activity" && pending > 0 && hydrated && (
                <span className="tnum rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {pending}
                </span>
              )}
              {item.href === "/app/watchlist" && state.watchlist.length > 0 && (
                <span className="tnum text-[11px] text-muted-foreground">{state.watchlist.length}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 pt-4">
        <Separator />

        <div className="rounded-xl border border-border/70 bg-gradient-to-b from-primary/8 to-transparent p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Total value
            </span>
            <SparklesIcon className="size-3.5 text-primary" />
          </div>
          {hydrated ? (
            <p className="tnum mt-1 text-xl font-semibold tracking-tight">{formatMoney(summary.totalValue)}</p>
          ) : (
            <Skeleton className="mt-1.5 h-6 w-28" />
          )}
          <div className="mt-1.5 flex items-center gap-2">
            {hydrated ? (
              <ChangeChip value={summary.dayChange} pct={summary.dayChangePct} size="sm" />
            ) : (
              <Skeleton className="h-5 w-20 rounded-md" />
            )}
            <span className="text-[11px] text-muted-foreground">today</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <SimulatedBadge />
          <Link
            href="/app/settings"
            onClick={onNavigate}
            className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Preferences
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
      <SidebarContent />
    </aside>
  );
}
