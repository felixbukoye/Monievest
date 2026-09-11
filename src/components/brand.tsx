import Link from "next/link";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[10px]",
        "bg-[linear-gradient(140deg,#a78bfa,#7c3aed)]",
        "shadow-[0_6px_18px_-8px_var(--color-primary)]",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-[19px] text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 18V8.2l5.2 5.3a1.2 1.2 0 0 0 1.7 0L15.6 8v10" />
        <path d="M20.5 18V6" opacity=".55" />
      </svg>
    </span>
  );
}

export function Wordmark({
  className,
  href = "/",
  showTagline = false,
}: {
  className?: string;
  href?: string | null;
  showTagline?: boolean;
}) {
  const content = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          Monie<span className="text-primary">vest</span>
        </span>
        {showTagline && (
          <span className="mt-0.5 text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">
            Invest · Grow · Repeat
          </span>
        )}
      </span>
    </span>
  );

  if (href === null) return content;
  return (
    <Link href={href} className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
      {content}
      <span className="sr-only">Monievest home</span>
    </Link>
  );
}
