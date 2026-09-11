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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "./sidebar";
import { formatMoney } from "@/lib/format";
import { usePortfolio } from "@/lib/store/provider";

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
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 px-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl lg:hidden"
          aria-label="Open navigation"
          onClick={() => setNavOpen(true)}
        >
          <MenuIcon />
        </Button>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="card-soft group flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border/70 bg-card px-4 text-left transition-colors hover:border-primary/40 sm:max-w-sm"
        >
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-[13px] text-muted-foreground">
            Search stocks, ETFs, sectors…
          </span>
          <kbd className="hidden rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <MarketStatus className="hidden border-transparent bg-transparent py-0 pr-0 md:flex" showLabel />

          <Link
            href="/app/wallet"
            className="card-soft flex h-10 items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 transition-colors hover:border-primary/40"
            title="Available cash"
          >
            <WalletIcon className="size-4 text-muted-foreground" />
            <span className="tnum text-[13px] font-semibold">{hydrated ? formatMoney(state.cash) : "—"}</span>
          </Link>

          <Button
            size="sm"
            className="hidden h-10 gap-1.5 rounded-full px-4 sm:flex"
            onClick={() => onTrade()}
          >
            <PlusIcon />
            Trade
          </Button>
          <Button size="icon" className="h-10 w-10 rounded-full sm:hidden" aria-label="New trade" onClick={() => onTrade()}>
            <PlusIcon />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/40"
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
        <SheetContent side="left" className="w-[268px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setNavOpen(false)} onTrade={onTrade} />
        </SheetContent>
      </Sheet>
    </>
  );
}
