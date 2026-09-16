"use client";

import { BellIcon, CheckCheckIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/format";
import type { AppNotification, NotificationTone } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<NotificationTone, string> = {
  default: "bg-secondary text-muted-foreground",
  gain: "bg-gain-soft text-gain",
  loss: "bg-loss-soft text-loss",
  warning: "bg-warning/15 text-warning",
};

type NotificationBellProps = {
  items: AppNotification[];
  unreadCount: number;
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  title: string;
  subtitle?: string;
  emptyLabel: string;
  /** Lets the menu dot the entries that are still unread. */
  isUnread?: (item: AppNotification) => boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (item: AppNotification) => void;
  onMarkAllRead?: () => void;
  onRefresh?: () => void;
  footer?: ReactNode;
};

/**
 * The notification bell shared by both dashboards. It knows nothing about where
 * notifications come from — the user and admin variants hand it a list and the
 * callbacks for "clicked" / "mark everything read".
 */
export function NotificationBell({
  items,
  unreadCount,
  loading = false,
  refreshing = false,
  error = null,
  title,
  subtitle,
  emptyLabel,
  isUnread,
  onOpenChange,
  onSelect,
  onMarkAllRead,
  onRefresh,
  footer,
}: NotificationBellProps) {
  const badge = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="card-soft relative flex size-10 items-center justify-center rounded-full border border-border/70 bg-card transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : "Notifications"}
        >
          <BellIcon className="size-4 text-muted-foreground" />
          {unreadCount > 0 ? (
            <span className="tnum absolute -top-1 -right-1 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] leading-none font-semibold text-primary-foreground">
              {badge}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <DropdownMenuLabel className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2">
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
              {title}
              {unreadCount > 0 ? (
                <span className="tnum rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {unreadCount} new
                </span>
              ) : null}
            </span>
            {subtitle ? (
              <span className="text-[11px] font-normal text-muted-foreground">{subtitle}</span>
            ) : null}
          </span>

          <span className="flex shrink-0 items-center gap-0.5">
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Refresh notifications"
              >
                <RefreshCwIcon className={cn("size-3.5", refreshing && "animate-spin")} />
              </button>
            ) : null}
            {onMarkAllRead && unreadCount > 0 ? (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <CheckCheckIcon className="size-3.5" />
                Mark all read
              </button>
            ) : null}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {error ? (
          <p className="px-3.5 py-4 text-[12.5px] text-loss">{error}</p>
        ) : loading ? (
          <div className="space-y-2.5 p-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-start gap-2.5">
                <Skeleton className="size-8 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/5" />
                  <Skeleton className="h-2.5 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[12.5px] text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ScrollArea className="max-h-[min(26rem,60vh)]">
            <div className="p-1.5">
              {items.map((item) => {
                const unread = isUnread?.(item) ?? false;
                return (
                  <DropdownMenuItem
                    key={item.id}
                    onSelect={() => onSelect?.(item)}
                    className="items-start gap-2.5 px-2.5 py-2"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                        TONE_CLASS[item.tone ?? "default"],
                      )}
                    >
                      <item.icon className="size-4" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-1.5">
                        <span className="min-w-0 flex-1 text-[12.5px] leading-snug font-medium text-foreground">
                          {item.title}
                        </span>
                        {unread ? (
                          <span
                            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                            aria-label="Unread"
                          />
                        ) : null}
                      </span>
                      {item.description ? (
                        <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                      <span className="mt-0.5 block text-[10.5px] text-muted-foreground/80">
                        {relativeTime(item.createdAt)}
                      </span>
                    </span>

                    {item.meta ? (
                      <span className="tnum mt-0.5 shrink-0 text-[11.5px] font-semibold text-foreground">
                        {item.meta}
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {footer ? (
          <>
            <DropdownMenuSeparator />
            <div className="p-1.5">{footer}</div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
