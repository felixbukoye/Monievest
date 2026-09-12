import type { ReactNode } from "react";
import { BadgeCheckIcon, CandlestickChartIcon, ShieldCheckIcon } from "lucide-react";

import { LogoMark, Wordmark } from "@/components/brand";
import { ModeToggle } from "@/components/mode-toggle";

const PROMISES = [
  {
    icon: ShieldCheckIcon,
    title: "Yours alone",
    body: "Row Level Security in Postgres means your positions, orders and watchlist are invisible to every other account.",
  },
  {
    icon: CandlestickChartIcon,
    title: "Pick up where you left off",
    body: "Cash, holdings, pending limit orders and full history reload on any device the moment you sign in.",
  },
  {
    icon: BadgeCheckIcon,
    title: "Zero-risk practice",
    body: "Real market prices, simulated money. Every account starts with $25,000 in demo cash.",
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40 lg:grid lg:grid-cols-[1.05fr_1fr] lg:bg-background">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden border-r border-border bg-[linear-gradient(160deg,var(--color-primary-foreground)_0%,#f4f1fd_45%,#ede9fe_100%)] p-10 text-foreground lg:flex lg:flex-col dark:bg-[linear-gradient(160deg,#171325_0%,#14121c_55%,#0f0e15_100%)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-primary/12 blur-3xl"
        />
        <Wordmark showTagline className="relative" />

        <div className="relative mt-auto max-w-md space-y-7">
          <p className="text-[28px] font-semibold leading-[1.2] tracking-tight">
            Invest in stocks.
            <br />
            <span className="text-primary">Grow your portfolio.</span>
          </p>
          <ul className="space-y-5">
            {PROMISES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/70 bg-background/80 text-primary">
                  <Icon className="size-[18px]" />
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-10 text-xs text-muted-foreground">
          Simulated brokerage for practice and research. Not investment advice.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2.5 lg:hidden">
            <LogoMark />
            <Wordmark href={null} />
          </span>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-1 items-center py-10">
          <div className="w-full rounded-xl border border-border bg-card p-6 shadow-[0_18px_50px_-32px_rgba(15,15,25,0.45)] sm:p-7 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none">
            {children}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground lg:hidden">
          Simulated brokerage for practice and research. Not investment advice.
        </p>
      </main>
    </div>
  );
}
