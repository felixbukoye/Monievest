"use client";

import { useRouter } from "next/navigation";
import {
  BadgeCheckIcon,
  BellIcon,
  BellOffIcon,
  CheckCheckIcon,
  InfoIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/format";
import { useNotifications } from "@/lib/notifications/use-notifications";
import type { NotificationAudience, NotificationKind } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

const KIND_META: Record<NotificationKind, { icon: typeof InfoIcon; className: string }> = {
  info: { icon: InfoIcon, className: "bg-secondary text-muted-foreground" },
  success: { icon: BadgeCheckIcon, className: "bg-gain-soft text-gain" },
  warning: { icon: TriangleAlertIcon, className: "bg-warning/15 text-warning" },
  alert: { icon: ShieldAlertIcon, className: "bg-loss-soft text-loss" },
};

const AUDIENCE_LABEL: Record<NotificationAudience, string> = {
  user: "Your account",
  admin: "Admin console",
};

const EMPTY_COPY: Record<NotificationAudience, { title: string; body: string }> = {
  user: {
    title: "You're all caught up",
    body: "Fills, funding and replies from support land here.",
  },
  admin: {
    title: "Nothing needs you yet",
    body: "New sign-ups and incoming feedback appear here as they happen.",
  },
};

/**
 * The notification bell.
 *
 * The same component serves both dashboards — `audience` decides whose feed it
 * reads. On the investor dashboard it shows that person's own notifications;
 * inside the admin console it shows the platform-wide ones (new sign-ups, new
 * feedback). The database, through RLS, is what keeps the two apart.
 */
export function NotificationBell({ audience }: { audience: NotificationAudience }) {
  const router = useRouter();
  const { items, unread, loading, error, missingTable, refresh, markRead, markAllRead } =
    useNotifications(audience);
  const [open, setOpen] = React.useState(false);
  const empty = EMPTY_COPY[audience];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
          title="Notifications"
          className="card-soft relative flex size-10 items-center justify-center rounded-full border border-border/70 bg-card transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <BellIcon className="size-4 text-muted-foreground" />
          {unread > 0 ? (
            <span className="tnum absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(23rem,calc(100vw-2rem))] p-0">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 px-3 py-2.5 normal-case">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              {AUDIENCE_LABEL[audience]}
            </span>
          </span>
          <span className="flex items-center gap-1">
            {unread > 0 ? <Badge variant="default">{unread} new</Badge> : null}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg"
              aria-label="Refresh notifications"
              onClick={() => refresh()}
            >
              <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {error ? (
          <div className="px-3 py-3 text-[12px] text-muted-foreground">
            {missingTable ? (
              <>
                <p className="font-medium text-foreground">Notifications are not set up yet</p>
                <p className="mt-1">
                  Run{" "}
                  <code className="font-mono text-[11px]">supabase/migrations/0003_notifications.sql</code>{" "}
                  in the Supabase SQL Editor, then refresh.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">Could not load notifications</p>
                <p className="mt-1">{error}</p>
              </>
            )}
          </div>
        ) : null}

        {!error && loading ? (
          <div className="space-y-2 px-3 py-3">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex gap-2.5">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!error && !loading && items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-7 text-center">
            <BellOffIcon className="size-5 text-muted-foreground" />
            <p className="text-[13px] font-medium">{empty.title}</p>
            <p className="max-w-[16rem] text-[11.5px] text-muted-foreground">{empty.body}</p>
          </div>
        ) : null}

        {!error && !loading && items.length > 0 ? (
          <div className="max-h-[22rem] overflow-y-auto py-1">
            {items.map((item) => {
              const meta = KIND_META[item.kind];
              return (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={() => {
                    markRead(item.id);
                    if (item.href) router.push(item.href);
                  }}
                  className={cn(
                    "mx-1 flex w-auto items-start gap-2.5 rounded-lg px-2 py-2.5",
                    !item.read && "bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                      meta.className,
                    )}
                  >
                    <meta.icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "truncate text-[12.5px]",
                          item.read ? "font-medium text-muted-foreground" : "font-semibold",
                        )}
                      >
                        {item.title}
                      </span>
                      {!item.read ? (
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                      ) : null}
                    </span>
                    {item.body ? (
                      <span className="mt-0.5 line-clamp-2 block text-[11.5px] text-muted-foreground">
                        {item.body}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-[10.5px] text-muted-foreground/80">
                      {relativeTime(item.createdAt)}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </div>
        ) : null}

        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-[10.5px] text-muted-foreground">Checks for new events every 45s</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11.5px]"
            disabled={unread === 0}
            onClick={() => markAllRead()}
          >
            <CheckCheckIcon />
            Mark all read
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
