"use client";

import { FlaskConicalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Persistent reminder that Monievest trades against a simulated market. */
export function SimulatedBadge({ className, label = "Simulated data" }: { className?: string; label?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-border/80 bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground", className)}>
      <FlaskConicalIcon className="size-3 text-primary" />
      {label}
    </Badge>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
      {icon && (
        <span className="grid size-12 place-items-center rounded-xl border bg-muted/60 text-muted-foreground">
          {icon}
        </span>
      )}
      <div className="space-y-1">
        <p className="text-[15px] font-semibold">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
