/** Who a notification is for — the two bells in the app read different rows. */
export type NotificationAudience = "user" | "admin";

/** Drives the icon and colour of a row in the bell. */
export type NotificationKind = "info" | "success" | "warning" | "alert";

export type AppNotification = {
  id: string;
  audience: NotificationAudience;
  kind: NotificationKind;
  title: string;
  body: string | null;
  /** In-app destination; `null` for information-only rows. */
  href: string | null;
  /** Epoch millis. */
  createdAt: number;
  read: boolean;
};

/** What callers hand to `pushNotification()` — id/timestamps are filled in. */
export type NotificationDraft = {
  title: string;
  body?: string | null;
  kind?: NotificationKind;
  href?: string | null;
  /** Defaults to `"user"`: nearly everything is about the signed-in account. */
  audience?: NotificationAudience;
};

export const NOTIFICATION_KINDS: NotificationKind[] = ["info", "success", "warning", "alert"];

export function normaliseKind(value: unknown): NotificationKind {
  return NOTIFICATION_KINDS.includes(value as NotificationKind) ? (value as NotificationKind) : "info";
}

export function normaliseAudience(value: unknown): NotificationAudience {
  return value === "admin" ? "admin" : "user";
}
