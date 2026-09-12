"use client";

import { CheckIcon, CloudIcon, CloudOffIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";

import { usePortfolio } from "@/lib/store/provider";
import { cn } from "@/lib/utils";

type Tone = "muted" | "active" | "warning";

/**
 * Where the portfolio currently lives: this browser only, or the signed-in
 * user's rows in Supabase. Also reports in-flight saves and sync failures.
 */
export function SyncStatus({ className, showLabel = true }: { className?: string; showLabel?: boolean }) {
  const { auth, sync } = usePortfolio();

  let Icon = CloudIcon;
  let label = "Connected";
  let tone: Tone = "muted";
  let title = "Portfolio sync";

  if (!auth.configured) {
    Icon = CloudOffIcon;
    label = "Local demo";
    tone = "muted";
    title =
      "Supabase is not configured, so this portfolio is stored in this browser only. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable accounts.";
  } else if (auth.status !== "authenticated") {
    Icon = CloudOffIcon;
    label = "Guest mode";
    tone = "muted";
    title = "Not signed in — changes are kept in this browser until you create an account.";
  } else if (sync.status === "syncing") {
    Icon = LoaderCircleIcon;
    label = "Saving…";
    tone = "active";
    title = "Writing your latest changes to Supabase";
  } else if (sync.status === "error") {
    Icon = TriangleAlertIcon;
    label = "Sync issue";
    tone = "warning";
    title = sync.error ? `Last sync failed: ${sync.error}` : "Could not reach Supabase on the last save";
  } else if (sync.status === "synced") {
    Icon = CheckIcon;
    label = sync.lastSyncedAt
      ? `Saved ${new Date(sync.lastSyncedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
      : "Saved";
    tone = "muted";
    title = "Everything is up to date in Supabase";
  }

  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[11px] font-medium",
        tone === "warning" && "text-loss-foreground",
        tone === "active" && "text-primary",
        tone === "muted" && "text-muted-foreground",
        className,
      )}
      title={title}
    >
      <Icon className={cn("size-3.5", sync.status === "syncing" && "animate-spin")} />
      {showLabel && <span className="truncate">{label}</span>}
    </span>
  );
}
