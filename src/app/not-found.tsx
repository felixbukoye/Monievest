import Link from "next/link";
import { ArrowLeftIcon, CompassIcon, LineChartIcon } from "lucide-react";

import { LogoMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATALOG } from "@/lib/market/catalog";

export default function NotFound() {
  const suggestions = CATALOG.slice(0, 6);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 surface-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black,transparent)]" />
      <div className="pointer-events-none absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/14 blur-[120px]" />

      <div className="relative flex max-w-lg flex-col items-center text-center">
        <LogoMark className="size-12 rounded-2xl" />

        <Badge variant="outline" className="mt-6 gap-1.5">
          <CompassIcon className="size-3" />
          Error 404
        </Badge>

        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          That ticker isn’t listed on Monievest
        </h1>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted-foreground">
          The page you were looking for doesn’t exist, or the instrument isn’t part of the simulated
          market. Try one of these instead.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {suggestions.map((instrument) => (
            <Link
              key={instrument.symbol}
              href={`/app/stock/${instrument.symbol}`}
              className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[13px] font-medium transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <span className="size-2 rounded-full" style={{ background: instrument.color }} />
              <span className="font-mono">{instrument.symbol}</span>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild variant="glow" size="lg">
            <Link href="/app">
              <ArrowLeftIcon />
              Back to dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/app/markets">
              <LineChartIcon />
              Browse all markets
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
