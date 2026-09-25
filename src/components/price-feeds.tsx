"use client";

import { usePythPrices } from "@/hooks/use-pyth-prices";
import { formatPrice } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity } from "lucide-react";

const TRACKED_SYMBOLS = [
  "AAPL",
  "TSLA",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "MSFT",
];

export function PriceFeeds() {
  const { data, loading, error, getPricesForSymbol } = usePythPrices();

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          Failed to load Pyth price feeds. {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              Pyth Price Feeds
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time equity vs tokenized stock prices from{" "}
              <a
                href="https://pyth.network"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-500 hover:underline"
              >
                Pyth Network
              </a>
            </p>
          </div>
          <Badge
            variant="outline"
            className="gap-1.5 border-purple-500/30 text-purple-500"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Equity Price</TableHead>
              <TableHead className="text-right">xStock Price</TableHead>
              <TableHead className="text-right">Spread</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              : TRACKED_SYMBOLS.map((symbol) => {
                  const name = data?.feedMap[symbol]?.name ?? symbol;
                  const { equityPrice, xstockPrice } =
                    getPricesForSymbol(symbol);

                  const spread =
                    equityPrice && xstockPrice
                      ? ((xstockPrice - equityPrice) / equityPrice) * 100
                      : null;

                  return (
                    <TableRow key={symbol}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{symbol}</div>
                          <div className="text-xs text-muted-foreground">
                            {name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {equityPrice ? formatPrice(equityPrice) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {xstockPrice ? formatPrice(xstockPrice) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {spread !== null ? (
                          <Badge
                            variant="outline"
                            className={`font-mono ${
                              Math.abs(spread) < 0.5
                                ? "border-emerald-500/30 text-emerald-600"
                                : Math.abs(spread) < 2
                                  ? "border-yellow-500/30 text-yellow-600"
                                  : "border-red-500/30 text-red-600"
                            }`}
                          >
                            {spread >= 0 ? "+" : ""}
                            {spread.toFixed(3)}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            No xStock
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
