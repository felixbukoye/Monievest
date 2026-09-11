"use client";

import Link from "next/link";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  SparklesIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactMoney, formatMoney, formatPercent } from "@/lib/format";
import type { Holding } from "@/lib/store/selectors";
import { cn } from "@/lib/utils";

export type StatsScope = "portfolio" | "top" | "worst";

/* --------------------------------------------------------------------- values */

export function PortfolioValuesCard({
  ready,
  totalValue,
  changeAmount,
  changePct,
  profitAmount,
  positionCount,
  top,
  worst,
  scope,
  onScope,
  stats = [],
}: {
  ready: boolean;
  totalValue: number;
  changeAmount: number;
  changePct: number;
  profitAmount: number;
  positionCount: number;
  stats?: { label: string; value: string; sub?: string; tone?: "gain" | "loss" }[];
  top: Holding | null;
  worst: Holding | null;
  scope: StatsScope;
  onScope: (scope: StatsScope) => void;
}) {
  const up = changeAmount >= 0;
  const tipSubject = scope === "worst" ? worst : top;
  const tipLabel = scope === "worst" ? "weakest" : "strongest";

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-[17px] font-semibold tracking-tight">Portfolio Values</CardTitle>
          <span className="text-muted-foreground" aria-hidden="true">
            <MoreHorizontalIcon className="size-5" />
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5">
        <div>
          {ready ? (
            <p className="tnum text-[32px] leading-none font-semibold tracking-tight sm:text-4xl">
              {formatMoney(totalValue)}
            </p>
          ) : (
            <Skeleton className="h-10 w-52" />
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
            {ready ? (
              <span
                className={cn(
                  "tnum inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold",
                  up ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss",
                )}
              >
                {up ? <ArrowUpRightIcon className="size-3.5" /> : <ArrowDownRightIcon className="size-3.5" />}
                {up ? "+" : "−"}
                {formatMoney(Math.abs(changeAmount))}
              </span>
            ) : (
              <Skeleton className="h-7 w-28 rounded-md" />
            )}
            <span className={cn("tnum font-semibold", up ? "text-gain" : "text-loss")}>
              {ready ? `${up ? "+" : "−"}${formatPercent(Math.abs(changePct))}` : "—"}
            </span>
            <span className="text-muted-foreground">on the money you put in</span>
          </div>

          <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
            {ready ? (
              <>
                You have{" "}
                <span className={cn("font-semibold", profitAmount >= 0 ? "text-gain" : "text-loss")}>
                  {profitAmount >= 0 ? "earned" : "lost"} {formatMoney(Math.abs(profitAmount))}
                </span>{" "}
                across {positionCount} position{positionCount === 1 ? "" : "s"} since your first deposit.
              </>
            ) : (
              "Replaying your ledger…"
            )}
          </p>
        </div>

        {stats.length > 0 && (
          <div className="grid grid-cols-3 divide-x divide-border/70 rounded-xl border border-border/70 bg-muted/25">
            {stats.map((stat) => (
              <div key={stat.label} className="px-3 py-2.5">
                <p className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {stat.label}
                </p>
                <p
                  className={cn(
                    "tnum mt-1 truncate text-[13.5px] font-semibold",
                    stat.tone === "gain" && "text-gain",
                    stat.tone === "loss" && "text-loss",
                  )}
                >
                  {ready ? stat.value : "—"}
                </p>
                {stat.sub && ready && <p className="tnum text-[10.5px] text-muted-foreground">{stat.sub}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <ScopePill
            active={scope === "worst"}
            disabled={!worst}
            label="Worst Performance"
            icon={<ArrowDownRightIcon className="size-4" />}
            onClick={() => onScope(scope === "worst" ? "portfolio" : "worst")}
          />
          <ScopePill
            active={scope === "top"}
            disabled={!top}
            label="Top Performance"
            icon={<ArrowUpRightIcon className="size-4" />}
            onClick={() => onScope(scope === "top" ? "portfolio" : "top")}
          />
          {scope !== "portfolio" && (
            <button
              type="button"
              onClick={() => onScope("portfolio")}
              className="text-[12px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Show whole portfolio
            </button>
          )}
        </div>

        <div className="mt-auto rounded-xl border border-primary/15 bg-primary/8 p-3.5 sm:p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <SparklesIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-relaxed">
                <span className="font-semibold">Tip:</span>{" "}
                {tipSubject ? (
                  <>
                    <span className="font-semibold">{tipSubject.instrument.symbol}</span> is your {tipLabel} holding
                    right now at{" "}
                    <span
                      className={cn(
                        "tnum font-semibold",
                        tipSubject.unrealizedPnlPct >= 0 ? "text-gain" : "text-loss",
                      )}
                    >
                      {formatPercent(tipSubject.unrealizedPnlPct)}
                    </span>{" "}
                    on cost. Review your allocation to keep risk where you want it.
                  </>
                ) : (
                  <>Add a position and Monievest will start tracking your best and worst performers here.</>
                )}
              </p>
              {tipSubject && (
                <Link
                  href={`/app/stock/${tipSubject.instrument.symbol}`}
                  className="mt-1.5 inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-primary hover:underline"
                >
                  Open {tipSubject.instrument.symbol}
                  <ChevronRightIcon className="size-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScopePill({
  active,
  disabled,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[12.5px] font-semibold transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-foreground hover:border-primary/50 hover:text-primary",
        disabled && "pointer-events-none opacity-45",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ----------------------------------------------------------------- statistics */

function kFormatter(value: number) {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`;
  return `${Math.round(value)}`;
}

function PillLabel({ viewBox, value }: { viewBox?: { x?: number; y?: number }; value?: string }) {
  const x = viewBox?.x ?? 0;
  const y = viewBox?.y ?? 0;
  const text = value ?? "";
  const width = Math.max(42, text.length * 6.6 + 14);

  return (
    <g transform={`translate(${x - width / 2}, ${y - 30})`}>
      <rect width={width} height={21} rx={10.5} fill="var(--foreground)" opacity={0.92} />
      <text
        x={width / 2}
        y={11}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10.5}
        fontWeight={600}
        fill="var(--background)"
      >
        {text}
      </text>
    </g>
  );
}

function StatTooltip({ active, payload, subject }: { active?: boolean; payload?: { payload: StatPoint }[]; subject: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]!.payload;

  return (
    <div className="rounded-lg bg-foreground px-2.5 py-1.5 text-background shadow-xl">
      <p className="tnum text-[12.5px] font-semibold">{formatMoney(point.value)}</p>
      <p className="text-[10.5px] opacity-75">
        {subject} ·{" "}
        {new Date(point.t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
      </p>
    </div>
  );
}

export type StatPoint = { t: number; value: number };

export function StatisticsCard({
  ready,
  subject,
  caption,
  data,
}: {
  ready: boolean;
  subject: string;
  caption: string;
  data: StatPoint[];
}) {
  const last = data[data.length - 1];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-[17px] font-semibold tracking-tight">Statistics</CardTitle>
            <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
              {subject} · {caption}
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-chart-stat/10 px-2.5 py-1 text-[11px] font-semibold text-chart-stat">
            <span className="size-1.5 rounded-full bg-chart-stat" />
            Value
          </span>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 p-2 sm:p-3">
        {!ready || data.length < 2 ? (
          <Skeleton className="h-[236px] w-full rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height={236}>
            <AreaChart data={data} margin={{ top: 26, right: 8, bottom: 0, left: -14 }}>
              <defs>
                <linearGradient id="statFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-stat)" stopOpacity={0.45} />
                  <stop offset="55%" stopColor="var(--chart-stat)" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="var(--chart-stat)" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.7} />

              <XAxis
                dataKey="t"
                tickFormatter={(value: number) =>
                  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
                }
                tick={{ fontSize: 10.5, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={26}
              />
              <YAxis
                width={54}
                tickFormatter={kFormatter}
                tick={{ fontSize: 10.5, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                domain={[0, (max: number) => max * 1.08]}
                tickCount={5}
              />

              <Tooltip content={<StatTooltip subject={subject} />} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />

              <ReferenceLine x={last!.t} y={last!.value} stroke="var(--border)" strokeDasharray="4 4" />

              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--chart-stat)"
                strokeWidth={2.5}
                fill="url(#statFill)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, fill: "var(--chart-stat)", stroke: "var(--card)", strokeWidth: 2 }}
              />

              <ReferenceDot x={last!.t} y={last!.value} r={4.5} fill="var(--chart-stat)" stroke="var(--card)" strokeWidth={2} label={<PillLabel value={formatCompactMoney(last!.value)} />} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
