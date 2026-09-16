import { NextResponse } from "next/server";

import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The admin-curated stock universe (see `demo_stocks` in migration 0002).
 *
 * Returns the stocks admins added plus the built-in catalog stocks they
 * disabled. The client applies it on boot (see `src/lib/market/universe.ts`).
 * With no Supabase project, or for signed-out visitors, RLS returns no rows
 * and the response is an empty universe — the curated catalog stays intact.
 */
export async function GET() {
  const supabase = await createSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ custom: [], disabled: [], updatedAt: 0 });
  }

  const { data, error } = await supabase
    .from("demo_stocks")
    .select("symbol,name,kind,sector,reference_price,source,enabled,updated_at");

  if (error) {
    // Missing migration / table — degrade to the plain catalog.
    return NextResponse.json({ custom: [], disabled: [], updatedAt: 0 });
  }

  const rows = data ?? [];

  const custom = rows
    .filter((row) => row.source === "custom" && row.enabled)
    .map((row) => ({
      symbol: String(row.symbol).toUpperCase(),
      name: row.name,
      kind: row.kind === "etf" ? "etf" : "stock",
      sector: row.sector ?? null,
      price: Number(row.reference_price) || 0,
      updated_at: row.updated_at ?? null,
    }))
    .filter((row) => row.price > 0);

  const disabled = rows
    .filter((row) => row.source === "catalog" && !row.enabled)
    .map((row) => String(row.symbol).toUpperCase());

  return NextResponse.json({ custom, disabled, updatedAt: Date.now() });
}
