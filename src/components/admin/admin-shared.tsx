"use client";

import { RefreshCwIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Violet "Admin" badge — shown in the chrome and on the admin pages. */
export function AdminBadge({ className }: { className?: string }) {
  return (
    <Badge className={cn("gap-1", className)}>
      <ShieldCheckIcon />
      Admin
    </Badge>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
          <AdminBadge />
        </div>
        <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{description}</p>
      </div>
      {actions}
    </div>
  );
}

export function AdminCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("card-soft", className)}>
      <CardHeader>
        <CardTitle className="text-[15px]">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "gain" | "loss";
}) {
  return (
    <Card className="card-soft">
      <CardContent className="pt-5">
        <p className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
        <p
          className={cn(
            "tnum mt-1.5 text-[24px] font-semibold tracking-tight",
            tone === "gain" && "text-gain",
            tone === "loss" && "text-loss",
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={busy} className="h-8 gap-1.5 text-[12px]">
      <RefreshCwIcon className={cn(busy && "animate-spin")} />
      Refresh
    </Button>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-3 text-[12.5px] text-foreground">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>
        <span className="font-semibold">Could not load admin data. </span>
        {message} — if you just ran the admin migration, refresh this page.
      </span>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 py-1">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-[13px] text-muted-foreground">{children}</p>;
}
