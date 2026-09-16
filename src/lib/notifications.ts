"use client";

import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  CoinsIcon,
  HourglassIcon,
  ReceiptTextIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { formatMoney, formatShares } from "@/lib/format";
import type { Activity, PortfolioState } from "@/lib/store/types";

/**
 * Notifications for both dashboards.
 *
 * Nothing is stored server-side: both bells derive their items from data the
 * app already has (the portfolio store for users, Supabase tables for admins)
 * and keep only *read* markers in localStorage, per user, so one browser
 * serving two accounts never mixes them up.
 */

export type NotificationTone = "default" | "gain" | "loss" | "warning";

export type AppNotification = {
  /** Stable id — `activity:<uuid>`, `feedback:<uuid>`, … */
  id: string;
  title: string;
  description?: string;
  /** Epoch ms. Drives ordering and the unread count. */
  createdAt: number;
  icon: LucideIcon;
  tone?: NotificationTone;
  /** Where clicking the notification takes you. */
  href?: string;
  /** Small right-aligned label, e.g. a money amount. */
  meta?: string;
};

// ---------------------------------------------------------------------------
// Read state
// ---------------------------------------------------------------------------

export type NotificationScope = "user" | "admin";

const STORAGE_PREFIX = "monievest.notifications.v1";
/** Keep the dismissal list from growing forever. */
const MAX_READ_IDS = 300;

type ReadState = {
  /**
   * Anything older than this was already on screen the first time the bell
   * mounted, so it never counts as unread — otherwise a brand-new admin would
   * be greeted by a badge for tickets that predate them.
   */
  firstSeenAt: number;
  readIds: string[];
};

function storageKey(scope: NotificationScope, userId?: string | null): string {
  return `${STORAGE_PREFIX}:${scope}:${userId ?? "guest"}`;
}

function loadState(key: string): ReadState {
  const fallback: ReadState = { firstSeenAt: Date.now(), readIds: [] };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ReadState>;
    return {
      firstSeenAt: typeof parsed.firstSeenAt === "number" ? parsed.firstSeenAt : fallback.firstSeenAt,
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds.filter((id) => typeof id === "string") : [],
    };
  } catch {
    return fallback;
  }
}

export type NotificationReadState = {
  /** False until localStorage has been read — keeps the badge from flashing. */
  ready: boolean;
  isRead: (id: string) => boolean;
  isUnread: (item: AppNotification) => boolean;
  /** How many of `items` are newer than the first visit and not dismissed. */
  countUnread: (items: AppNotification[]) => number;
  markRead: (id: string) => void;
  markAllRead: (items: AppNotification[]) => void;
  /** "Everything up to now has been seen" — used by the user bell. */
  markSeenUpTo: (timestamp: number) => void;
};

export function useNotificationReadState(
  scope: NotificationScope,
  userId?: string | null,
): NotificationReadState {
  const key = storageKey(scope, userId);
  const [state, setState] = React.useState<ReadState | null>(null);

  React.useEffect(() => {
    // Deferred so the effect never calls setState during the render pass — the
    // first paint matches the server (no read state yet), then it swaps in.
    const timer = window.setTimeout(() => setState(loadState(key)), 0);
    return () => window.clearTimeout(timer);
  }, [key]);

  const markRead = React.useCallback(
    (id: string) => {
      setState((current) => {
        if (!current || current.readIds.includes(id)) return current;
        const next: ReadState = {
          ...current,
          readIds: [...current.readIds, id].slice(-MAX_READ_IDS),
        };
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [key],
  );

  const markAllRead = React.useCallback(
    (items: AppNotification[]) => {
      setState((current) => {
        const base = current ?? loadState(key);
        const ids = new Set([...base.readIds, ...items.map((item) => item.id)]);
        const next: ReadState = {
          ...base,
          readIds: Array.from(ids).slice(-MAX_READ_IDS),
        };
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [key],
  );

  const markSeenUpTo = React.useCallback(
    (timestamp: number) => {
      setState((current) => {
        const base = current ?? loadState(key);
        if (timestamp <= base.firstSeenAt) return base;
        const next: ReadState = { ...base, firstSeenAt: timestamp };
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [key],
  );

  const countUnread = React.useCallback(
    (items: AppNotification[]) => {
      if (!state) return 0;
      return items.filter((item) => item.createdAt > state.firstSeenAt && !state.readIds.includes(item.id))
        .length;
    },
    [state],
  );

  const isRead = React.useCallback(
    (id: string) => Boolean(state?.readIds.includes(id)),
    [state],
  );

  const isUnread = React.useCallback(
    (item: AppNotification) => {
      if (!state) return false;
      return item.createdAt > state.firstSeenAt && !state.readIds.includes(item.id);
    },
    [state],
  );

  return {
    ready: state !== null,
    isRead,
    isUnread,
    countUnread,
    markRead,
    markAllRead,
    markSeenUpTo,
  };
}

// ---------------------------------------------------------------------------
// User notifications — derived from the portfolio store
// ---------------------------------------------------------------------------

function activityCopy(entry: Activity): { title: string; description?: string; icon: LucideIcon; tone?: NotificationTone } {
  const symbol = entry.symbol ?? "";
  const qty = entry.qty ?? 0;

  switch (entry.type) {
    case "buy":
      return {
        title: `Bought ${formatShares(qty)} ${symbol}`.trim(),
        description: entry.price ? `Filled at ${formatMoney(entry.price)}` : undefined,
        icon: ArrowUpRightIcon,
        tone: "default",
      };
    case "sell":
      return {
        title: `Sold ${formatShares(qty)} ${symbol}`.trim(),
        description: entry.price ? `Filled at ${formatMoney(entry.price)}` : undefined,
        icon: ArrowDownRightIcon,
        tone: "default",
      };
    case "deposit":
      return {
        title: "Deposit received",
        description: entry.note ?? "Cash added to your account",
        icon: BanknoteIcon,
        tone: "gain",
      };
    case "withdraw":
      return {
        title: "Withdrawal processed",
        description: entry.note ?? "Cash left your account",
        icon: BanknoteIcon,
        tone: "loss",
      };
    case "dividend":
      return {
        title: `Dividend from ${symbol}`.trim(),
        description: "Paid into your cash balance",
        icon: CoinsIcon,
        tone: "gain",
      };
    case "fee":
      return {
        title: "Fee charged",
        description: entry.note,
        icon: ReceiptTextIcon,
        tone: "loss",
      };
    case "cancel":
      return {
        title: `Order cancelled${symbol ? ` · ${symbol}` : ""}`,
        description: entry.note,
        icon: XCircleIcon,
        tone: "default",
      };
    default:
      return { title: "Account update", description: entry.note, icon: ReceiptTextIcon };
  }
}

/**
 * Turns the user's own history into a notification feed: fills, cash movements,
 * dividends and any limit order still waiting in the book.
 */
export function buildUserNotifications(state: PortfolioState, limit = 12): AppNotification[] {
  const items: AppNotification[] = [];

  for (const order of state.orders) {
    if (order.status !== "pending") continue;
    items.push({
      id: `order:${order.id}`,
      title: `${order.side === "buy" ? "Buy" : "Sell"} order waiting`,
      description:
        order.type === "limit" && order.limitPrice
          ? `${formatShares(order.qty)} ${order.symbol} @ ${formatMoney(order.limitPrice)} — fills when the price gets there`
          : `${formatShares(order.qty)} ${order.symbol} is queued`,
      createdAt: order.createdAt,
      icon: HourglassIcon,
      href: "/app/activity",
      meta: formatMoney(order.notional),
    });
  }

  for (const entry of state.activity) {
    const copy = activityCopy(entry);
    items.push({
      id: `activity:${entry.id}`,
      title: copy.title,
      description: copy.description,
      createdAt: entry.createdAt,
      icon: copy.icon,
      tone: copy.tone,
      href: "/app/activity",
      meta: formatMoney(entry.amount),
    });
  }

  return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}
