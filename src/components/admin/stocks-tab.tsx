"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ActivityIcon,
  BanIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { AdminCard, EmptyNote, ErrorNote, RefreshButton, TableSkeleton } from "./admin-shared";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteDemoStock, fetchDemoStocks, upsertDemoStock, type DemoStockRow } from "@/lib/admin/data";
import { formatDateTime, formatMoney, relativeTime } from "@/lib/format";
import { CATALOG, SECTORS } from "@/lib/market/catalog";
import { fetchLiveConfig, SIMULATED_CONFIG, type LiveConfig } from "@/lib/market/live";
import { useMarketSnapshot } from "@/lib/market/store";
import { cn } from "@/lib/utils";

type StockFormState = {
  symbol: string;
  name: string;
  kind: "stock" | "etf";
  sector: string;
  price: string;
};

const EMPTY_FORM: StockFormState = { symbol: "", name: "", kind: "stock", sector: "Technology", price: "" };

const CATALOG_BY_SYMBOL = new Map(CATALOG.map((instrument) => [instrument.symbol, instrument]));

/** Live health of the quote board, re-evaluated once a second. */
function MarketDataCard() {
  const snapshot = useMarketSnapshot();
  const [config, setConfig] = React.useState<LiveConfig>(SIMULATED_CONFIG);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    void fetchLiveConfig().then(setConfig);
  }, []);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const tickAgeSeconds = snapshot.lastTickAt > 0 ? Math.max(0, Math.round((now - snapshot.lastTickAt) / 1000)) : null;
  const liveAgeSeconds = snapshot.liveUpdatedAt > 0 ? Math.max(0, Math.round((now - snapshot.liveUpdatedAt) / 1000)) : null;

  // The simulator ticks every ~2.2s; a gap over ~7s means the board froze.
  const ticking = tickAgeSeconds !== null && tickAgeSeconds <= 7;
  const liveStale =
    config.live && liveAgeSeconds !== null && liveAgeSeconds > Math.max(30, config.cacheSeconds) * 2.5;

  const overall: { label: string; tone: "gain" | "loss" | "warning" } = !snapshot.ready
    ? { label: "Warming up", tone: "warning" }
    : snapshot.liveError
      ? { label: "Provider error", tone: "loss" }
      : liveStale
        ? { label: "Live prices stale", tone: "warning" }
        : ticking
          ? { label: "Updating correctly", tone: "gain" }
          : { label: "Board not ticking", tone: "warning" };

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Price source",
      value: config.live ? `${config.label} (live)` : `${config.label} — deterministic, seeded per ticker`,
    },
    {
      label: "Board status",
      value: (
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-2 rounded-full",
              overall.tone === "gain" && "bg-gain",
              overall.tone === "warning" && "bg-warning",
              overall.tone === "loss" && "bg-loss",
            )}
          />
          {overall.label}
          {tickAgeSeconds !== null ? <span className="text-muted-foreground">· last tick {tickAgeSeconds}s ago</span> : null}
        </span>
      ),
    },
    {
      label: "Live symbols on board",
      value: `${snapshot.liveDiagnostics?.callsLastMinute ?? 0} provider calls/min · quote source: ${snapshot.source}`,
    },
    {
      label: "Quote cache / poll interval",
      value: `${config.cacheSeconds}s`,
    },
  ];

  if (config.live && liveAgeSeconds !== null) {
    rows.push({
      label: "Last provider update",
      value: `${liveAgeSeconds}s ago${snapshot.liveError ? ` — ${snapshot.liveError}` : ""}`,
    });
  }
  if (!config.live && config.warning) {
    rows.push({ label: "Warning", value: config.warning });
  }

  return (
    <AdminCard
      title="Market data source"
      description="Where prices come from and whether the board is updating correctly."
      actions={
        <Badge variant={overall.tone === "gain" ? "success" : overall.tone === "loss" ? "destructive" : "warning"} className="gap-1">
          {overall.tone === "gain" ? <CheckCircle2Icon /> : <ActivityIcon />}
          {overall.label}
        </Badge>
      }
    >
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5">
            <dt className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">{row.label}</dt>
            <dd className="text-[13px]">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <DatabaseIcon className="size-3.5" />
        Stock universe changes below apply to every user on their next page load.
      </p>
    </AdminCard>
  );
}

export function StocksTab({ supabase }: { supabase: SupabaseClient }) {
  const [rows, setRows] = React.useState<DemoStockRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [scope, setScope] = React.useState<string>("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DemoStockRow | null>(null);
  const [form, setForm] = React.useState<StockFormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await fetchDemoStocks(supabase);
      if (!result.ok) throw new Error(result.error);
      setRows(result.stocks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    // Deferred so the effect itself never calls setState synchronously.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const overridesBySymbol = React.useMemo(
    () => new Map((rows ?? []).map((row) => [row.symbol, row])),
    [rows],
  );

  const universe = React.useMemo(() => {
    const builtIn = CATALOG.map((instrument) => {
      const override = overridesBySymbol.get(instrument.symbol);
      return {
        symbol: instrument.symbol,
        name: instrument.name,
        kind: instrument.kind,
        sector: instrument.sector,
        price: instrument.price,
        source: "catalog" as const,
        enabled: override ? override.enabled : true,
        updated_at: override?.updated_at ?? null,
      };
    });
    const custom = (rows ?? [])
      .filter((row) => row.source === "custom")
      .map((row) => ({
        symbol: row.symbol,
        name: row.name,
        kind: row.kind,
        sector: row.sector,
        price: row.reference_price,
        source: "custom" as const,
        enabled: row.enabled,
        updated_at: row.updated_at,
      }));

    const merged = [...builtIn, ...custom];
    const needle = query.trim().toLowerCase();
    return merged
      .filter((row) => (needle ? `${row.symbol} ${row.name}`.toLowerCase().includes(needle) : true))
      .filter((row) =>
        scope === "all" ? true : scope === "custom" ? row.source === "custom" : scope === "disabled" ? !row.enabled : true,
      )
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [rows, overridesBySymbol, query, scope]);

  function report(result: { ok: boolean; error?: string }, success: string) {
    if (!result.ok) {
      toast.error("Change not saved", { description: result.error });
      return false;
    }
    toast.success(success);
    return true;
  }

  async function toggleBuiltIn(symbol: string, enabled: boolean) {
    const instrument = CATALOG_BY_SYMBOL.get(symbol);
    if (!instrument) return;
    setBusy(true);
    const result = enabled
      ? await deleteDemoStock(supabase, symbol)
      : await upsertDemoStock(supabase, {
          symbol,
          name: instrument.name,
          kind: instrument.kind,
          sector: instrument.sector,
          reference_price: instrument.price,
          source: "catalog",
          enabled: false,
        });
    setBusy(false);
    if (report(result, enabled ? `${symbol} is tradable again` : `${symbol} removed from the demo universe`)) {
      void load();
    }
  }

  async function toggleCustom(row: DemoStockRow, enabled: boolean) {
    setBusy(true);
    const result = await upsertDemoStock(supabase, {
      symbol: row.symbol,
      name: row.name,
      kind: row.kind,
      sector: row.sector,
      reference_price: row.reference_price,
      source: "custom",
      enabled,
    });
    setBusy(false);
    if (report(result, `${row.symbol} ${enabled ? "enabled" : "paused"}`)) void load();
  }

  async function removeCustom(row: DemoStockRow) {
    setDeleting(row.symbol);
    const result = await deleteDemoStock(supabase, row.symbol);
    setDeleting(null);
    if (report(result, `${row.symbol} removed from the demo universe`)) void load();
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(row: DemoStockRow) {
    setEditing(row);
    setForm({ symbol: row.symbol, name: row.name, kind: row.kind, sector: row.sector, price: String(row.reference_price) });
    setDialogOpen(true);
  }

  async function saveForm() {
    const symbol = form.symbol.trim().toUpperCase();
    const name = form.name.trim();
    const price = Number(form.price);

    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
      toast.error("Invalid symbol", { description: "1–10 letters, digits, dots or dashes — e.g. AAPL." });
      return;
    }
    if (!editing && CATALOG_BY_SYMBOL.has(symbol)) {
      toast.error("That symbol is in the built-in catalog", {
        description: "Use the toggle on its row to disable it instead of adding a duplicate.",
      });
      return;
    }
    if (!name) {
      toast.error("Give the stock a name.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a reference price above zero.");
      return;
    }

    setSaving(true);
    const result = await upsertDemoStock(supabase, {
      symbol,
      name,
      kind: form.kind,
      sector: form.sector,
      reference_price: price,
      source: "custom",
      enabled: editing ? editing.enabled : true,
    });
    setSaving(false);
    if (report(result, editing ? `${symbol} updated` : `${symbol} added to the demo universe`)) {
      setDialogOpen(false);
      void load();
    }
  }

  return (
    <div className="space-y-4">
      <MarketDataCard />

      <AdminCard
        title="Tradable demo stocks"
        description="The full universe users can trade: the built-in catalog plus anything you add here. Disable a stock to pull it from Markets and search."
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onClick={() => void load()} busy={busy} />
            <Button size="sm" className="h-8 gap-1.5 text-[12px]" onClick={openAdd}>
              <PlusIcon />
              Add stock
            </Button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search symbol or name…"
              className="pl-9"
            />
          </div>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="h-9 w-36 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everything</SelectItem>
              <SelectItem value="custom">Admin-added</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="catalog">Built-in catalog</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="muted" className="tnum">{universe.length} shown</Badge>
        </div>

        {error ? <ErrorNote message={error} /> : null}
        {!rows && !error ? <TableSkeleton /> : null}
        {rows && universe.length === 0 && !error ? <EmptyNote>No stocks match those filters.</EmptyNote> : null}

        {rows && universe.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">Reference price</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Tradable</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {universe.map((row) => {
                  const customRow = row.source === "custom" ? overridesBySymbol.get(row.symbol) : undefined;
                  return (
                    <TableRow key={row.symbol} className={cn(!row.enabled && "opacity-60")}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <StockAvatar symbol={row.symbol} className="size-7" />
                          <div>
                            <p className="text-[13px] font-semibold">{row.symbol}</p>
                            <p className="max-w-[200px] truncate text-[11px] text-muted-foreground">{row.name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[12.5px]">{row.sector}</TableCell>
                      <TableCell className="tnum text-right">{formatMoney(row.price)}</TableCell>
                      <TableCell>
                        {row.source === "custom" ? (
                          <Badge>Admin-added</Badge>
                        ) : (
                          <Badge variant="muted">Built-in</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.source === "custom" && customRow ? (
                          <div className="flex items-center gap-2">
                            <Switch checked={row.enabled} onCheckedChange={(next) => void toggleCustom(customRow, next)} disabled={busy} />
                            {row.updated_at ? (
                              <span className="text-[10.5px] text-muted-foreground">{relativeTime(row.updated_at)}</span>
                            ) : null}
                          </div>
                        ) : row.enabled ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2Icon />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <BanIcon />
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          {row.source === "catalog" ? (
                            <Button
                              size="sm"
                              variant={row.enabled ? "outline" : "default"}
                              className="h-7 text-[11.5px]"
                              disabled={busy}
                              onClick={() => void toggleBuiltIn(row.symbol, !row.enabled)}
                            >
                              {row.enabled ? "Disable" : "Re-enable"}
                            </Button>
                          ) : customRow ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                aria-label={`Edit ${row.symbol}`}
                                onClick={() => openEdit(customRow)}
                              >
                                <PencilIcon className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-loss hover:text-loss"
                                aria-label={`Remove ${row.symbol}`}
                                disabled={deleting === row.symbol}
                                onClick={() => void removeCustom(customRow)}
                              >
                                <Trash2Icon className="size-3.5" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </AdminCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.symbol}` : "Add a demo stock"}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Last updated ${formatDateTime(editing.updated_at)}.`
                : "It appears in Markets and search, ticks like any simulated stock, and is tradable by every user."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="stock-symbol">Symbol</Label>
                <Input
                  id="stock-symbol"
                  value={form.symbol}
                  onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
                  placeholder="RIVN"
                  disabled={Boolean(editing)}
                  maxLength={10}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <Select
                  value={form.kind}
                  onValueChange={(value) => setForm((current) => ({ ...current, kind: value as "stock" | "etf" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="etf">ETF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="stock-name">Company name</Label>
              <Input
                id="stock-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Rivian Automotive"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Sector</Label>
                <Select
                  value={form.sector}
                  onValueChange={(value) => setForm((current) => ({ ...current, sector: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((sector) => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="stock-price">Reference price ($)</Label>
                <Input
                  id="stock-price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                  placeholder="12.40"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveForm()} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
