"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { buildUserNotifications, useNotificationReadState } from "@/lib/notifications";
import { usePortfolio } from "@/lib/store/provider";

/**
 * Investor-facing bell: fills, cash movements, dividends and open limit orders
 * from this account's own history. Opening the menu counts everything currently
 * listed as seen, so the badge only ever shows genuinely new events.
 */
export function UserNotificationBell() {
  const router = useRouter();
  const { state, hydrated, auth } = usePortfolio();
  const read = useNotificationReadState("user", auth.userId);

  const items = React.useMemo(() => buildUserNotifications(state), [state]);
  const unreadCount = read.countUnread(items);

  return (
    <NotificationBell
      title="Notifications"
      subtitle={hydrated ? "Your orders, fills and cash movements" : "Loading your activity…"}
      items={items}
      unreadCount={unreadCount}
      loading={!hydrated || !read.ready}
      isUnread={read.isUnread}
      emptyLabel="Nothing yet — trades, deposits and dividends will show up here."
      onOpenChange={(open) => {
        if (open) read.markSeenUpTo(Date.now());
      }}
      onSelect={(item) => {
        read.markRead(item.id);
        if (item.href) router.push(item.href);
      }}
      onMarkAllRead={() => read.markAllRead(items)}
      footer={
        <button
          type="button"
          onClick={() => router.push("/app/activity")}
          className="w-full rounded-lg px-2.5 py-2 text-left text-[12px] font-medium text-primary transition-colors hover:bg-primary/10"
        >
          View all activity
        </button>
      }
    />
  );
}
