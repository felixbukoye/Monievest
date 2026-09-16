import type { SupabaseClient } from "@supabase/supabase-js";
import { CandlestickChartIcon, MessageSquareIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";

import { formatMoney, formatShares } from "@/lib/format";
import type { AppNotification } from "@/lib/notifications";

/**
 * Admin notifications.
 *
 * There is no notifications table — admin alerts are *derived* from the same
 * tables the dashboard already reads, so nothing new has to be written or
 * migrated. Everything runs through the admin RLS policies: an ordinary user
 * calling these queries gets zero rows.
 *
 *   • support — tickets still waiting on a reply
 *   • users   — accounts created in the last week
 *   • trading — unusually large orders placed in the last day
 */

export type AdminNotificationTab = "support" | "users" | "trading";

export type AdminNotification = AppNotification & { tab: AdminNotificationTab };

/** New accounts newer than this show up in the bell. */
const SIGNUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Orders newer than this (and above the notional floor) show up in the bell. */
const TRADE_WINDOW_MS = 24 * 60 * 60 * 1000;
const LARGE_TRADE_NOTIONAL = 25_000;
const MAX_ITEMS = 15;

const CATEGORY_LABEL: Record<string, string> = {
  bug: "Bug report",
  feedback: "Feedback",
  feature: "Feature idea",
};

function firstLine(message: string, max = 90): string {
  const flat = message.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function when(value: unknown): number {
  const time = new Date(String(value ?? Date.now())).getTime();
  return Number.isFinite(time) ? time : Date.now();
}

export async function fetchAdminNotifications(
  client: SupabaseClient,
  now: number = Date.now(),
): Promise<{ ok: true; items: AdminNotification[] } | { ok: false; error: string }> {
  const [tickets, signups, trades] = await Promise.all([
    client
      .from("feedback")
      .select("id,email,category,message,status,created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(25),
    client
      .from("profiles")
      .select("id,display_name,email,created_at")
      .gte("created_at", new Date(now - SIGNUP_WINDOW_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(25),
    client
      .from("orders")
      .select("id,symbol,side,qty,notional,status,created_at")
      .gte("created_at", new Date(now - TRADE_WINDOW_MS).toISOString())
      .gte("notional", LARGE_TRADE_NOTIONAL)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  if (tickets.error) return { ok: false, error: tickets.error.message };
  if (signups.error) return { ok: false, error: signups.error.message };
  if (trades.error) return { ok: false, error: trades.error.message };

  const items: AdminNotification[] = [];

  for (const row of tickets.data ?? []) {
    const category = String(row.category ?? "feedback");
    items.push({
      id: `feedback:${row.id}`,
      title: `${CATEGORY_LABEL[category] ?? "Feedback"} waiting on a reply`,
      description: `${firstLine(String(row.message ?? ""))}${row.email ? ` — ${row.email}` : ""}`,
      createdAt: when(row.created_at),
      icon: category === "bug" ? TriangleAlertIcon : MessageSquareIcon,
      tone: category === "bug" ? "warning" : "default",
      tab: "support",
    });
  }

  for (const row of signups.data ?? []) {
    const name = String(row.display_name ?? "Investor");
    items.push({
      id: `signup:${row.id}`,
      title: "New account created",
      description: `${name}${row.email ? ` · ${row.email}` : ""} joined the platform`,
      createdAt: when(row.created_at),
      icon: UsersIcon,
      tab: "users",
    });
  }

  for (const row of trades.data ?? []) {
    const side = row.side === "sell" ? "Sell" : "Buy";
    items.push({
      id: `trade:${row.id}`,
      title: `Large ${side.toLowerCase()} order`,
      description: `${formatShares(Number(row.qty ?? 0))} ${String(row.symbol ?? "")} · ${String(row.status ?? "filled")}`,
      createdAt: when(row.created_at),
      icon: CandlestickChartIcon,
      meta: formatMoney(Number(row.notional ?? 0), { decimals: false }),
      tab: "trading",
    });
  }

  items.sort((a, b) => b.createdAt - a.createdAt);

  return { ok: true, items: items.slice(0, MAX_ITEMS) };
}
