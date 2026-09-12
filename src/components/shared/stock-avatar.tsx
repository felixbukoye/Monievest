"use client";

import { getInstrument } from "@/lib/market/catalog";
import { cn } from "@/lib/utils";

/**
 * Ticker monogram tile. Colour comes from the instrument's accent so a
 * holding is instantly recognisable across tables, charts and the sidebar.
 */
export function StockAvatar({
  symbol,
  className,
  size = "md",
  tone = "soft",
}: {
  symbol: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  /** `solid` paints the brand colour full-bleed with a white monogram. */
  tone?: "soft" | "solid";
}) {
  const instrument = getInstrument(symbol);
  const color = instrument?.color ?? "var(--color-primary)";
  const letters = symbol.replace(".", "").slice(0, 3);

  const dimensions = {
    xs: "size-6 rounded-md text-[9px]",
    sm: "size-7 rounded-md text-[10px]",
    md: "size-9 rounded-lg text-[11px]",
    lg: "size-11 rounded-xl text-sm",
  }[size];

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center font-bold tracking-tight",
        tone === "soft" && "border",
        dimensions,
        className,
      )}
      style={
        tone === "solid"
          ? {
              color: "#fff",
              // darkened so a white monogram stays legible on light brand hues
              background: `color-mix(in oklab, ${color} 78%, #1b1b22)`,
              boxShadow: `0 8px 18px -12px ${color}`,
            }
          : {
              color,
              borderColor: `color-mix(in oklab, ${color} 32%, transparent)`,
              background: `color-mix(in oklab, ${color} 14%, transparent)`,
            }
      }
      aria-hidden="true"
    >
      {letters}
    </span>
  );
}
