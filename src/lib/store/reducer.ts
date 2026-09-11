import { getInstrument } from "@/lib/market/catalog";
import { uniqueId } from "@/lib/utils";
import { createSeedState } from "./seed";
import type { Action, Activity, Order, PortfolioState, Position } from "./types";

const QTY_EPSILON = 1e-8;

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function upsertPosition(positions: Position[], next: Position): Position[] {
  const index = positions.findIndex((p) => p.symbol === next.symbol);
  if (index === -1) return [...positions, next];
  const copy = positions.slice();
  copy[index] = next;
  return copy;
}

function executeFill(state: PortfolioState, order: Order, price: number, at: number): PortfolioState {
  const notional = order.qty * price;
  const existing = state.positions.find((p) => p.symbol === order.symbol);
  let positions = state.positions;
  let realizedPnl = state.realizedPnl;
  let cash = state.cash;
  const activity: Activity[] = [];

  if (order.side === "buy") {
    if (notional > cash + QTY_EPSILON) {
      // Not enough buying power when the limit order came back — void it.
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === order.id ? { ...o, status: "cancelled" as const } : o,
        ),
        activity: [
          {
            id: uniqueId("act"),
            type: "cancel",
            symbol: order.symbol,
            qty: order.qty,
            price,
            amount: 0,
            createdAt: at,
            orderId: order.id,
            note: "Voided — insufficient buying power",
          },
          ...state.activity,
        ],
      };
    }
    cash -= notional;
    const totalQty = (existing?.qty ?? 0) + order.qty;
    const avgCost = ((existing?.avgCost ?? 0) * (existing?.qty ?? 0) + price * order.qty) / totalQty;
    positions = upsertPosition(positions, {
      symbol: order.symbol,
      qty: round6(totalQty),
      avgCost,
      openedAt: existing?.openedAt ?? at,
    });
    activity.push({
      id: uniqueId("act"),
      type: "buy",
      symbol: order.symbol,
      qty: order.qty,
      price,
      amount: -notional,
      createdAt: at,
      orderId: order.id,
    });
  } else {
    const sellQty = Math.min(order.qty, existing?.qty ?? 0);
    if (sellQty <= QTY_EPSILON) {
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === order.id ? { ...o, status: "cancelled" as const } : o,
        ),
        activity: [
          {
            id: uniqueId("act"),
            type: "cancel",
            symbol: order.symbol,
            amount: 0,
            createdAt: at,
            orderId: order.id,
            note: "Voided — no shares to sell",
          },
          ...state.activity,
        ],
      };
    }
    const proceeds = sellQty * price;
    const costBasis = (existing?.avgCost ?? 0) * sellQty;
    realizedPnl += proceeds - costBasis;
    cash += proceeds;

    const remaining = round6((existing?.qty ?? 0) - sellQty);
    if (remaining <= QTY_EPSILON) {
      positions = positions.filter((p) => p.symbol !== order.symbol);
    } else if (existing) {
      positions = upsertPosition(positions, { ...existing, qty: remaining });
    }

    activity.push({
      id: uniqueId("act"),
      type: "sell",
      symbol: order.symbol,
      qty: sellQty,
      price,
      amount: proceeds,
      createdAt: at,
      orderId: order.id,
      note:
        remaining <= QTY_EPSILON
          ? `Position closed · realised ${proceeds - costBasis >= 0 ? "+" : "−"}$${Math.abs(
              proceeds - costBasis,
            ).toFixed(2)}`
          : undefined,
    });
  }

  return {
    ...state,
    cash,
    realizedPnl,
    positions,
    orders: state.orders.map((o) =>
      o.id === order.id
        ? { ...o, status: "filled" as const, filledPrice: price, filledAt: at, notional }
        : o,
    ),
    activity: [...activity.reverse(), ...state.activity],
  };
}


export function reducer(state: PortfolioState, action: Action): PortfolioState {
  switch (action.type) {
    case "place-order": {
      const { symbol, side, type, qty, limitPrice, marketPrice } = action.payload;
      const at = action.payload.at ?? Date.now();
      if (qty <= 0) return state;

      const order: Order = {
        id: uniqueId("ord"),
        symbol,
        side,
        type,
        qty: round6(qty),
        limitPrice: type === "limit" ? limitPrice : null,
        filledPrice: null,
        notional: qty * (type === "limit" ? (limitPrice ?? marketPrice) : marketPrice),
        status: "pending",
        createdAt: at,
        filledAt: null,
      };

      // Pre-flight validation so users get feedback rather than a voided order.
      if (side === "buy" && order.notional > state.cash + QTY_EPSILON) return state;
      if (side === "sell") {
        const held = state.positions.find((p) => p.symbol === symbol)?.qty ?? 0;
        if (qty > held + QTY_EPSILON) return state;
      }

      if (type === "market") {
        return executeFill({ ...state, orders: [order, ...state.orders] }, order, marketPrice, at);
      }
      return { ...state, orders: [order, ...state.orders] };
    }

    case "fill-order": {
      const order = state.orders.find((o) => o.id === action.payload.id);
      if (!order || order.status !== "pending") return state;
      return executeFill(state, order, action.payload.price, action.payload.at ?? Date.now());
    }

    case "cancel-order": {
      const order = state.orders.find((o) => o.id === action.payload.id);
      if (!order || order.status !== "pending") return state;
      const at = Date.now();
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === order.id ? { ...o, status: "cancelled" as const } : o,
        ),
        activity: [
          {
            id: uniqueId("act"),
            type: "cancel",
            symbol: order.symbol,
            qty: order.qty,
            price: order.limitPrice ?? undefined,
            amount: 0,
            createdAt: at,
            orderId: order.id,
            note: `Cancelled ${order.side} order`,
          },
          ...state.activity,
        ],
      };
    }

    case "deposit": {
      const amount = Math.round(action.payload.amount * 100) / 100;
      if (amount <= 0) return state;
      const at = Date.now();
      return {
        ...state,
        cash: state.cash + amount,
        activity: [
          {
            id: uniqueId("act"),
            type: "deposit",
            amount,
            createdAt: at,
            note: action.payload.method ?? "Instant deposit · Visa ••9021",
          },
          ...state.activity,
        ],
      };
    }

    case "withdraw": {
      const amount = Math.round(action.payload.amount * 100) / 100;
      if (amount <= 0 || amount > state.cash + QTY_EPSILON) return state;
      const at = Date.now();
      return {
        ...state,
        cash: state.cash - amount,
        activity: [
          {
            id: uniqueId("act"),
            type: "withdraw",
            amount: -amount,
            createdAt: at,
            note: "Withdrawal to Chase ••4417 · arrives in 1–2 business days",
          },
          ...state.activity,
        ],
      };
    }

    case "toggle-watchlist": {
      const { symbol } = action.payload;
      const has = state.watchlist.includes(symbol);
      return {
        ...state,
        watchlist: has
          ? state.watchlist.filter((s) => s !== symbol)
          : [symbol, ...state.watchlist],
      };
    }

    case "update-settings":
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case "update-account":
      return { ...state, account: { ...state.account, ...action.payload } };

    case "replace-state":
      return action.payload;

    case "reset":
      return createSeedState();

    default:
      return state;
  }
}

export { getInstrument };
