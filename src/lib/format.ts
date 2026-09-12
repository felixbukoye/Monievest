/** Shared money / number formatting helpers for the whole app. */

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const number0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const number2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number, opts?: { decimals?: boolean }): string {
  if (!Number.isFinite(value)) return "$0.00";
  return opts?.decimals === false ? usd0.format(value) : usd2.format(value);
}

export function formatCompactMoney(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  const sign = value < 0 ? "-" : "";
  return `${sign}${compact.format(Math.abs(value))}`;
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "0";
  return decimals === 0 ? number0.format(value) : number2.format(value);
}

/** Share quantities can be fractional on Monievest. */
export function formatShares(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const isWhole = Math.abs(value - Math.round(value)) < 1e-9;
  if (isWhole) return number0.format(Math.round(value));
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatPercent(value: number, opts?: { sign?: boolean; decimals?: number }): string {
  if (!Number.isFinite(value)) return "0%";
  const decimals = opts?.decimals ?? 2;
  const sign = opts?.sign !== false && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatSignedMoney(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${usd2.format(Math.abs(value))}`;
}

export function formatVolume(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateTime(iso: string | number | Date): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | number | Date): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatClockLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string | number | Date): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return formatDate(then);
}

/** Colour token for a profit/loss value. */
export function pnlTone(value: number): "gain" | "loss" | "muted" {
  if (value > 0.0000001) return "gain";
  if (value < -0.0000001) return "loss";
  return "muted";
}
