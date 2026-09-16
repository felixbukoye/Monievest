"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOutIcon, MonitorIcon, MoonIcon, PlusIcon, ShieldCheckIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { SyncStatus } from "@/components/app/sync-status";
import { Wordmark } from "@/components/brand";
import { useMarket } from "@/components/market/market-provider";
import { GeneratedAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useActiveAdminTab } from "@/lib/hooks/use-admin-tab";
import { formatMoney } from "@/lib/format";
import { usePortfolio } from "@/lib/store/provider";
import { summarise } from "@/lib/store/selectors";
import { isNavItemActive, navGroupsFor, type ChromeMode } from "./nav";
import { cn } from "@/lib/utils";

const THEME_CHOICES = [
  { id: "light", label: "Light", icon: SunIcon },
  { id: "dark", label: "Dark", icon: MoonIcon },
  { id: "system", label: "Auto", icon: MonitorIcon },
] as const;

/** Light / Dark / Auto segmented control, pinned to the sidebar footer. */
export function ThemeSegmented({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("grid grid-cols-3 gap-1 rounded-xl border border-border/70 bg-secondary/70 p-1", className)}
    >
      {THEME_CHOICES.map((choice) => {
        const active = mounted && theme === choice.id;
        return (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(choice.id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11.5px] font-medium transition-all outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <choice.icon className="size-3.5" />
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

/** Portfolio value summary — investor chrome only. */
function PortfolioSummaryCard({ onNavigate }: { onNavigate?: () => void }) {
  const { state, hydrated } = usePortfolio();
  const { quotes } = useMarket();
  const summary = React.useMemo(() => summarise(state, quotes), [state, quotes]);

  return (
    <Link
      href="/app/portfolio"
      onClick={onNavigate}
      className="card-soft flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 transition-colors hover:border-primary/40"
    >
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
          Portfolio value
        </p>
        {hydrated ? (
          <p className="tnum mt-0.5 text-[17px] font-semibold tracking-tight">{formatMoney(summary.totalValue)}</p>
        ) : (
          <Skeleton className="mt-1 h-5 w-24" />
        )}
      </div>
      {hydrated ? (
        <span
          className={cn(
            "tnum rounded-full px-2 py-1 text-[11px] font-semibold",
            summary.dayChange >= 0 ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss",
          )}
        >
          {summary.dayChange >= 0 ? "↑" : "↓"} {Math.abs(summary.dayChangePct).toFixed(2)}%
        </span>
      ) : (
        <Skeleton className="h-6 w-14 rounded-full" />
      )}
    </Link>
  );
}

/** Shown in place of the portfolio card for admin accounts. */
function AdminConsoleCard() {
  return (
    <div className="card-soft rounded-xl border border-border/70 bg-card px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wider text-primary uppercase">
        <ShieldCheckIcon className="size-3.5" />
        Admin console
      </p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
        Platform tools only. Trading, the wallet and your portfolio are switched off for admin
        accounts.
      </p>
    </div>
  );
}

/**
 * The navigation column — and, on small screens, the hamburger sheet.
 *
 * `mode` decides whose menu this is:
 *   • `"user"`  — the investor app (overview, markets, portfolio, wallet, …).
 *   • `"admin"` — the admin console sections and nothing else. Admin accounts
 *     never get the investor menu, so there is no wallet or order ticket here.
 */
export function SidebarContent({
  onNavigate,
  onTrade,
  mode = "user",
}: {
  onNavigate?: () => void;
  onTrade?: (symbol?: string) => void;
  mode?: ChromeMode;
}) {
  const pathname = usePathname();
  const { state, hydrated, auth, signOut } = usePortfolio();
  const signedIn = auth.status === "authenticated";
  const adminTab = useActiveAdminTab();
  const pending = state.orders.filter((order) => order.status === "pending").length;
  const isAdminMode = mode === "admin";
  const navGroups = navGroupsFor(mode);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <Wordmark />
        {isAdminMode ? (
          <Badge className="shrink-0 gap-1 px-1.5 py-0 text-[9.5px] uppercase">
            <ShieldCheckIcon />
            Admin
          </Badge>
        ) : null}
      </div>

      {isAdminMode ? null : (
        <Button
          variant="default"
          className="h-10 w-full justify-center gap-2 rounded-full shadow-sm"
          onClick={() => {
            onTrade?.();
            onNavigate?.();
          }}
        >
          <PlusIcon />
          New trade
        </Button>
      )}

      {navGroups.map((group) => (
        <nav key={group.label} className="flex flex-col gap-1" aria-label={group.label}>
          <p className="px-3 pb-1 text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = isNavItemActive(item, pathname, isAdminMode ? adminTab : null);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring/40",
                  active
                    ? "bg-sidebar-accent text-sidebar-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon
                  className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground")}
                  strokeWidth={2}
                />
                <span className="flex-1">{item.label}</span>
                {item.href === "/app/activity" && pending > 0 && hydrated && (
                  <span className="tnum rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
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
      ))}

      <div className="mt-auto space-y-3 pt-2">
        <Separator />

        {isAdminMode ? <AdminConsoleCard /> : <PortfolioSummaryCard onNavigate={onNavigate} />}

        <ThemeSegmented />

        {/* ------------------------------------------------------ account */}
        <div className="rounded-xl border border-border/70 bg-card p-2">
          <Link
            href="/app/settings"
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-sidebar-accent/60"
          >
            <GeneratedAvatar
              name={signedIn ? state.account.name : "Guest"}
              seed={signedIn ? state.account.email : "guest"}
              className="size-8"
            />
            <span className="min-w-0 flex-1">
              {auth.status === "loading" ? (
                <>
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="mt-1.5 h-3 w-24" />
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-semibold">
                      {signedIn ? state.account.name : "Guest"}
                    </span>
                    {auth.role === "admin" ? (
                      <Badge className="px-1.5 py-0 text-[9.5px] uppercase">Admin</Badge>
                    ) : null}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {signedIn ? (auth.email ?? state.account.email) : "Not signed in"}
                  </span>
                </>
              )}
            </span>
          </Link>

          {auth.status === "loading" ? (
            <div className="mt-1.5 flex items-center justify-between gap-2 px-1.5 pb-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-14" />
            </div>
          ) : signedIn ? (
            <div className="mt-1 flex items-center justify-between gap-2 px-1.5 pb-0.5">
              <SyncStatus className="min-w-0" />
              <button
                type="button"
                onClick={() => {
                  onNavigate?.();
                  void signOut();
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
              >
                <LogOutIcon className="size-3.5" />
                Sign out
              </button>
            </div>
          ) : (
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-[11.5px]">
                <Link href="/login" onClick={onNavigate}>
                  Sign in
                </Link>
              </Button>
              <Button asChild size="sm" className="h-8 rounded-lg text-[11.5px]">
                <Link href="/signup" onClick={onNavigate}>
                  Sign up
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ mode = "user" }: { mode?: ChromeMode }) {
  return (
    <aside
      className="sticky top-0 hidden h-dvh w-[268px] shrink-0 border-r border-sidebar-border bg-sidebar lg:block"
      aria-label={mode === "admin" ? "Admin console navigation" : "Main navigation"}
    >
      <SidebarContent mode={mode} />
    </aside>
  );
}
