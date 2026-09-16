"use client";

import * as React from "react";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { usePortfolio } from "@/lib/store/provider";
import {
  addAdminReadIds,
  fetchRemoteNotifications,
  LOCAL_NOTIFICATIONS_EVENT,
  isMissingTable,
  markAllLocalRead,
  markAllRemoteRead,
  markRemoteRead,
  readLocalNotifications,
  setLocalRead,
} from "./store";
import type { AppNotification, NotificationAudience } from "./types";

/** How often the bell quietly re-checks Postgres for new rows. */
const POLL_MS = 45_000;

export type NotificationsApi = {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  /** Populated when Postgres could not be read. */
  error: string | null;
  /** True when the failure is "the notifications table does not exist". */
  missingTable: boolean;
  /** `remote` = Postgres, `local` = localStorage demo mode. */
  source: "remote" | "local";
  refresh: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

/**
 * Reads the notifications belonging to one audience.
 *
 * `audience="user"` powers the bell on the investor dashboard (fills, funding,
 * replies from support, account changes); `audience="admin"` powers the one in
 * the admin console (new sign-ups, incoming feedback). Row Level Security — not
 * this hook — decides which rows exist, so asking for the wrong audience only
 * ever returns an empty list.
 */
export function useNotifications(audience: NotificationAudience): NotificationsApi {
  const { auth } = usePortfolio();
  const supabase = React.useMemo(() => getSupabaseBrowser(), []);

  // The admin feed is only reachable once the role is known to be admin.
  const remote =
    !!supabase &&
    auth.status === "authenticated" &&
    (audience === "user" || auth.role === "admin");
  const userId = auth.userId;

  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!remote || !supabase) {
      // Demo mode has no accounts, hence no admin console and no admin feed.
      setItems(audience === "admin" ? [] : readLocalNotifications());
      setError(null);
      setLoading(false);
      return;
    }

    const result = await fetchRemoteNotifications(supabase, audience);
    if (result.ok) {
      setItems(result.items);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [remote, supabase, audience]);

  // Deferred so the effect never calls setState during the render pass.
  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Poll, and re-check as soon as the tab is looked at again.
  React.useEffect(() => {
    if (!remote) return;
    const timer = window.setInterval(() => void load(), POLL_MS);
    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [remote, load]);

  // Demo mode: re-read as soon as something writes to the local feed.
  React.useEffect(() => {
    if (remote) return;
    function onLocalChange() {
      void load();
    }
    window.addEventListener(LOCAL_NOTIFICATIONS_EVENT, onLocalChange);
    return () => window.removeEventListener(LOCAL_NOTIFICATIONS_EVENT, onLocalChange);
  }, [remote, load]);

  const markRead = React.useCallback(
    (id: string) => {
      const target = items.find((item) => item.id === id);
      if (!target || target.read) return;
      setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));

      if (!remote || !supabase) {
        setLocalRead([id]);
        return;
      }
      // Admin rows are shared, so their read state stays in this browser.
      if (audience === "admin") {
        if (userId) addAdminReadIds(userId, [id]);
        return;
      }
      void markRemoteRead(supabase, id).then((result) => {
        if (!result.ok) setError(result.error ?? "Could not mark that notification read");
      });
    },
    [items, remote, supabase, audience, userId],
  );

  const markAllRead = React.useCallback(() => {
    const unreadIds = items.filter((item) => !item.read).map((item) => item.id);
    if (unreadIds.length === 0) return;
    setItems((current) => current.map((item) => ({ ...item, read: true })));

    if (!remote || !supabase) {
      markAllLocalRead();
      return;
    }
    if (audience === "admin") {
      if (userId) addAdminReadIds(userId, unreadIds);
      return;
    }
    void markAllRemoteRead(supabase).then((result) => {
      if (!result.ok) setError(result.error ?? "Could not mark notifications read");
    });
  }, [items, remote, supabase, audience, userId]);

  const unread = React.useMemo(() => items.filter((item) => !item.read).length, [items]);

  return {
    items,
    unread,
    // While the session is still being read we do not know the audience yet.
    loading: loading || auth.status === "loading",
    error,
    missingTable: isMissingTable(error),
    source: remote ? "remote" : "local",
    refresh: () => void load(),
    markRead,
    markAllRead,
  };
}
