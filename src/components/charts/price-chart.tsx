"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getHistory } from "@/lib/market/engine";
import { RANGES, type Instrument, type Quote, type Range } from "@/lib/market/types";
import { formatCompactMoney, formatClockLabel, formatDateTime, formatMoney, formatPercent, formatVolume } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ChartStyle = "area" | "line";

type Point = { t: number; price: number; volume?: number; base?: number };

export function RangeSelector({
  range,
  onChange,
  className,
  ranges = RANGES,
  size = "md",
}: {
  range: Range;
  onChange: (range: Range) => void;
  className?: string;
  ranges?: Range[];
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      aria-label="Chart range"
      className={cn("inline-flex items-center gap-0.5 rounded-lg bg-muted/70 p-1", className)}
    >
      {ranges.map((option) => {
        const active = option === range;
        return (
          <button
            key={option}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "tnum rounded-md font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function buildSeries(instrument: Instrument, quote: Quote | undefined, range: Range, ready: boolean): Point[] {
  if (range === "1D") {
    const intraday = ready ? quote?.intraday : undefined;
    if (intraday && intraday.length > 2) {
      return intraday.map((p) => ({ t: p.t, price: p.p }));
    }
    return getHistory(instrument, "1D").map((c) => ({ t: c.t, price: c.c }));
  }
  return getHistory(instrument, range).map((c) => ({ t: c.t, price: c.c, volume: c.v }));
}

function tickFormatter(range: Range) {
  return (value: number) => {
    const date = new Date(value);
    if (range === "1D" || range === "1W") {
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
    }
    if (range === "1M" || range === "3M") {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    }
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  };
}

function ChartTooltip({
  active,
  payload,
  range,
  base,
  instrument,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  range: Range;
  base: number;
  instrument: Instrument;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]!.payload;
  const change = point.price - base;
  const changePct = (change / base) * 100;
  const up = change >= 0;

  return (
    <div className="min-w-[13rem] rounded-lg border bg-popover/95 p-2.5 text-xs shadow-xl backdrop-blur">
      <p className="mb-1.5 font-medium text-muted-foreground">
        {instrument.symbol} · {range === "1D" || range === "1W" ? formatClockLabel(point.t) : formatDateTime(point.t)}
      </p>
      <p className="tnum text-base font-semibold tracking-tight">{formatMoney(point.price)}</p>
      <p className={cn("tnum mt-0.5 font-medium", up ? "text-gain" : "text-loss")}>
        {up ? "+" : "−"}
        {formatMoney(Math.abs(change))} ({formatPercent(changePct)}) vs {range === "1D" ? "prev close" : "range start"}
      </p>
      {point.volume != null && (
        <p className="tnum mt-1.5 border-t pt-1.5 text-muted-foreground">Volume · {formatVolume(point.volume)}</p>
      )}
    </div>
  );
}

export function PriceChart({
  instrument,
  quote,
  range,
  ready,
  style = "area",
  height = 320,
  showVolume = true,
  className,
  color,
}: {
  instrument: Instrument;
  quote?: Quote;
  range: Range;
  ready: boolean;
  style?: ChartStyle;
  height?: number;
  showVolume?: boolean;
  className?: string;
  color?: string;
}) {
  const series = React.useMemo(() => buildSeries(instrument, quote, range, ready), [instrument, quote, range, ready]);
  const gradientId = React.useId();

  if (series.length < 2) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl border bg-muted/20", className)} style={{ height }}>
        <span className="text-sm text-muted-foreground">Loading chart…</span>
      </div>
    );
  }

  const base = range === "1D" ? (quote?.prevClose ?? series[0]!.price) : series[0]!.price;
  const last = series[series.length - 1]!.price;
  const up = last >= base;
  const stroke = color ?? (up ? "var(--gain)" : "var(--loss)");

  const prices = series.map((p) => p.price);
  const pad = (Math.max(...prices) - Math.min(...prices)) * 0.12 || Math.max(base * 0.004, 0.05);
  const domain: [number, number] = [Math.min(...prices, base) - pad, Math.max(...prices, base) + pad];

  const hasVolume = showVolume && series.some((p) => p.volume != null);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ResponsiveContainer width="100%" height={height}>
        {style === "line" ? (
          <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 5" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={tickFormatter(range)}
              tickCount={6}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              domain={domain}
              tickFormatter={(value: number) => formatMoney(value, { decimals: false })}
              width={56}
              axisLine={false}
              tickLine={false}
              tickCount={5}
            />
            <ReferenceLine y={base} stroke="var(--border)" strokeDasharray="4 4" />
            <Tooltip content={<ChartTooltip range={range} base={base} instrument={instrument} />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="price"
              stroke={stroke}
              strokeWidth={1.8}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0, fill: stroke }}
              isAnimationActive={false}
            />
          </LineChart>
        ) : (
          <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.34} />
                <stop offset="55%" stopColor={stroke} stopOpacity={0.09} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 5" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={tickFormatter(range)}
              tickCount={6}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              domain={domain}
              tickFormatter={(value: number) => formatMoney(value, { decimals: false })}
              width={56}
              axisLine={false}
              tickLine={false}
              tickCount={5}
            />
            <ReferenceLine y={base} stroke="var(--border)" strokeDasharray="4 4" />
            <Tooltip
              content={<ChartTooltip range={range} base={base} instrument={instrument} />}
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: stroke }}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>

      {hasVolume && (
        <div className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Vol
          </span>
          <ResponsiveContainer width="100%" height={48}>
            <BarChart data={series} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} hide />
              <YAxis hide domain={[0, "dataMax"]} />
              <Tooltip
                cursor={{ fill: "var(--grid-line)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0]!.payload as Point;
                  return (
                    <div className="rounded-lg border bg-popover/95 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur">
                      <p className="tnum font-semibold">{formatVolume(point.volume ?? 0)}</p>
                      <p className="text-muted-foreground">{formatDateTime(point.t)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="volume" fill={stroke} fillOpacity={0.4} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/** Compact portfolio-vs-benchmark chart used on the dashboard. */
export function PerformanceChart({
  data,
  height = 260,
  showBenchmark = true,
  className,
  valueFormatter = (v: number) => formatCompactMoney(v),
}: {
  data: { t: number; value: number; benchmark?: number }[];
  height?: number;
  showBenchmark?: boolean;
  className?: string;
  valueFormatter?: (value: number) => string;
}) {
  const gradientId = React.useId();
  if (data.length < 2) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl border bg-muted/20", className)} style={{ height }}>
        <span className="text-sm text-muted-foreground">Not enough history yet</span>
      </div>
    );
  }

  const values = data.flatMap((d) => [d.value, d.benchmark ?? d.value]);
  const pad = (Math.max(...values) - Math.min(...values)) * 0.14 || 1;

  return (
    <ResponsiveContainer width="100%" height={height} className={className}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickCount={6}
          minTickGap={32}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value: number) =>
            new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
          }
        />
        <YAxis
          domain={[Math.min(...values) - pad, Math.max(...values) + pad]}
          width={62}
          axisLine={false}
          tickLine={false}
          tickCount={5}
          tickFormatter={(value: number) => valueFormatter(value)}
        />
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0]!.payload as { t: number; value: number; benchmark?: number };
            const start = data[0]!.value;
            const changePct = ((point.value - start) / start) * 100;
            const benchPct = point.benchmark ? ((point.benchmark - start) / start) * 100 : null;
            return (
              <div className="min-w-[12rem] rounded-lg border bg-popover/95 p-2.5 text-xs shadow-xl backdrop-blur">
                <p className="mb-1.5 font-medium text-muted-foreground">{formatDateTime(point.t)}</p>
                <p className="tnum text-base font-semibold tracking-tight">{formatMoney(point.value)}</p>
                <p className={cn("tnum mt-0.5 font-medium", changePct >= 0 ? "text-gain" : "text-loss")}>
                  {formatPercent(changePct)} over period
                </p>
                {benchPct != null && (
                  <p className="tnum mt-1.5 border-t pt-1.5 text-muted-foreground">
                    S&amp;P 500 · {formatPercent(benchPct)}
                  </p>
                )}
              </div>
            );
          }}
        />
        {showBenchmark && (
          <Line
            type="monotone"
            dataKey="benchmark"
            stroke="var(--muted-foreground)"
            strokeWidth={1.4}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-primary)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--color-primary)" }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
