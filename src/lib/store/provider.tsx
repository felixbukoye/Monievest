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
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getInstrument } from "@/lib/market/catalog";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";
import { createFreshState, createSeedState } from "./seed";
import { reducer } from "./reducer";
import { clearPortfolio, forgetSyncCache, loadPortfolio, pushPortfolio } from "./supabase-sync";
import { STATE_VERSION, storageKeyFor, type Action, type OrderSide, type OrderType, type PortfolioState, type Settings } from "./types";

/** How long to wait after the last change before writing to Postgres. */
const PUSH_DEBOUNCE_MS = 900;

export type AuthStatus = "loading" | "guest" | "authenticated";
export type SyncStatus = "idle" | "syncing" | "synced" | "error";

type PortfolioContextValue = {
  state: PortfolioState;
  dispatch: React.Dispatch<Action>;
  /** True once storage (or Supabase) has been read and the state is real. */
  hydrated: boolean;
  auth: {
    /** False when the Supabase env vars are missing — the app runs as a local demo. */
    configured: boolean;
    status: AuthStatus;
    userId: string | null;
    email: string | null;
    /** 'admin' unlocks the admin dashboard; null while loading / as a guest. */
    role: "user" | "admin" | null;
  };
  sync: { status: SyncStatus; error: string | null; lastSyncedAt: number };
  signOut: () => Promise<void>;
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

/** Read a cached portfolio from localStorage, or null when absent/corrupt. */
function readCache(key: string): PortfolioState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortfolioState;
    if (parsed.version !== STATE_VERSION || !Array.isArray(parsed.positions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, next: PortfolioState): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* storage full or unavailable — the app keeps working in memory */
  }
}

/** Fill in anything a stored payload is missing, so old caches still load. */
function normalize(parsed: PortfolioState, email?: string | null): PortfolioState {
  const base = email
    ? createFreshState({ name: parsed.account?.name, email, tier: parsed.account?.tier, accountNumber: parsed.account?.accountNumber })
    : createSeedState(parsed.activity?.[0]?.createdAt ?? Date.now());

  return {
    ...base,
    ...parsed,
    account: { ...base.account, ...(parsed.account ?? {}), ...(email ? { email } : {}) },
    settings: { ...base.settings, ...(parsed.settings ?? {}) },
    positions: parsed.positions ?? [],
    orders: parsed.orders ?? [],
    activity: parsed.activity ?? [],
    watchlist: parsed.watchlist ?? [],
  };
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  // The initial value is deterministic on both server and client; real data is
  // read inside an effect so SSR markup and the first client render match.
  const [state, dispatch] = useReducer(reducer, undefined, () => createSeedState());
  const [hydrated, setHydrated] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"user" | "admin" | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(0);

  const configured = isSupabaseConfigured();
  const skipPersist = useRef(true);
  /** Guards against out-of-order loads when someone signs in/out quickly. */
  const loadToken = useRef(0);
  const settingsRef = useRef<Settings>(state.settings);

  useEffect(() => {
    settingsRef.current = state.settings;
  }, [state.settings]);

  /** Swap in a state object without immediately echoing it back to storage. */
  const commit = useCallback((id: string | null, next: PortfolioState) => {
    skipPersist.current = true;
    dispatch({ type: "replace-state", payload: next });
    writeCache(storageKeyFor(id), next);
    setHydrated(true);
    window.requestAnimationFrame(() => {
      skipPersist.current = false;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Boot: pick up the session, then load that user's portfolio from Postgres.
  // With no Supabase env this is the original localStorage demo behaviour.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let disposed = false;
    const client = getSupabaseBrowser();

    function enterGuestMode() {
      const cached = readCache(storageKeyFor(null));
      commit(null, cached ? normalize(cached) : createSeedState());
      setAuthStatus("guest");
      setSyncStatus("idle");
      setUserId(null);
      setUserEmail(null);
      setUserRole(null);
    }

    async function enterUserMode(id: string, email: string) {
      const token = ++loadToken.current;
      setAuthStatus("loading");
      setUserId(id);
      setUserEmail(email);

      // Paint the local cache first so the dashboard is never blank on reload.
      const cached = readCache(storageKeyFor(id));
      if (cached) commit(id, normalize(cached, email));

      const supabase = getSupabaseBrowser();
      if (!supabase) return;

      const result = await loadPortfolio(supabase, id, email);
      if (disposed || token !== loadToken.current) return;

      const localSettings = (cached ? normalize(cached, email) : null)?.settings ?? settingsRef.current;

      if (result.status === "ok") {
        setUserRole(result.role);

        // An admin marked this account disabled — end the session here.
        if (result.accountStatus === "disabled") {
          await supabase.auth.signOut();
          router.replace("/login?error=disabled");
          return;
        }

        commit(id, { ...result.state, settings: localSettings });
        setSyncStatus("synced");
        setSyncError(null);
        setLastSyncedAt(Date.now());
        setAuthStatus("authenticated");
        return;
      }

      if (result.status === "empty") {
        setUserRole("user");
        // Signed up but the bootstrap rows are missing — create and push them.
        const fresh = createFreshState({ email }, Date.now());
        const next = { ...fresh, settings: localSettings };
        commit(id, next);
        setAuthStatus("authenticated");
        const pushed = await pushPortfolio(supabase, id, next);
        if (disposed || token !== loadToken.current) return;
        setSyncStatus(pushed.ok ? "synced" : "error");
        setSyncError(pushed.ok ? null : (pushed.error ?? "Could not save your portfolio"));
        if (pushed.ok) setLastSyncedAt(Date.now());
        return;
      }

      // Query failed: keep the cached copy usable and say so in the UI.
      if (!cached) commit(id, { ...createFreshState({ email }, Date.now()), settings: localSettings });
      setAuthStatus("authenticated");
      setSyncStatus("error");
      setSyncError(result.error);
    }

    if (!client) {
      // No Supabase configured — guest mode, exactly like before.
      const frame = window.requestAnimationFrame(() => {
        if (!disposed) enterGuestMode();
      });
      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
      };
    }

    void (async () => {
      const { data } = await client.auth.getSession();
      if (disposed) return;
      const sessionUser = data.session?.user;
      if (sessionUser) await enterUserMode(sessionUser.id, sessionUser.email ?? "");
      else enterGuestMode();
    })();

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      if (disposed) return;
      const user = session?.user;
      if (user) void enterUserMode(user.id, user.email ?? "");
      else enterGuestMode();
    });

    return () => {
      disposed = true;
      subscription?.subscription.unsubscribe();
    };
  }, [commit, router]);

  // -------------------------------------------------------------------------
  // Persist: localStorage on every change, Postgres debounced while signed in.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!hydrated || skipPersist.current) return;
    writeCache(storageKeyFor(userId), state);

    if (!userId) return;
    const client = getSupabaseBrowser();
    if (!client) return;

    const timer = window.setTimeout(() => {
      setSyncStatus("syncing");
      void pushPortfolio(client, userId, state).then((result) => {
        if (result.ok) {
          setSyncStatus("synced");
          setSyncError(null);
          setLastSyncedAt(Date.now());
        } else {
          setSyncStatus("error");
          setSyncError(result.error ?? "Could not save your portfolio");
        }
      });
    }, PUSH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [state, hydrated, userId]);

  // Keep multiple tabs in sync.
  useEffect(() => {
    const key = storageKeyFor(userId);
    function onStorage(event: StorageEvent) {
      if (event.key !== key || !event.newValue) return;
      try {
        dispatch({ type: "replace-state", payload: normalize(JSON.parse(event.newValue) as PortfolioState, userEmail) });
      } catch {
        /* ignore malformed payloads from other tabs */
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId, userEmail]);

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowser();
    if (userId) {
      forgetSyncCache(userId);
      try {
        window.localStorage.removeItem(storageKeyFor(userId));
      } catch {
        /* nothing to clean up */
      }
    }
    if (client) await client.auth.signOut();
    // The SIGNED_OUT event has already swapped the state back to guest mode;
    // this leaves /app before the proxy would bounce us to /login.
    router.replace("/");
    router.refresh();
  }, [userId, router]);

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
            ? "Market order filled instantly at the current price."
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

  const accountName = state.account.name;
  const accountEmail = state.account.email;
  const accountTier = state.account.tier;
  const accountNumber = state.account.accountNumber;

  const resetDemo = useCallback(() => {
    if (!userId) {
      dispatch({ type: "reset" });
      toast.success("Demo account reset", {
        description: "All positions, orders and activity restored to defaults.",
      });
      return;
    }

    const client = getSupabaseBrowser();
    if (!client) return;

    const next: PortfolioState = {
      ...createFreshState({ name: accountName, email: accountEmail, tier: accountTier, accountNumber }, Date.now()),
      settings: settingsRef.current,
    };

    void (async () => {
      const cleared = await clearPortfolio(client, userId);
      commit(userId, next);
      if (!cleared.ok) {
        setSyncStatus("error");
        setSyncError(cleared.error ?? "Could not reset your portfolio");
        toast.error("Reset could not reach Supabase", { description: cleared.error });
        return;
      }
      setSyncStatus("synced");
      setSyncError(null);
      setLastSyncedAt(Date.now());
      toast.success("Account reset", {
        description: `Positions, orders and history cleared in Supabase. Cash restored to $${next.cash.toLocaleString("en-US")}.`,
      });
    })();
  }, [userId, commit, accountName, accountEmail, accountTier, accountNumber]);

  const auth = useMemo(
    () => ({ configured, status: authStatus, userId, email: userEmail, role: userRole }),
    [configured, authStatus, userId, userEmail, userRole],
  );

  const sync = useMemo(
    () => ({ status: syncStatus, error: syncError, lastSyncedAt }),
    [syncStatus, syncError, lastSyncedAt],
  );

  const value = useMemo<PortfolioContextValue>(
    () => ({
      state,
      dispatch,
      hydrated,
      auth,
      sync,
      signOut,
      placeOrder,
      cancelOrder,
      deposit,
      withdraw,
      toggleWatchlist,
      resetDemo,
    }),
    [state, hydrated, auth, sync, signOut, placeOrder, cancelOrder, deposit, withdraw, toggleWatchlist, resetDemo],
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
