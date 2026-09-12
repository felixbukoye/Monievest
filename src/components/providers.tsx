"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { MarketProvider } from "@/components/market/market-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PortfolioProvider } from "@/lib/store/provider";

/**
 * Provider stack order matters:
 * theme → portfolio (state + persistence) → market (live simulated quotes,
 * which reads portfolio settings and fills resting limit orders).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={120}>
        <PortfolioProvider>
          <MarketProvider>
            {children}
            <Toaster />
          </MarketProvider>
        </PortfolioProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
