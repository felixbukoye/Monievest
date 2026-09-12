"use client";

import * as React from "react";

import { ChangeChip, LivePrice } from "@/components/shared/prices";
import { StockAvatar } from "@/components/shared/stock-avatar";
import { TradeForm } from "@/components/trade/trade-form";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATALOG, getInstrument } from "@/lib/market/catalog";
import type { OrderSide } from "@/lib/store/types";

const DEFAULT_SYMBOL = "SPY";

export function TradeDialog({
  symbol: requestedSymbol,
  open,
  onOpenChange,
  initialSide = "buy",
}: {
  /** `null` opens the dialog with an instrument picker (the global Trade button). */
  symbol: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSide?: OrderSide;
}) {
  const [picked, setPicked] = React.useState<string>(requestedSymbol ?? DEFAULT_SYMBOL);

  // Re-point the dialog whenever it is opened for a specific instrument.
  // Handled as derived state during render so there is no extra render pass.
  const requestedKey = open ? (requestedSymbol ?? DEFAULT_SYMBOL) : null;
  const [prevRequestedKey, setPrevRequestedKey] = React.useState<string | null>(null);
  if (requestedKey !== prevRequestedKey) {
    setPrevRequestedKey(requestedKey);
    if (requestedKey) setPicked(requestedKey);
  }

  const instrument = getInstrument(picked);
  if (!instrument) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[27rem] gap-0 overflow-y-auto p-0">
        <div className="flex items-center gap-3 border-b bg-muted/30 px-5 py-4">
          <StockAvatar symbol={instrument.symbol} size="md" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="flex items-center gap-2 truncate text-[15px]">
              {instrument.name}
              <Badge variant="muted" className="font-mono text-[10px]">
                {instrument.symbol}
              </Badge>
            </DialogTitle>
            <DialogDescription className="mt-1 flex items-center gap-2 text-xs">
              <LivePrice symbol={instrument.symbol} size="sm" />
              <ChangeChip pct={instrument.changePct} size="sm" />
            </DialogDescription>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {requestedSymbol === null && (
            <div className="space-y-2">
              <Label htmlFor="trade-symbol">Instrument</Label>
              <Select value={picked} onValueChange={setPicked}>
                <SelectTrigger id="trade-symbol" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {CATALOG.map((option) => (
                    <SelectItem key={option.symbol} value={option.symbol}>
                      <span className="font-mono">{option.symbol}</span>
                      <span className="ml-2 text-muted-foreground">{option.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <TradeForm
            key={picked}
            symbol={picked}
            initialSide={initialSide}
            layout="dialog"
            onDone={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
