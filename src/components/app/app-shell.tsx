"use client";

import * as React from "react";

import { usePathname } from "next/navigation";

import { isAdminPath } from "@/components/app/nav";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { TradeDialog } from "@/components/trade/trade-dialog";
import { usePortfolio } from "@/lib/store/provider";
import type { OrderSide } from "@/lib/store/types";

/**
 * Which chrome the /app shell is wearing. Inside the admin dashboard it is
 * `"admin"`: the sidebar and hamburger show the admin sections and the
 * investing features (wallet, trading ticket) are switched off, so the admin
 * dashboard stays purely administrative.
 */
export type ChromeMode = "user" | "admin";

type TradeContextValue = {
  openTrade: (symbol?: string, side?: OrderSide) => void;
};

const TradeContext = React.createContext<TradeContextValue | null>(null);

/** Lets any page open the shared order ticket. */
export function useTrade(): TradeContextValue {
  const context = React.useContext(TradeContext);
  if (!context) throw new Error("useTrade must be used inside <AppShell>");
  return context;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state } = usePortfolio();
  const pathname = usePathname();
  const mode: ChromeMode = isAdminPath(pathname) ? "admin" : "user";
  const [trade, setTrade] = React.useState<{ symbol: string | null; side: OrderSide; open: boolean }>({
    symbol: null,
    side: "buy",
    open: false,
  });

  const openTrade = React.useCallback((symbol?: string, side: OrderSide = "buy") => {
    setTrade({ symbol: symbol ?? null, side, open: true });
  }, []);

  const value = React.useMemo(() => ({ openTrade }), [openTrade]);

  return (
    <TradeContext.Provider value={value}>
      <div className="flex min-h-dvh">
        {/* The admin sidebar reads `?tab=` to know which section is active. */}
        <React.Suspense fallback={null}>
          <Sidebar mode={mode} />
        </React.Suspense>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar mode={mode} onTrade={openTrade} />

          <main
            className="min-w-0 flex-1 px-4 pt-2 pb-8 sm:px-6"
            data-density={state.settings.compactTables ? "compact" : "comfortable"}
          >
            <div className="mx-auto w-full max-w-[1360px]">{children}</div>
          </main>

          <footer className="px-6 pb-6 text-[11.5px] text-muted-foreground">
            <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-2">
              <p>
                <span className="font-semibold text-foreground">Monievest</span> is a demo — prices, fills and
                balances are simulated locally in your browser.
              </p>
              <p>Not investment advice · No real securities are traded</p>
            </div>
          </footer>
        </div>

        {mode === "user" ? (
          <TradeDialog
            symbol={trade.symbol}
            open={trade.open}
            initialSide={trade.side}
            onOpenChange={(open) => setTrade((current) => ({ ...current, open }))}
          />
        ) : null}
      </div>
    </TradeContext.Provider>
  );
}
