"use client";

import * as React from "react";

import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import type { ChromeMode } from "@/components/app/nav";
import { TradeDialog } from "@/components/trade/trade-dialog";
import { usePortfolio } from "@/lib/store/provider";
import type { OrderSide } from "@/lib/store/types";

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

/**
 * The application shell.
 *
 * It renders one of two chromes:
 *   • **user** — the investor app: order ticket, wallet balance, portfolio.
 *   • **admin** — the admin console: administration sections only. No order
 *     ticket is mounted, no wallet is shown, and the sidebar/hamburger carry
 *     the admin menu.
 *
 * `initialRole` comes from the server layout so the correct chrome is in the
 * first HTML instead of flashing the investor menu until the client session
 * resolves.
 */
export function AppShell({
  children,
  initialRole = null,
}: {
  children: React.ReactNode;
  initialRole?: "user" | "admin" | null;
}) {
  const { state, auth } = usePortfolio();
  const [trade, setTrade] = React.useState<{ symbol: string | null; side: OrderSide; open: boolean }>({
    symbol: null,
    side: "buy",
    open: false,
  });

  const isAdmin = auth.status === "loading" ? initialRole === "admin" : auth.role === "admin";
  const mode: ChromeMode = isAdmin ? "admin" : "user";

  const openTrade = React.useCallback((symbol?: string, side: OrderSide = "buy") => {
    setTrade({ symbol: symbol ?? null, side, open: true });
  }, []);

  const value = React.useMemo(() => ({ openTrade }), [openTrade]);

  return (
    <TradeContext.Provider value={value}>
      <div className="flex min-h-dvh" data-chrome={mode}>
        <Sidebar mode={mode} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onTrade={openTrade} mode={mode} />

          <main
            className="min-w-0 flex-1 px-4 pt-2 pb-8 sm:px-6"
            data-density={state.settings.compactTables ? "compact" : "comfortable"}
          >
            <div className="mx-auto w-full max-w-[1360px]">{children}</div>
          </main>

          <footer className="px-6 pb-6 text-[11.5px] text-muted-foreground">
            <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-2">
              <p>
                <span className="font-semibold text-foreground">Monievest</span>{" "}
                {isAdmin
                  ? "admin console — platform management only. Trading and wallet features are turned off for admin accounts."
                  : "is a demo — prices, fills and balances are simulated locally in your browser."}
              </p>
              <p>
                {isAdmin
                  ? "Every query is scoped by Postgres row level security"
                  : "Not investment advice · No real securities are traded"}
              </p>
            </div>
          </footer>
        </div>

        {/* Admins do not trade, so the order ticket is never mounted for them. */}
        {isAdmin ? null : (
          <TradeDialog
            symbol={trade.symbol}
            open={trade.open}
            initialSide={trade.side}
            onOpenChange={(open) => setTrade((current) => ({ ...current, open }))}
          />
        )}
      </div>
    </TradeContext.Provider>
  );
}
