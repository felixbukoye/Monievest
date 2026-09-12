"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatCompactMoney, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AllocationSlice } from "@/lib/store/selectors";

export function AllocationChart({
  slices,
  size = 190,
  centerLabel = "Invested",
  centerValue,
  className,
}: {
  slices: AllocationSlice[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const [active, setActive] = React.useState<AllocationSlice | null>(null);

  if (slices.length === 0) {
    return (
      <div
        className={cn("grid place-items-center rounded-full border border-dashed text-xs text-muted-foreground", className)}
        style={{ width: size, height: size }}
      >
        No holdings yet
      </div>
    );
  }

  const highlighted = active ?? null;

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            content={({ active: open, payload }) => {
              if (!open || !payload?.length) return null;
              const slice = payload[0]!.payload as AllocationSlice;
              return (
                <div className="rounded-lg border bg-popover/95 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur">
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="size-2 rounded-full" style={{ background: slice.color }} />
                    {slice.label}
                  </p>
                  <p className="tnum mt-0.5 font-semibold">{formatMoney(slice.value)}</p>
                  <p className="tnum text-muted-foreground">{slice.weight.toFixed(1)}% of invested</p>
                </div>
              );
            }}
          />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius="66%"
            outerRadius="94%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            stroke="var(--card)"
            strokeWidth={2}
            onMouseEnter={(entry) => setActive(entry.payload as AllocationSlice)}
            onMouseLeave={() => setActive(null)}
            isAnimationActive={false}
          >
            {slices.map((slice) => (
              <Cell key={slice.key} fill={slice.color} fillOpacity={highlighted && highlighted.key !== slice.key ? 0.35 : 1} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
          {highlighted ? highlighted.label : centerLabel}
        </span>
        <span className="tnum mt-0.5 text-lg font-semibold tracking-tight">
          {highlighted ? `${highlighted.weight.toFixed(1)}%` : centerValue}
        </span>
        {highlighted && (
          <span className="tnum text-[11px] text-muted-foreground">{formatCompactMoney(highlighted.value)}</span>
        )}
      </div>
    </div>
  );
}
