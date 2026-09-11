import type { Metadata, Viewport } from "next";
// Geist is self-hosted from the `geist` package: Google Fonts is not reachable
// in every build environment, and local fonts avoid a render-blocking request.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Monievest — Invest in stocks. Grow your portfolio.",
    template: "%s · Monievest",
  },
  description:
    "Monievest is a modern investment app for buying stocks, building a diversified portfolio and tracking performance in real time — with a fully simulated market so you can practise without risking a cent.",
  applicationName: "Monievest",
  keywords: [
    "investing",
    "stocks",
    "portfolio",
    "trading",
    "market data",
    "ETFs",
    "wealth",
    "Monievest",
  ],
  authors: [{ name: "Monievest" }],
  openGraph: {
    title: "Monievest — Invest in stocks. Grow your portfolio.",
    description:
      "Buy fractional shares, build a diversified portfolio and watch it move in real time. Light and dark mode, zero commission, fully simulated market.",
    type: "website",
    siteName: "Monievest",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#06090f" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
