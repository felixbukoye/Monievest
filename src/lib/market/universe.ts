import { buildInstrument } from "./providers/instrument-factory";
import { registerInstrument, setDisabledSymbols } from "./registry";
import { marketStore } from "./store";
import type { Instrument, InstrumentKind } from "./types";

/**
 * ---------------------------------------------------------------------------
 * Admin-curated stock universe
 * ---------------------------------------------------------------------------
 * Admins manage the demo stock list from the admin dashboard (stored in the
 * `demo_stocks` table). `/api/stocks` publishes the result: stocks added by
 * admins plus any built-in catalog stocks an admin disabled. On boot the
 * MarketProvider applies that payload so the changes reach every user:
 *
 *   • added stocks   → registered as instruments + given a simulated quote,
 *   • disabled stocks → removed from the quote board and hidden from lists.
 */

export type UniverseStockRow = {
  symbol: string;
  name: string;
  kind: "stock" | "etf";
  sector: string | null;
  /** Demo reference price set by the admin. */
  price: number;
  updated_at: string | null;
};

export type UniversePayload = {
  custom: UniverseStockRow[];
  disabled: string[];
  updatedAt: number;
};

export async function fetchUniverse(): Promise<UniversePayload | null> {
  try {
    const response = await fetch("/api/stocks", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as UniversePayload;
  } catch {
    return null;
  }
}

/** Build an instrument for an admin-added stock and put it on the board. */
function toInstrument(row: UniverseStockRow): Instrument {
  return buildInstrument({
    symbol: row.symbol,
    name: row.name,
    kind: (row.kind === "etf" ? "etf" : "stock") as InstrumentKind,
    industry: row.sector ?? undefined,
    price: row.price,
    about: `${row.name} (${row.symbol}) is a demo instrument curated by the Monievest team. Its price is simulated locally — like everything else here, it is not a real quote.`,
    tags: ["Admin curated"],
  });
}

/** Registers the payload's instruments and updates the quote board. */
export function applyUniversePayload(payload: UniversePayload): void {
  if (typeof window === "undefined") return;

  setDisabledSymbols(payload.disabled);

  const added: Instrument[] = [];
  for (const row of payload.custom) {
    const symbol = row.symbol?.toUpperCase();
    if (!symbol || payload.disabled.includes(symbol)) continue;
    const instrument = toInstrument({ ...row, symbol });
    registerInstrument(instrument);
    added.push(instrument);
  }

  marketStore.applyUniverse({ add: added, remove: payload.disabled });
}
