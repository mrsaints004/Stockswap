"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePreStocks } from "@/hooks/use-prestocks";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { formatPrice } from "@/lib/format";
import {
  getQuote,
  getSwapTransaction,
  executeSwap,
  USDC_MINT,
} from "@/lib/jupiter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingBasket,
  Wallet,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { PreStock, BasketAllocation } from "@/lib/types";

// Preset baskets
const PRESET_BASKETS = [
  {
    name: "AI Leaders",
    description: "Top AI companies pre-IPO",
    icon: Sparkles,
    symbols: ["OPENAI", "ANTHROPIC", "DATABRICKS"],
    weights: [40, 35, 25],
  },
  {
    name: "Tech Giants",
    description: "High-growth private tech",
    icon: Zap,
    symbols: ["SPACEX", "STRIPE", "CANVA"],
    weights: [40, 35, 25],
  },
];

type BasketStatus = "idle" | "executing" | "success" | "error";

export function BasketBuilder() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible: openWalletModal } = useWalletModal();
  const { stocks } = usePreStocks();
  const allMints = stocks.map((s) => s.contract_address);
  const { balances, refetch: refetchBalances } = useTokenBalances(allMints);

  const [allocations, setAllocations] = useState<BasketAllocation[]>([]);
  const [totalUsdc, setTotalUsdc] = useState("100");
  const [status, setStatus] = useState<BasketStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<
    Array<{ symbol: string; txid: string; success: boolean }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [showTokenPicker, setShowTokenPicker] = useState(false);

  const usdcBalance = balances.get(USDC_MINT)?.balance ?? 0;

  const totalWeight = allocations.reduce((s, a) => s + a.percentage, 0);
  const isValidBasket = allocations.length >= 2 && Math.abs(totalWeight - 100) < 0.01;

  const addToken = useCallback(
    (stock: PreStock) => {
      if (allocations.find((a) => a.token.contract_address === stock.contract_address)) {
        return;
      }
      // Auto-distribute weights equally
      const newAlloc = [...allocations, { token: stock, percentage: 0 }];
      const equalWeight = Math.floor(100 / newAlloc.length);
      const distributed = newAlloc.map((a, i) => ({
        ...a,
        percentage: i === newAlloc.length - 1
          ? 100 - equalWeight * (newAlloc.length - 1)
          : equalWeight,
      }));
      setAllocations(distributed);
      setShowTokenPicker(false);
    },
    [allocations]
  );

  const removeToken = useCallback(
    (index: number) => {
      const newAlloc = allocations.filter((_, i) => i !== index);
      if (newAlloc.length > 0) {
        const equalWeight = Math.floor(100 / newAlloc.length);
        const distributed = newAlloc.map((a, i) => ({
          ...a,
          percentage: i === newAlloc.length - 1
            ? 100 - equalWeight * (newAlloc.length - 1)
            : equalWeight,
        }));
        setAllocations(distributed);
      } else {
        setAllocations([]);
      }
    },
    [allocations]
  );

  const updateWeight = useCallback(
    (index: number, value: string) => {
      const num = parseFloat(value) || 0;
      setAllocations((prev) =>
        prev.map((a, i) => (i === index ? { ...a, percentage: num } : a))
      );
    },
    []
  );

  const applyPreset = useCallback(
    (preset: (typeof PRESET_BASKETS)[number]) => {
      const newAllocations: BasketAllocation[] = [];
      for (let i = 0; i < preset.symbols.length; i++) {
        const stock = stocks.find(
          (s) => s.symbol.toUpperCase() === preset.symbols[i]
        );
        if (stock) {
          newAllocations.push({
            token: stock,
            percentage: preset.weights[i],
          });
        }
      }
      if (newAllocations.length > 0) {
        // Redistribute weights if some tokens weren't found
        const totalFound = newAllocations.reduce((s, a) => s + a.percentage, 0);
        if (totalFound < 100) {
          const scale = 100 / totalFound;
          for (const a of newAllocations) {
            a.percentage = Math.round(a.percentage * scale);
          }
          // Fix rounding
          const diff = 100 - newAllocations.reduce((s, a) => s + a.percentage, 0);
          if (diff !== 0) newAllocations[0].percentage += diff;
        }
        setAllocations(newAllocations);
      }
    },
    [stocks]
  );

  const handleExecuteBasket = useCallback(async () => {
    if (
      !connected ||
      !publicKey ||
      !signTransaction ||
      !isValidBasket
    )
      return;

    const total = parseFloat(totalUsdc);
    if (!total || total <= 0) return;

    setStatus("executing");
    setError(null);
    setProgress(0);
    setResults([]);

    const newResults: Array<{
      symbol: string;
      txid: string;
      success: boolean;
    }> = [];

    for (let i = 0; i < allocations.length; i++) {
      const alloc = allocations[i];
      const usdcAmount = (total * alloc.percentage) / 100;
      const rawAmount = Math.floor(usdcAmount * 1e6); // USDC has 6 decimals

      try {
        setProgress(((i + 0.3) / allocations.length) * 100);

        // Get quote
        const quote = await getQuote(
          USDC_MINT,
          alloc.token.contract_address,
          rawAmount
        );

        setProgress(((i + 0.6) / allocations.length) * 100);

        // Get and execute swap
        const { swapTransaction } = await getSwapTransaction(
          quote,
          publicKey.toBase58()
        );

        const txid = await executeSwap(
          connection,
          swapTransaction,
          signTransaction
        );

        newResults.push({
          symbol: alloc.token.symbol,
          txid,
          success: true,
        });
      } catch (err) {
        newResults.push({
          symbol: alloc.token.symbol,
          txid: "",
          success: false,
        });
        console.error(`Basket buy failed for ${alloc.token.symbol}:`, err);
      }

      setProgress(((i + 1) / allocations.length) * 100);
      setResults([...newResults]);
    }

    const succeeded = newResults.filter((r) => r.success).length;
    if (succeeded === allocations.length) {
      setStatus("success");
      toast.success(`Basket buy complete! ${succeeded}/${allocations.length} tokens purchased.`);
    } else if (succeeded > 0) {
      setStatus("success");
      toast.warning(`Partial success: ${succeeded}/${allocations.length} tokens purchased.`);
    } else {
      setStatus("error");
      setError("All basket purchases failed");
      toast.error("Basket buy failed");
    }

    refetchBalances();
  }, [
    connected,
    publicKey,
    signTransaction,
    isValidBasket,
    totalUsdc,
    allocations,
    connection,
    refetchBalances,
  ]);

  const resetStatus = () => {
    setStatus("idle");
    setError(null);
    setResults([]);
    setProgress(0);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <ShoppingBasket className="h-5 w-5 text-orange-500" />
          Index Basket
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Buy multiple pre-IPO stocks in one click with custom allocations
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset baskets */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Quick Presets
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_BASKETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="rounded-xl border p-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5 text-orange-500" />
                    <span className="font-medium text-sm">{preset.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Allocations */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Allocations</label>
            <Badge
              variant={isValidBasket ? "default" : "destructive"}
              className={`text-xs ${isValidBasket ? "bg-emerald-500/10 text-emerald-600" : ""}`}
            >
              {totalWeight.toFixed(0)}% / 100%
            </Badge>
          </div>

          <div className="space-y-2">
            {allocations.map((alloc, i) => (
              <div
                key={alloc.token.contract_address}
                className="flex items-center gap-2 rounded-xl border p-2.5"
              >
                <Image
                  src={alloc.token.image}
                  alt={alloc.token.symbol}
                  width={24}
                  height={24}
                  className="rounded-full"
                  unoptimized
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {alloc.token.symbol}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatPrice(alloc.token.tokenPrice)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number"
                    value={alloc.percentage}
                    onChange={(e) => updateWeight(i, e.target.value)}
                    className="w-16 h-8 text-sm text-center font-mono p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <button
                  onClick={() => removeToken(i)}
                  className="text-muted-foreground hover:text-red-500 p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Add token button */}
            <div className="relative">
              <button
                onClick={() => setShowTokenPicker(!showTokenPicker)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed p-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add token
              </button>

              {showTokenPicker && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border bg-background shadow-lg max-h-48 overflow-y-auto">
                  {stocks
                    .filter(
                      (s) =>
                        !allocations.find(
                          (a) =>
                            a.token.contract_address === s.contract_address
                        )
                    )
                    .map((stock) => (
                      <button
                        key={stock.contract_address}
                        onClick={() => addToken(stock)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-muted text-left text-sm"
                      >
                        <Image
                          src={stock.image}
                          alt={stock.symbol}
                          width={20}
                          height={20}
                          className="rounded-full"
                          unoptimized
                        />
                        <span className="font-medium">{stock.symbol}</span>
                        <span className="text-muted-foreground text-xs flex-1 truncate">
                          {stock.name}
                        </span>
                        <span className="font-mono text-muted-foreground text-xs">
                          {formatPrice(stock.tokenPrice)}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Amount */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Total Investment
          </label>
          <div className="relative">
            <Input
              type="number"
              value={totalUsdc}
              onChange={(e) => setTotalUsdc(e.target.value)}
              placeholder="100"
              className="font-mono pr-14"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              USDC
            </span>
          </div>
          {connected && (
            <p className="text-xs text-muted-foreground mt-1">
              Available: {usdcBalance.toFixed(2)} USDC
            </p>
          )}
        </div>

        {/* Allocation preview */}
        {isValidBasket && parseFloat(totalUsdc) > 0 && (
          <div className="rounded-xl border bg-muted/20 p-3 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              You will buy:
            </div>
            {allocations.map((alloc) => {
              const usdcAmount =
                (parseFloat(totalUsdc) * alloc.percentage) / 100;
              const estimatedTokens = usdcAmount / alloc.token.tokenPrice;
              return (
                <div
                  key={alloc.token.contract_address}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {alloc.token.symbol} ({alloc.percentage}%)
                  </span>
                  <span className="font-mono text-muted-foreground">
                    ~{estimatedTokens.toFixed(4)} for ${usdcAmount.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Execution progress */}
        {status === "executing" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
              <span>
                Executing basket buy... ({results.length}/{allocations.length})
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            {results.map((r) => (
              <div
                key={r.symbol}
                className={`flex items-center gap-2 text-xs ${r.success ? "text-emerald-500" : "text-red-500"}`}
              >
                {r.success ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {r.symbol}: {r.success ? "Purchased" : "Failed"}
                {r.success && r.txid && (
                  <a
                    href={`https://solscan.io/tx/${r.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Success state */}
        {status === "success" && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Basket buy complete!
            </div>
            {results.map((r) => (
              <div
                key={r.symbol}
                className={`flex items-center gap-2 text-xs ${r.success ? "text-emerald-500" : "text-red-500"}`}
              >
                {r.success ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {r.symbol}
                {r.success && r.txid && (
                  <a
                    href={`https://solscan.io/tx/${r.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-500 hover:underline"
                  >
                    View <ExternalLink className="h-3 w-3 inline" />
                  </a>
                )}
              </div>
            ))}
            <button
              onClick={resetStatus}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Buy another basket
            </button>
          </div>
        )}

        {status === "error" && error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="flex-1 text-sm text-red-600">{error}</span>
            <button
              onClick={resetStatus}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Execute button */}
        {!connected ? (
          <Button
            onClick={() => openWalletModal(true)}
            className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white text-base font-medium"
          >
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet
          </Button>
        ) : (
          <Button
            onClick={handleExecuteBasket}
            disabled={
              !isValidBasket ||
              !totalUsdc ||
              parseFloat(totalUsdc) <= 0 ||
              parseFloat(totalUsdc) > usdcBalance ||
              status === "executing"
            }
            className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white text-base font-medium disabled:opacity-50"
          >
            {status === "executing" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buying basket...
              </>
            ) : (
              `Buy ${allocations.length}-Token Basket for $${parseFloat(totalUsdc || "0").toFixed(2)}`
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
