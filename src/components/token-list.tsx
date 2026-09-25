"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { usePreStocks } from "@/hooks/use-prestocks";
import { usePythPrices } from "@/hooks/use-pyth-prices";
import { formatPrice, formatValuation, formatSupply } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ExternalLink,
  ArrowUpDown,
  Radio,
} from "lucide-react";
import type { PreStock } from "@/lib/types";

type SortField = "name" | "tokenPrice" | "impliedValuation" | "supply";
type SortDir = "asc" | "desc";

export function TokenList({
  onSelectToken,
}: {
  onSelectToken?: (token: PreStock) => void;
}) {
  const { stocks, loading, error } = usePreStocks();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("impliedValuation");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Get Pyth price feeds for all symbols
  const symbols = useMemo(() => stocks.map((s) => s.symbol), [stocks]);
  const { prices: pythPrices, loading: pythLoading } = usePythPrices(symbols);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filtered = stocks
    .filter(
      (s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.symbol.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") return mul * a.name.localeCompare(b.name);
      return mul * ((a[sortField] as number) - (b[sortField] as number));
    });

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          Failed to load PreStocks data. {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">Pre-IPO Markets</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Tokenized pre-IPO stocks on Solana via{" "}
              <a
                href="https://prestocks.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-500 hover:underline"
              >
                PreStocks
              </a>
              {!pythLoading && pythPrices.size > 0 && (
                <span className="inline-flex items-center gap-1 ml-2">
                  <Radio className="h-3 w-3 text-orange-500 animate-pulse" />
                  <span className="text-orange-500 text-xs">Pyth Live</span>
                </span>
              )}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px]">
                  <button
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Token <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => toggleSort("tokenPrice")}
                    className="flex items-center gap-1 ml-auto hover:text-foreground"
                  >
                    Price <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-right hidden sm:table-cell">
                  Mark / Oracle
                </TableHead>
                <TableHead className="text-right hidden md:table-cell">
                  <button
                    onClick={() => toggleSort("impliedValuation")}
                    className="flex items-center gap-1 ml-auto hover:text-foreground"
                  >
                    Valuation <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-right hidden lg:table-cell">
                  <button
                    onClick={() => toggleSort("supply")}
                    className="flex items-center gap-1 ml-auto hover:text-foreground"
                  >
                    Supply <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                : filtered.map((stock) => {
                    const priceDiff =
                      ((stock.tokenPrice - stock.markPrice) /
                        stock.markPrice) *
                      100;

                    // Get Pyth oracle price if available
                    const pythPrice = pythPrices.get(stock.symbol.toUpperCase());
                    const hasPyth = !!pythPrice;

                    return (
                      <TableRow
                        key={stock.contract_address}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => onSelectToken?.(stock)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Image
                              src={stock.image}
                              alt={stock.name}
                              width={32}
                              height={32}
                              className="rounded-full"
                              unoptimized
                            />
                            <div>
                              <div className="font-medium flex items-center gap-1.5">
                                {stock.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {stock.symbol}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatPrice(stock.tokenPrice)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground hidden sm:table-cell">
                          <div className="space-y-0.5">
                            <div>{formatPrice(stock.markPrice)}</div>
                            {hasPyth && (
                              <div className="flex items-center justify-end gap-1 text-orange-500 text-[10px]">
                                <Radio className="h-2.5 w-2.5" />
                                {formatPrice(pythPrice.price)}
                              </div>
                            )}
                            <Badge
                              variant={
                                priceDiff >= 0 ? "default" : "destructive"
                              }
                              className={`text-[10px] px-1.5 py-0 ${
                                priceDiff >= 0
                                  ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                                  : ""
                              }`}
                            >
                              {priceDiff >= 0 ? "+" : ""}
                              {priceDiff.toFixed(2)}%
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono hidden md:table-cell">
                          {formatValuation(stock.impliedValuation)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground hidden lg:table-cell">
                          {formatSupply(stock.supply)}
                        </TableCell>
                        <TableCell>
                          <a
                            href={stock.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            No tokens found matching &ldquo;{search}&rdquo;
          </div>
        )}
      </CardContent>
    </Card>
  );
}
