"use client";

import { usePreStocks } from "@/hooks/use-prestocks";
import { formatValuation } from "@/lib/format";
import { TrendingUp, Coins, BarChart3 } from "lucide-react";

export function StatsBar() {
  const { stocks, loading } = usePreStocks();

  const totalValuation = stocks.reduce(
    (sum, s) => sum + s.impliedValuation,
    0
  );
  const totalTokens = stocks.length;
  const avgPremium =
    stocks.length > 0
      ? stocks.reduce(
          (sum, s) =>
            sum + ((s.tokenPrice - s.markPrice) / s.markPrice) * 100,
          0
        ) / stocks.length
      : 0;

  if (loading) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <BarChart3 className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total Implied Value</p>
          <p className="text-lg font-semibold font-mono">
            {formatValuation(totalValuation)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <Coins className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Available Tokens</p>
          <p className="text-lg font-semibold">{totalTokens}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Avg Token Premium</p>
          <p
            className={`text-lg font-semibold font-mono ${avgPremium >= 0 ? "text-emerald-500" : "text-red-500"}`}
          >
            {avgPremium >= 0 ? "+" : ""}
            {avgPremium.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}
