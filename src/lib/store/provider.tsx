"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { getInstrument } from "@/lib/market/catalog";
import { createSeedState } from "./seed";
import { reducer } from "./reducer";
import { STORAGE_KEY } from "./types";
import { STATE_VERSION, type Action, type OrderSide, type OrderType, type PortfolioState } from "./types";

type PortfolioContextValue = {
  state: PortfolioState;
  dispatch: React.Dispatch<Action>;
  /** True once localStorage has been read (or the seed installed). */
  hydrated: boolean;
  placeOrder: (input: {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    qty: number;
    limitPrice?: number | null;
    marketPrice: number;
  }) => { ok: boolean; reason?: string };
  cancelOrder: (id: string) => void;
  deposit: (amount: number, method?: string) => void;
  withdraw: (amount: number) => void;
  toggleWatchlist: (symbol: string) => void;
  resetDemo: () => void;
};

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

function loadState(): PortfolioState {
  if (typeof window === "undefined") return createSeedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as PortfolioState;
    if (parsed.version !== STATE_VERSION || !Array.isArray(parsed.positions)) {
      return createSeedState();
    }
    const seed = createSeedState(parsed.activity?.[0]?.createdAt ?? Date.now());
    return {
      ...seed,
      ...parsed,
      account: { ...seed.account, ...parsed.account },
      settings: { ...seed.settings, ...parsed.settings },
      positions: parsed.positions ?? [],
      orders: parsed.orders ?? [],
      activity: parsed.activity ?? [],
      watchlist: parsed.watchlist ?? [],
    };
  } catch {
    return createSeedState();
  }
}


export function PortfolioProvider({ children }: { children: ReactNode }) {
  // The initial value is deterministic on both server and client; real storage
  // is read inside an effect so SSR markup and the first client render match.
  const [state, dispatch] = useReducer(reducer, undefined, () => createSeedState());
  const [hydrated, setHydrated] = useState(false);
  const skipPersist = useRef(true);

  useEffect(() => {
    const loaded = loadState();
    skipPersist.current = true;
    dispatch({ type: "replace-state", payload: loaded });
    const frame = requestAnimationFrame(() => {
      setHydrated(true);
      skipPersist.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Persist on every change after hydration.
  useEffect(() => {
    if (!hydrated || skipPersist.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable — the app keeps working in memory */
    }
  }, [state, hydrated]);

  // Keep multiple tabs in sync.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        dispatch({ type: "replace-state", payload: JSON.parse(event.newValue) as PortfolioState });
      } catch {
        /* ignore malformed payloads from other tabs */
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const placeOrder = useCallback<PortfolioContextValue["placeOrder"]>(
    (input) => {
      const instrument = getInstrument(input.symbol);
      if (!instrument) return { ok: false, reason: "Unknown symbol" };
      if (!Number.isFinite(input.qty) || input.qty <= 0)
        return { ok: false, reason: "Enter a quantity greater than zero" };

      const price = input.type === "limit" ? (input.limitPrice ?? 0) : input.marketPrice;
      if (price <= 0) return { ok: false, reason: "Enter a valid limit price" };

      if (input.side === "buy") {
        const notional = input.qty * price;
        if (notional > state.cash + 1e-8)
          return {
            ok: false,
            reason: `Not enough buying power — you need $${notional.toFixed(2)} but have $${state.cash.toFixed(2)}`,
          };
      } else {
        const held = state.positions.find((p) => p.symbol === input.symbol)?.qty ?? 0;
        if (input.qty > held + 1e-8)
          return { ok: false, reason: `You only hold ${held} ${input.symbol} shares` };
      }

      dispatch({
        type: "place-order",
        payload: {
          symbol: input.symbol,
          side: input.side,
          type: input.type,
          qty: input.qty,
          limitPrice: input.type === "limit" ? input.limitPrice ?? null : null,
          marketPrice: input.marketPrice,
          at: Date.now(),
        },
      });

      const isMarket = input.type === "market";
      toast.success(
        isMarket
          ? `${input.side === "buy" ? "Bought" : "Sold"} ${input.qty} ${input.symbol} @ $${input.marketPrice.toFixed(2)}`
          : `${input.side === "buy" ? "Buy" : "Sell"} order queued · ${input.qty} ${input.symbol} @ $${price.toFixed(2)}`,
        {
          description: isMarket
            ? "Market order filled instantly at the simulated price."
            : "Limit order is live — it fills automatically when the price is hit.",
        },
      );
      return { ok: true };
    },
    [state.cash, state.positions],
  );

  const cancelOrder = useCallback((id: string) => {
    dispatch({ type: "cancel-order", payload: { id } });
    toast.info("Order cancelled");
  }, []);

  const deposit = useCallback((amount: number, method?: string) => {
    if (amount <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    dispatch({ type: "deposit", payload: { amount, method } });
    toast.success(`$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} added to your cash balance`);
  }, []);

  const withdraw = useCallback(
    (amount: number) => {
      if (amount <= 0) {
        toast.error("Enter an amount greater than zero");
        return;
      }
      if (amount > state.cash) {
        toast.error("Withdrawal exceeds your available cash");
        return;
      }
      dispatch({ type: "withdraw", payload: { amount } });
      toast.success(`Withdrawing $${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
    },
    [state.cash],
  );

  const toggleWatchlist = useCallback(
    (symbol: string) => {
      const has = state.watchlist.includes(symbol);
      dispatch({ type: "toggle-watchlist", payload: { symbol } });
      toast[has ? "info" : "success"](has ? `${symbol} removed from watchlist` : `${symbol} added to watchlist`);
    },
    [state.watchlist],
  );

  const resetDemo = useCallback(() => {
    dispatch({ type: "reset" });
    toast.success("Demo account reset", { description: "All positions, orders and activity restored to defaults." });
  }, []);

  const value = useMemo<PortfolioContextValue>(
    () => ({
      state,
      dispatch,
      hydrated,
      placeOrder,
      cancelOrder,
      deposit,
      withdraw,
      toggleWatchlist,
      resetDemo,
    }),
    [state, hydrated, placeOrder, cancelOrder, deposit, withdraw, toggleWatchlist, resetDemo],
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio(): PortfolioContextValue {
  const context = useContext(PortfolioContext);
  if (!context) throw new Error("usePortfolio must be used inside <PortfolioProvider>");
  return context;
}

export function useWatchlisted(symbol: string): boolean {
  const { state } = usePortfolio();
  return state.watchlist.includes(symbol);
}
