"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { adminHref } from "@/components/app/nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { fetchAdminNotifications, type AdminNotification } from "@/lib/admin/notifications";
import { useNotificationReadState } from "@/lib/notifications";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { usePortfolio } from "@/lib/store/provider";

/** How often the admin bell re-checks Supabase while you are on the dashboard. */
const POLL_MS = 60_000;

/**
 * Admin-facing bell: open support tickets, new signups and large trades.
 *
 * Unread state is explicit here (rather than "seen when opened") because an
 * open ticket should keep nagging until it is dismissed or answered. Renders
 * nothing at all when Supabase is not configured, since the admin dashboard
 * itself is unavailable in that mode.
 */
export function AdminNotificationBell() {
  const supabase = React.useMemo(() => getSupabaseBrowser(), []);
  const router = useRouter();
  const { auth } = usePortfolio();
  const read = useNotificationReadState("admin", auth.userId);

  const [items, setItems] = React.useState<AdminNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const loadedOnce = React.useRef(false);

  const load = React.useCallback(async () => {
    if (!supabase) return;
    if (loadedOnce.current) setRefreshing(true);
    else setLoading(true);

    const result = await fetchAdminNotifications(supabase);
    if (result.ok) {
      setItems(result.items);
      setError(null);
    } else {
      setError(result.error);
    }

    loadedOnce.current = true;
    setLoading(false);
    setRefreshing(false);
  }, [supabase]);

  // Deferred so the effect never calls setState during the render pass.
  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  React.useEffect(() => {
    if (!supabase) return;
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load, supabase]);

  if (!supabase) return null;

  const unreadCount = read.countUnread(items);

  return (
    <NotificationBell
      title="Admin notifications"
      subtitle="Support tickets, new signups and large trades"
      items={items}
      unreadCount={unreadCount}
      loading={loading || !read.ready}
      refreshing={refreshing}
      error={error}
      isUnread={read.isUnread}
      emptyLabel="Nothing needs your attention — new tickets, signups and large trades appear here."
      onRefresh={() => void load()}
      onSelect={(item) => {
        read.markRead(item.id);
        const target = items.find((candidate) => candidate.id === item.id);
        router.push(adminHref(target?.tab ?? "overview"));
      }}
      onMarkAllRead={() => read.markAllRead(items)}
    />
  );
}
