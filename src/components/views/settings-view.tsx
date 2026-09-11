"use client";

import {
  ActivityIcon,
  CheckIcon,
  DatabaseIcon,
  DownloadIcon,
  GaugeIcon,
  InfoIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  RefreshCwIcon,
  SaveIcon,
  SlidersHorizontalIcon,
  SunIcon,
  Trash2Icon,
  UserIcon,
  ZapIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { toast } from "sonner";

import { GeneratedAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useMounted } from "@/lib/hooks/use-mounted";
import { usePortfolio } from "@/lib/store/provider";
import { STORAGE_KEY, type Account } from "@/lib/store/types";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { id: "light", label: "Light", hint: "Bright surfaces, high legibility", icon: SunIcon },
  { id: "dark", label: "Dark", hint: "Deep navy, built for long sessions", icon: MoonIcon },
  { id: "system", label: "System", hint: "Follows your OS preference", icon: MonitorIcon },
] as const;

const RANGE_OPTIONS = ["1D", "1W", "1M", "3M", "1Y", "5Y"] as const;

const STACK = ["Next.js 16", "React 19", "TypeScript", "Tailwind v4", "shadcn/ui", "Recharts", "next-themes"];

const noopSubscribe = () => () => {};
const noStorage = () => 0;
function readStorageBytes() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? raw.length : 0;
  } catch {
    return 0;
  }
}

/** Bytes currently held in localStorage — 0 on the server and before mount. */
function useStorageBytes(): number {
  return React.useSyncExternalStore(noopSubscribe, readStorageBytes, noStorage);
}

export function SettingsView() {
  const { state, hydrated, dispatch, resetDemo } = usePortfolio();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const storageBytes = useStorageBytes();
  const [confirmReset, setConfirmReset] = React.useState(false);

  function exportState() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `monievest-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Portfolio exported");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Theme, trading behaviour, profile and demo data — all stored locally in your browser.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ------------------------------------------------------ appearance */}
        <Card className="p-0">
          <CardHeader className="border-b p-5">
            <CardTitle className="flex items-center gap-2">
              <PaletteIcon className="size-4 text-primary" />
              Appearance
            </CardTitle>
            <CardDescription>
              Monievest ships a full light and dark design system — charts, tables and toasts all re-theme.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <div className="grid gap-2 sm:grid-cols-3">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all",
                    mounted && theme === option.id
                      ? "border-primary/60 bg-primary/8 shadow-[0_0_0_1px_var(--color-primary)_inset]"
                      : "hover:border-muted-foreground/35",
                  )}
                  aria-pressed={mounted && theme === option.id}
                >
                  <span className="flex w-full items-center justify-between">
                    <option.icon
                      className={cn("size-4", mounted && theme === option.id ? "text-primary" : "text-muted-foreground")}
                    />
                    {mounted && theme === option.id && <CheckIcon className="size-4 text-primary" />}
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold">{option.label}</span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">{option.hint}</span>
                  </span>
                  <span className="mt-1 flex h-6 w-full overflow-hidden rounded-md border">
                    {option.id === "light" && (
                      <>
                        <span className="flex-1 bg-[#f2f2f5]" />
                        <span className="w-1/3 bg-[#8b5cf6]" />
                      </>
                    )}
                    {option.id === "dark" && (
                      <>
                        <span className="flex-1 bg-[#0c0c0f]" />
                        <span className="w-1/3 bg-[#a78bfa]" />
                      </>
                    )}
                    {option.id === "system" && (
                      <>
                        <span className="flex-1 bg-[#f2f2f5]" />
                        <span className="flex-1 bg-[#0c0c0f]" />
                      </>
                    )}
                  </span>
                </button>
              ))}
            </div>
            <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-muted-foreground">
              <InfoIcon className="mt-px size-3 shrink-0" />
              The theme is applied before first paint via next-themes, so there’s no flash of the wrong colour on
              load.{mounted && resolvedTheme ? ` Currently rendering: ${resolvedTheme}.` : ""}
            </p>
          </CardContent>
        </Card>

        {/* --------------------------------------------------------- trading */}
        <Card className="p-0">
          <CardHeader className="border-b p-5">
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontalIcon className="size-4 text-primary" />
              Trading behaviour
            </CardTitle>
            <CardDescription>Controls for the simulator and order handling</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/60 p-0">
            <SettingRow
              icon={ZapIcon}
              title="Live price updates"
              description="Advance the simulated market every ~2 seconds so quotes, charts and P&L move."
            >
              <Switch
                checked={state.settings.livePrices}
                onCheckedChange={(checked) => dispatch({ type: "update-settings", payload: { livePrices: checked } })}
                aria-label="Toggle live price updates"
              />
            </SettingRow>

            <SettingRow
              icon={ActivityIcon}
              title="Auto-fill limit orders"
              description="Execute resting limit orders the moment the simulated price reaches your level."
            >
              <Switch
                checked={state.settings.autoFillLimits}
                onCheckedChange={(checked) => dispatch({ type: "update-settings", payload: { autoFillLimits: checked } })}
                aria-label="Toggle auto-fill of limit orders"
              />
            </SettingRow>

            <SettingRow
              icon={GaugeIcon}
              title="Compact tables"
              description="Tighter row heights so more holdings fit on screen at once."
            >
              <Switch
                checked={state.settings.compactTables}
                onCheckedChange={(checked) => dispatch({ type: "update-settings", payload: { compactTables: checked } })}
                aria-label="Toggle compact tables"
              />
            </SettingRow>

            <div className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium">Default chart range</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                  Used when you open a stock page.
                </p>
              </div>
              <Select
                value={state.settings.defaultRange}
                onValueChange={(value) =>
                  dispatch({
                    type: "update-settings",
                    payload: { defaultRange: value as (typeof RANGE_OPTIONS)[number] },
                  })
                }
              >
                <SelectTrigger className="w-[7rem]" aria-label="Default chart range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* --------------------------------------------------------- profile */}
        {/* Keyed on hydration so the inputs mount with the stored values
            instead of needing an effect to sync them. */}
        <ProfileCard key={hydrated ? "hydrated" : "loading"} account={state.account} hydrated={hydrated} />

        {/* ----------------------------------------------------------- data */}
        <Card className="p-0">
          <CardHeader className="border-b p-5">
            <CardTitle className="flex items-center gap-2">
              <DatabaseIcon className="size-4 text-primary" />
              Data &amp; demo account
            </CardTitle>
            <CardDescription>Export a backup, inspect storage, or start over</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DataTile label="Positions" value={String(state.positions.length)} />
              <DataTile label="Orders" value={String(state.orders.length)} />
              <DataTile label="Activity" value={String(state.activity.length)} />
              <DataTile label="Storage" value={storageBytes > 0 ? `${(storageBytes / 1024).toFixed(1)} KB` : "—"} />
            </div>

            <div className="rounded-xl border bg-muted/25 p-3.5 text-[11.5px] leading-relaxed text-muted-foreground">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                <DatabaseIcon className="size-3.5 text-primary" />
                localStorage key
              </p>
              <code className="mt-1 block font-mono text-[11px] break-all">{STORAGE_KEY}</code>
              <p className="mt-1.5">
                Your portfolio persists across reloads and syncs between open tabs. Clearing site data resets the demo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={exportState} disabled={!hydrated}>
                <DownloadIcon />
                Export portfolio JSON
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-loss hover:bg-loss-soft hover:text-loss"
                onClick={() => setConfirmReset(true)}
              >
                <RefreshCwIcon />
                Reset demo data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------------- about */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <InfoIcon className="size-4 text-primary" />
            About Monievest
          </CardTitle>
          <CardDescription>
            A modern investment workspace — stocks, ETFs, portfolios, order types and performance analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {STACK.map((item) => (
              <Badge key={item} variant="secondary" className="text-[11px]">
                {item}
              </Badge>
            ))}
          </div>

          <div className="rounded-xl border border-warning/30 bg-warning/8 p-4 text-[12.5px] leading-relaxed">
            <p className="flex items-center gap-2 font-semibold text-warning">
              <Trash2Icon className="size-3.5" />
              Important disclaimer
            </p>
            <p className="mt-1.5 text-muted-foreground">
              Monievest is a design and engineering demonstration. All prices, quotes, order fills, dividends,
              headlines and account balances are simulated locally in your browser. No connection to any exchange,
              broker or payment network exists, no real securities are traded, and nothing here constitutes financial
              or investment advice.
            </p>
          </div>

          <p className="text-[11.5px] text-muted-foreground">
            Version 0.1.0 · Demo build · Data resets when you clear browser storage.
          </p>
        </CardContent>
      </Card>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset the demo account?</DialogTitle>
            <DialogDescription>
              This clears your positions, orders, watchlist and activity from this browser and restores the original
              seeded portfolio. It can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              Keep my data
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetDemo();
                setConfirmReset(false);
              }}
            >
              <RefreshCwIcon />
              Reset everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileCard({
  account,
  hydrated,
}: {
  account: Account;
  hydrated: boolean;
}) {
  const { dispatch } = usePortfolio();
  const [name, setName] = React.useState(account.name);
  const [email, setEmail] = React.useState(account.email);

  function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name can’t be empty");
      return;
    }
    dispatch({ type: "update-account", payload: { name: trimmedName, email: email.trim() } });
    toast.success("Profile updated");
  }

  return (
    <Card className="p-0">
      <CardHeader className="border-b p-5">
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="size-4 text-primary" />
          Profile
        </CardTitle>
        <CardDescription>This demo account has no server — details live in your browser only</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <GeneratedAvatar name={account.name} seed={account.email} className="size-12" />
          <div>
            <p className="text-[14px] font-semibold">{account.name}</p>
            <p className="text-[12px] text-muted-foreground">{account.tier}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{account.accountNumber}</p>
          </div>
          <Badge variant="success" className="ml-auto">
            Active
          </Badge>
        </div>

        <Separator />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Display name</Label>
            <Input id="account-name" value={name} onChange={(event) => setName(event.target.value)} disabled={!hydrated} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-email">Email</Label>
            <Input
              id="account-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={!hydrated}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={!hydrated}>
            <SaveIcon />
            Save changes
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={!hydrated}
            onClick={() => {
              setName(account.name);
              setEmail(account.email);
            }}
          >
            Revert
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof ZapIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border bg-muted/60 text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium">{title}</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function DataTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/25 p-2.5">
      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="tnum mt-0.5 text-[15px] font-semibold">{value}</p>
    </div>
  );
}
