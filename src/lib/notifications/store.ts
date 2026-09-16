import type { SupabaseClient } from "@supabase/supabase-js";

import { uniqueId } from "@/lib/utils";
import {
  normaliseAudience,
  normaliseKind,
  type AppNotification,
  type NotificationAudience,
  type NotificationDraft,
} from "./types";

/**
 * Notification storage.
 *
 * Two backends behind one shape:
 *   • **Postgres** (`public.notifications`, migration 0003) for signed-in
 *     accounts — rows are written by database triggers (new sign-up, new
 *     feedback, an admin reply, an account being disabled) and by the app when
 *     something happens to your portfolio. Row Level Security decides what you
 *     can read: your own `audience = 'user'` rows, plus every
 *     `audience = 'admin'` row if you are an admin.
 *   • **localStorage** for the local demo (no Supabase configured), so the bell
 *     still does something useful without a database.
 *
 * Read state: a user's own notifications use the `read_at` column (it follows
 * them across devices). Admin rows are shared system events — marking one read
 * must not clear it for the next admin — so admin read state is kept per
 * browser instead.
 */

/** Fired whenever the localStorage feed changes, so the bell can refresh. */
export const LOCAL_NOTIFICATIONS_EVENT = "monievest:notifications";

const LOCAL_KEY = "monievest.notifications.local.v1";
const adminReadKey = (userId: string) => `monievest.notifications.admin-read.v1:${userId}`;

const MAX_LOCAL_ITEMS = 50;
const MAX_ADMIN_READ_IDS = 400;
/** Rows fetched per audience — the bell is a digest, not an archive. */
export const MAX_FETCHED = 40;

export type NotificationResult = { ok: boolean; error?: string };

type NotificationRow = Record<string, unknown>;

type LocalRecord = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: number;
  read: boolean;
};

function toMillis(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

/** True when the error means "you have not run 0003_notifications.sql yet". */
export function isMissingTable(error: string | null | undefined): boolean {
  if (!error) return false;
  const message = error.toLowerCase();
  return message.includes("42p01") || (message.includes("notifications") && message.includes("does not exist"));
}

function fromRow(row: NotificationRow, adminReadIds: ReadonlySet<string>): AppNotification {
  const id = String(row.id ?? "");
  const audience = normaliseAudience(row.audience);
  const createdAt = toMillis(row.created_at, Date.now());
  const read =
    audience === "admin" ? adminReadIds.has(id) : row.read_at !== null && row.read_at !== undefined;

  return {
    id,
    audience,
    kind: normaliseKind(row.kind),
    title: String(row.title ?? "Notification"),
    body: row.body === null || row.body === undefined ? null : String(row.body),
    href: row.href === null || row.href === undefined ? null : String(row.href),
    createdAt,
    read,
  };
}

// ---------------------------------------------------------------------------
// Postgres
// ---------------------------------------------------------------------------

export async function fetchRemoteNotifications(
  client: SupabaseClient,
  audience: NotificationAudience,
): Promise<{ ok: true; items: AppNotification[] } | { ok: false; error: string }> {
  const { data: session } = await client.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) return { ok: true, items: [] };

  const adminReadIds = audience === "admin" ? new Set(readAdminReadIds(userId)) : new Set<string>();

  // RLS scopes this: a user only ever receives their own `audience='user'`
  // rows, and `audience='admin'` rows come back only for admins.
  const { data, error } = await client
    .from("notifications")
    .select("id,audience,kind,title,body,href,read_at,created_at")
    .eq("audience", audience)
    .order("created_at", { ascending: false })
    .limit(MAX_FETCHED);

  if (error) return { ok: false, error: error.message };
  return { ok: true, items: ((data ?? []) as NotificationRow[]).map((row) => fromRow(row, adminReadIds)) };
}

export async function markRemoteRead(client: SupabaseClient, id: string): Promise<NotificationResult> {
  const { error } = await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function markAllRemoteRead(client: SupabaseClient): Promise<NotificationResult> {
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("audience", "user")
    .is("read_at", null);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Inserts a notification for the signed-in account (their own bell). */
export async function pushRemoteNotification(
  client: SupabaseClient,
  userId: string,
  draft: NotificationDraft,
): Promise<NotificationResult> {
  const { error } = await client.from("notifications").insert({
    user_id: userId,
    audience: "user",
    kind: draft.kind ?? "info",
    title: draft.title.slice(0, 160),
    body: draft.body ? draft.body.slice(0, 600) : null,
    href: draft.href ?? null,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ---------------------------------------------------------------------------
// Admin read state (per browser)
// ---------------------------------------------------------------------------

export function readAdminReadIds(userId: string): string[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.localStorage.getItem(adminReadKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function addAdminReadIds(userId: string, ids: string[]): string[] {
  if (!userId || ids.length === 0) return readAdminReadIds(userId);
  const next = Array.from(new Set([...readAdminReadIds(userId), ...ids])).slice(-MAX_ADMIN_READ_IDS);
  try {
    window.localStorage.setItem(adminReadKey(userId), JSON.stringify(next));
  } catch {
    /* storage unavailable — the bell still works, it just forgets on reload */
  }
  return next;
}

// ---------------------------------------------------------------------------
// localStorage (local demo mode)
// ---------------------------------------------------------------------------

export function readLocalNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as LocalRecord[])
      .filter((row) => row && typeof row.id === "string" && typeof row.title === "string")
      .map((row) => ({
        id: row.id,
        audience: "user" as const,
        kind: normaliseKind(row.kind),
        title: row.title,
        body: row.body ?? null,
        href: row.href ?? null,
        createdAt: Number.isFinite(row.createdAt) ? row.createdAt : Date.now(),
        read: row.read === true,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function emitLocalChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LOCAL_NOTIFICATIONS_EVENT));
}

function writeLocalNotifications(items: AppNotification[]): void {
  try {
    const records: LocalRecord[] = items.slice(0, MAX_LOCAL_ITEMS).map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      body: item.body,
      href: item.href,
      createdAt: item.createdAt,
      read: item.read,
    }));
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
    emitLocalChange();
  } catch {
    /* ignore quota errors */
  }
}

/** Used by the demo build: trades and deposits still raise a notification. */
export function pushLocalNotification(draft: NotificationDraft): AppNotification {
  const item: AppNotification = {
    id: uniqueId("ntf"),
    audience: normaliseAudience(draft.audience),
    kind: draft.kind ?? "info",
    title: draft.title,
    body: draft.body ?? null,
    href: draft.href ?? null,
    createdAt: Date.now(),
    read: false,
  };
  writeLocalNotifications([item, ...readLocalNotifications()]);
  return item;
}

export function setLocalRead(ids: string[]): void {
  if (ids.length === 0) return;
  const wanted = new Set(ids);
  writeLocalNotifications(
    readLocalNotifications().map((item) => (wanted.has(item.id) ? { ...item, read: true } : item)),
  );
}

export function markAllLocalRead(): void {
  writeLocalNotifications(readLocalNotifications().map((item) => ({ ...item, read: true })));
}

// ---------------------------------------------------------------------------
// One entry point for the rest of the app
// ---------------------------------------------------------------------------

/**
 * Raises a notification for the current account. Writes to Postgres when a
 * session exists, otherwise to localStorage so demo mode still notifies.
 * Never throws — a missing notifications table must not break a trade.
 */
export async function pushNotification(
  client: SupabaseClient | null,
  userId: string | null,
  draft: NotificationDraft,
): Promise<NotificationResult> {
  if (client && userId) {
    const result = await pushRemoteNotification(client, userId, draft);
    if (result.ok || !isMissingTable(result.error)) return result;
    // Table not migrated yet — fall through to the local copy.
  }
  pushLocalNotification(draft);
  return { ok: true };
}
