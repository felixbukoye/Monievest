"use client";

import { useRouter } from "next/navigation";
import { CornerDownLeftIcon, SearchIcon, StarIcon, TrendingUpIcon } from "lucide-react";
import * as React from "react";

import { LivePrice } from "@/components/shared/prices";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCompactMoney, formatPercent } from "@/lib/format";
import { CATALOG, getInstrument } from "@/lib/market/catalog";
import { fetchLiveSearch, type LiveSearchHit } from "@/lib/market/live";
import { buildInstrument } from "@/lib/market/providers/instrument-factory";
import { registerInstruments } from "@/lib/market/registry";
import { searchInstruments, topMovers } from "@/lib/store/selectors";
import { useMarket } from "@/components/market/market-provider";
import { usePortfolio } from "@/lib/store/provider";
import { cn } from "@/lib/utils";

const NO_HITS: LiveSearchHit[] = [];

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { quotes, liveConfigured, providerLabel } = useMarket();
  const { state, toggleWatchlist } = usePortfolio();
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  // Stored with the query it belongs to so stale hits never render, and so
  // clearing them is derived state rather than a synchronous effect update.
  const [liveResults, setLiveResults] = React.useState<{ query: string; hits: LiveSearchHit[] }>({
    query: "",
    hits: [],
  });

  const trimmed = query.trim();
  const liveHits = liveResults.query === trimmed ? liveResults.hits : NO_HITS;

  // Live universe search, debounced. Hits are registered as instruments so the
  // stock page, avatars and order ticket all recognise them immediately.
  React.useEffect(() => {
    if (!liveConfigured || trimmed.length === 0) return;

    let cancelled = false;
    const id = window.setTimeout(() => {
      void fetchLiveSearch(trimmed).then((hits) => {
        if (cancelled || hits.length === 0) return;
        registerInstruments(
          hits.map((hit) =>
            buildInstrument({
              symbol: hit.symbol,
              name: hit.name,
              kind: /etf|fund|trust|index/i.test(hit.type) ? "etf" : "stock",
              industry: hit.type,
            }),
          ),
        );
        setLiveResults({ query: trimmed, hits });
      });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [trimmed, liveConfigured]);

  const results = React.useMemo(() => {
    const local = trimmed
      ? searchInstruments(trimmed, 9)
      : (() => {
          // Default view: watchlist first, then the day's biggest movers.
          const watched = state.watchlist
            .map((symbol) => getInstrument(symbol))
            .filter((instrument): instrument is NonNullable<typeof instrument> => Boolean(instrument))
            .slice(0, 4);
          const movers = topMovers(quotes)
            .gainers.map((mover) => mover.instrument)
            .filter((instrument) => !watched.includes(instrument))
            .slice(0, 5);
          return [...watched, ...movers].slice(0, 9);
        })();

    if (liveHits.length === 0) return local;

    const seen = new Set(local.map((instrument) => instrument.symbol));
    const extra = liveHits
      .filter((hit) => !seen.has(hit.symbol))
      .map((hit) => getInstrument(hit.symbol))
      .filter((instrument): instrument is NonNullable<typeof instrument> => Boolean(instrument))
      .slice(0, 6);

    return [...local, ...extra].slice(0, 12);
  }, [trimmed, liveHits, state.watchlist, quotes]);

  // Resetting on open / on query change is derived state, so it happens during
  // render rather than in an effect (avoids a cascading second render).
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }

  const [prevQuery, setPrevQuery] = React.useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setCursor(0);
  }

  function go(symbol: string) {
    onOpenChange(false);
    router.push(`/app/stock/${encodeURIComponent(symbol)}`);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === "Enter" && results[cursor]) {
      event.preventDefault();
      go(results[cursor]!.symbol);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[18%] max-w-[36rem] translate-y-0 gap-0 overflow-hidden rounded-2xl p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Search instruments</DialogTitle>
        <div className="flex items-center gap-2.5 border-b px-4">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search ticker, company, sector or theme…"
            className="h-13 border-0 bg-transparent px-0 py-3.5 text-[15px] shadow-none focus-visible:ring-0"
            aria-label="Search instruments"
          />
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[22rem] overflow-y-auto p-1.5" role="listbox" aria-label="Search results">
          <p className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
            {query.trim() ? `${results.length} result${results.length === 1 ? "" : "s"}` : "Suggested for you"}
          </p>

          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No instruments match “{query}”. Try AAPL, energy, AI or ETF.
            </p>
          )}

          {results.map((instrument, index) => {
            const quote = quotes[instrument.symbol];
            const pct = quote?.changePct ?? instrument.changePct;
            const watched = state.watchlist.includes(instrument.symbol);
            return (
              <div
                key={instrument.symbol}
                role="option"
                aria-selected={index === cursor}
                onMouseEnter={() => setCursor(index)}
                onClick={() => go(instrument.symbol)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
                  index === cursor ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                <StockAvatar symbol={instrument.symbol} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                    <span className="font-mono">{instrument.symbol}</span>
                    {watched && <StarIcon className="size-3 fill-warning text-warning" />}
                  </p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{instrument.name}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-[11px] text-muted-foreground">{instrument.sector}</p>
                  <p className="tnum text-[11px] text-muted-foreground">
                    {formatCompactMoney(instrument.marketCap)} cap
                  </p>
                </div>
                <div className="w-[5.5rem] text-right">
                  <LivePrice symbol={instrument.symbol} size="sm" className="block" showFlash={false} />
                  <span className={cn("tnum text-[11px] font-medium", pct >= 0 ? "text-gain" : "text-loss")}>
                    {formatPercent(pct)}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={watched ? `Remove ${instrument.symbol} from watchlist` : `Add ${instrument.symbol} to watchlist`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleWatchlist(instrument.symbol);
                  }}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <StarIcon className={cn("size-4", watched && "fill-warning text-warning")} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <TrendingUpIcon className="size-3.5" />
            {liveConfigured ? (
              <>
                {CATALOG.length} catalogued + the live {providerLabel} universe
              </>
            ) : (
              <>{CATALOG.length} simulated instruments</>
            )}
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <CornerDownLeftIcon className="size-3.5" />
            to open
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
