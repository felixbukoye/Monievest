"use client";

import Link from "next/link";
import {
  ArrowDownLeftIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  CreditCardIcon,
  LandmarkIcon,
  LockIcon,
  PlusIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  WalletIcon,
  ZapIcon,
} from "lucide-react";
import * as React from "react";

import { useMarket } from "@/components/market/market-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatMoney, formatShares, relativeTime } from "@/lib/format";
import { getInstrument } from "@/lib/market/catalog";
import { usePortfolio } from "@/lib/store/provider";
import { buildHoldings, summarise } from "@/lib/store/selectors";
import { cn } from "@/lib/utils";

const QUICK_AMOUNTS = [500, 1_000, 5_000, 10_000];

const FUNDING_METHODS = [
  {
    id: "ach",
    label: "Chase ••4417",
    detail: "ACH bank transfer · 1–2 business days",
    icon: LandmarkIcon,
    badge: "Linked",
  },
  {
    id: "debit",
    label: "Visa ••9021",
    detail: "Instant deposit · 1.5% simulated fee",
    icon: CreditCardIcon,
    badge: "Instant",
  },
  {
    id: "wire",
    label: "Wire transfer",
    detail: "Same-day settlement for amounts over $25,000",
    icon: ZapIcon,
    badge: "Manual",
  },
];

export function WalletView() {
  const { state, hydrated, deposit, withdraw } = usePortfolio();
  const { quotes } = useMarket();

  const [depositAmount, setDepositAmount] = React.useState("1000");
  const [method, setMethod] = React.useState("debit");
  const [withdrawAmount, setWithdrawAmount] = React.useState("");
  const [tab, setTab] = React.useState<"deposit" | "withdraw">("deposit");

  const summary = React.useMemo(() => summarise(state, quotes), [state, quotes]);
  const holdings = React.useMemo(() => buildHoldings(state, quotes), [state, quotes]);

  const reserved = state.orders
    .filter((order) => order.status === "pending" && order.side === "buy")
    .reduce((acc, order) => acc + order.notional, 0);

  const totals = React.useMemo(() => {
    const deposited = state.activity.filter((a) => a.type === "deposit").reduce((acc, a) => acc + a.amount, 0);
    const withdrawn = state.activity.filter((a) => a.type === "withdraw").reduce((acc, a) => acc + Math.abs(a.amount), 0);
    const dividends = state.activity.filter((a) => a.type === "dividend").reduce((acc, a) => acc + a.amount, 0);
    return { deposited, withdrawn, dividends };
  }, [state.activity]);

  const depositValue = Number.parseFloat(depositAmount) || 0;
  const withdrawValue = Number.parseFloat(withdrawAmount) || 0;
  const selectedMethod = FUNDING_METHODS.find((item) => item.id === method)!;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fund your account, move cash out, and see exactly how much buying power you have.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* ------------------------------------------------------- balance */}
        <Card className="relative overflow-hidden p-0">
          <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/14 blur-3xl" />
          <div className="relative p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  <WalletIcon className="size-3.5" />
                  Cash balance
                </p>
                {hydrated ? (
                  <p className="tnum mt-1.5 text-4xl font-semibold tracking-tight">{formatMoney(state.cash)}</p>
                ) : (
                  <Skeleton className="mt-2 h-10 w-44" />
                )}
                <p className="mt-2 text-[12.5px] text-muted-foreground">
                  Settled funds · available immediately for trading
                </p>
              </div>
              <Badge variant="outline" className="gap-1.5 border-gain/30 bg-gain-soft text-gain">
                <ShieldCheckIcon className="size-3" />
                SIPC-style demo protection
              </Badge>
            </div>

            <Separator className="my-5" />

            <div className="grid gap-4 sm:grid-cols-3">
              <BalanceTile
                label="Buying power"
                value={hydrated ? formatMoney(Math.max(state.cash - reserved, 0)) : undefined}
                hint={reserved > 0 ? `${formatMoney(reserved)} reserved by open orders` : "No open orders"}
              />
              <BalanceTile
                label="Invested"
                value={hydrated ? formatMoney(summary.marketValue) : undefined}
                hint={`${holdings.length} position${holdings.length === 1 ? "" : "s"}`}
              />
              <BalanceTile
                label="Total value"
                value={hydrated ? formatMoney(summary.totalValue) : undefined}
                hint="Cash + holdings"
                emphasis
              />
            </div>
          </div>

          <div className="grid gap-px border-t bg-border/60 sm:grid-cols-3">
            <FlowTile label="Deposited" value={formatMoney(totals.deposited)} tone="gain" />
            <FlowTile label="Withdrawn" value={formatMoney(totals.withdrawn)} />
            <FlowTile label="Dividends received" value={formatMoney(totals.dividends)} tone="gain" />
          </div>
        </Card>

        {/* --------------------------------------------------- move money */}
        <Card className="p-0">
          <div className="grid grid-cols-2 gap-px border-b bg-border/60">
            {(
              [
                { id: "deposit", label: "Deposit", icon: ArrowDownLeftIcon },
                { id: "withdraw", label: "Withdraw", icon: ArrowUpRightIcon },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTab(option.id)}
                className={cn(
                  "relative flex items-center justify-center gap-2 bg-card py-3 text-[13px] font-semibold transition-colors",
                  tab === option.id ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <option.icon className="size-4" />
                {option.label}
                {tab === option.id && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          <CardContent className="space-y-4 p-5">
            {tab === "deposit" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="deposit-amount">Amount</Label>
                  <Input
                    id="deposit-amount"
                    inputMode="decimal"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                    className="tnum h-12 text-lg font-semibold"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_AMOUNTS.map((amount) => (
                      <Button
                        key={amount}
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 flex-1 text-[12px]"
                        onClick={() => setDepositAmount(String(amount))}
                      >
                        {formatMoney(amount, { decimals: false })}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Funding method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FUNDING_METHODS.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label} · {item.badge}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-muted-foreground">
                    <LockIcon className="mt-px size-3 shrink-0" />
                    {selectedMethod.detail}. This is a simulation — no payment network is contacted.
                  </p>
                </div>

                <Button
                  size="lg"
                  className="w-full"
                  disabled={depositValue <= 0}
                  onClick={() => deposit(depositValue, `${selectedMethod.label} · ${selectedMethod.badge}`)}
                >
                  <PlusIcon />
                  Deposit {depositValue > 0 ? formatMoney(depositValue) : ""}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="withdraw-amount">Amount</Label>
                    <span className="tnum text-[11.5px] text-muted-foreground">
                      {hydrated ? `${formatMoney(state.cash)} available` : "—"}
                    </span>
                  </div>
                  <Input
                    id="withdraw-amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                    className="tnum h-12 text-lg font-semibold"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[0.25, 0.5, 1].map((fraction) => (
                      <Button
                        key={fraction}
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 flex-1 text-[12px]"
                        disabled={!hydrated}
                        onClick={() => setWithdrawAmount((state.cash * fraction).toFixed(2))}
                      >
                        {fraction === 1 ? "All cash" : `${fraction * 100}%`}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  Withdrawals go back to <span className="font-medium text-foreground">Chase ••4417</span> and settle
                  in 1–2 business days. Only settled cash can be withdrawn — selling a position frees it immediately in
                  this simulation.
                </div>

                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  disabled={withdrawValue <= 0 || withdrawValue > state.cash || !hydrated}
                  onClick={() => {
                    withdraw(withdrawValue);
                    setWithdrawAmount("");
                  }}
                >
                  <ArrowUpRightIcon />
                  Withdraw {withdrawValue > 0 ? formatMoney(withdrawValue) : ""}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* -------------------------------------------------- funding + moves */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-0">
          <CardHeader className="border-b p-4">
            <CardTitle className="text-[15px]">Funding methods</CardTitle>
            <CardDescription>Simulated — nothing is charged</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {FUNDING_METHODS.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                  method === item.id && tab === "deposit" ? "border-primary/50 bg-primary/5" : "hover:border-muted-foreground/30",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/60 text-muted-foreground">
                  <item.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">{item.label}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{item.detail}</p>
                </div>
                <Badge variant={item.badge === "Instant" ? "success" : "muted"}>{item.badge}</Badge>
              </div>
            ))}

            <Separator className="my-1" />

            <div className="rounded-xl border bg-muted/25 p-3">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                <BanknoteIcon className="size-3.5 text-primary" />
                Reserved by open orders
              </p>
              <p className="tnum mt-1 text-lg font-semibold tracking-tight">{formatMoney(reserved)}</p>
              <p className="text-[11.5px] text-muted-foreground">
                {state.orders.filter((order) => order.status === "pending" && order.side === "buy").length} resting buy
                order(s). Reserved cash reduces your available buying power until they fill or are cancelled.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="flex-row items-center justify-between gap-3 border-b p-4">
            <div>
              <CardTitle className="text-[15px]">Recent cash &amp; trade movements</CardTitle>
              <CardDescription>Newest first</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-primary">
              <Link href="/app/activity">
                View all
                <ArrowUpRightIcon />
              </Link>
            </Button>
          </CardHeader>

          {!hydrated ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          ) : state.activity.length === 0 ? (
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No movements yet. Make a deposit to get started.
            </CardContent>
          ) : (
            <ul className="divide-y divide-border/60">
              {state.activity.slice(0, 9).map((entry) => {
                const instrument = entry.symbol ? getInstrument(entry.symbol) : undefined;
                return (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg border",
                        entry.type === "buy" && "border-gain/30 bg-gain-soft text-gain",
                        entry.type === "sell" && "border-loss/30 bg-loss-soft text-loss",
                        entry.type === "deposit" && "border-primary/30 bg-primary/10 text-primary",
                        entry.type === "dividend" && "border-gain/30 bg-gain-soft text-gain",
                        (entry.type === "withdraw" || entry.type === "cancel" || entry.type === "fee") &&
                          "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {entry.type === "buy" ? (
                        <ArrowUpRightIcon className="size-4" />
                      ) : entry.type === "sell" ? (
                        <ArrowDownRightIcon className="size-4" />
                      ) : entry.type === "deposit" || entry.type === "withdraw" ? (
                        <LandmarkIcon className="size-4" />
                      ) : (
                        <ReceiptTextIcon className="size-4" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[13px] font-medium capitalize">
                        {entry.type}
                        {instrument && (
                          <Link href={`/app/stock/${instrument.symbol}`} className="font-mono text-primary hover:underline">
                            {instrument.symbol}
                          </Link>
                        )}
                        {entry.qty ? (
                          <span className="tnum text-[11.5px] font-normal text-muted-foreground">
                            {formatShares(entry.qty)} sh{entry.price ? ` @ ${formatMoney(entry.price)}` : ""}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {entry.note ?? formatDateTime(entry.createdAt)} · {relativeTime(entry.createdAt)}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "tnum shrink-0 text-[13px] font-semibold",
                        entry.amount === 0 ? "text-muted-foreground" : entry.amount > 0 ? "text-gain" : "text-foreground",
                      )}
                    >
                      {entry.amount === 0 ? "—" : `${entry.amount > 0 ? "+" : "−"}${formatMoney(Math.abs(entry.amount))}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function BalanceTile({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value?: string;
  hint: string;
  emphasis?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border p-3.5", emphasis && "border-primary/35 bg-primary/5")}>
      <p className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      {value ? (
        <p className="tnum mt-1 text-lg font-semibold tracking-tight">{value}</p>
      ) : (
        <Skeleton className="mt-1.5 h-5 w-24" />
      )}
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function FlowTile({ label, value, tone }: { label: string; value: string; tone?: "gain" }) {
  return (
    <div className="bg-card px-5 py-3">
      <p className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className={cn("tnum mt-0.5 text-sm font-semibold", tone === "gain" && "text-gain")}>{value}</p>
    </div>
  );
}
