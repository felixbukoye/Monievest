"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MenuIcon, PlusIcon, RefreshCwIcon, SearchIcon, SettingsIcon, WalletIcon } from "lucide-react";
import * as React from "react";

import { MarketStatus } from "@/components/app/market-status";
import { SearchDialog } from "@/components/app/search-dialog";
import { GeneratedAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/mode-toggle";
import { formatMoney } from "@/lib/format";
import { usePortfolio } from "@/lib/store/provider";
import { cn } from "@/lib/utils";
import { SidebarContent } from "./sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export function Topbar({ onTrade }: { onTrade: (symbol?: string) => void }) {
  const router = useRouter();
  const { state, hydrated, resetDemo } = usePortfolio();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false);

  // ⌘K / Ctrl+K opens search from anywhere in the app.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-sidebar-border bg-background/85 px-3 backdrop-blur-xl sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={() => setNavOpen(true)}
        >
          <MenuIcon />
        </Button>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={cn(
            "group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 text-left transition-colors",
            "hover:border-muted-foreground/35 hover:bg-muted/70 sm:max-w-md",
          )}
        >
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-[13px] text-muted-foreground">Search stocks, ETFs, sectors…</span>
          <kbd className="hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <MarketStatus className="hidden md:flex" />

          <Link
            href="/app/wallet"
            className="flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 transition-colors hover:bg-muted/70"
            title="Available cash"
          >
            <WalletIcon className="size-4 text-muted-foreground" />
            <span className="tnum text-[13px] font-semibold">
              {hydrated ? formatMoney(state.cash) : "—"}
            </span>
          </Link>

          <Button size="sm" variant="default" className="hidden h-9 gap-1.5 sm:flex" onClick={() => onTrade()}>
            <PlusIcon />
            Trade
          </Button>
          <Button size="icon" variant="default" className="sm:hidden" aria-label="New trade" onClick={() => onTrade()}>
            <PlusIcon />
          </Button>

          <ModeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/40"
                aria-label="Account menu"
              >
                <GeneratedAvatar name={state.account.name} seed={state.account.email} className="size-9" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[15rem]">
              <DropdownMenuLabel className="normal-case">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">{state.account.name}</span>
                  <span className="font-mono text-[11px] font-normal">{state.account.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2.5 py-1.5">
                <span className="text-xs text-muted-foreground">Plan</span>
                <Badge variant="default">{state.account.tier}</Badge>
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5">
                <span className="text-xs text-muted-foreground">Account</span>
                <span className="font-mono text-xs">{state.account.accountNumber}</span>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/app/wallet")}>
                <WalletIcon />
                Wallet &amp; funding
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/app/settings")}>
                <SettingsIcon />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  resetDemo();
                  router.push("/app");
                }}
              >
                <RefreshCwIcon />
                Reset demo data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[264px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setNavOpen(false)} onTrade={onTrade} />
        </SheetContent>
      </Sheet>
    </>
  );
}
