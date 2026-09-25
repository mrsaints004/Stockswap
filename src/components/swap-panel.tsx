"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
  getMintDecimals,
  USDC_MINT,
  type JupiterQuote,
} from "@/lib/jupiter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowDownUp,
  Wallet,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { PreStock } from "@/lib/types";

interface SwapPanelProps {
  selectedToken?: PreStock | null;
}

type SwapStatus =
  | "idle"
  | "quoting"
  | "ready"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export function SwapPanel({ selectedToken }: SwapPanelProps) {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible: openWalletModal } = useWalletModal();
  const { stocks } = usePreStocks();
  const [fromAmount, setFromAmount] = useState("");
  const [manualToken, setManualToken] = useState<PreStock | null>(null);
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [showTokenSelect, setShowTokenSelect] = useState(false);
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slippage, setSlippage] = useState(50); // bps
  const [showSettings, setShowSettings] = useState(false);
  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toToken = manualToken ?? selectedToken ?? stocks[0] ?? null;

  // Get all mints for balance tracking
  const allMints = stocks.map((s) => s.contract_address);
  const { balances, refetch: refetchBalances } = useTokenBalances(allMints);

  const usdcBalance = balances.get(USDC_MINT)?.balance ?? 0;
  const tokenBalance = toToken
    ? balances.get(toToken.contract_address)?.balance ?? 0
    : 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowTokenSelect(false);
      }
    }
    if (showTokenSelect) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showTokenSelect]);

  const fetchQuote = useCallback(
    (amount: string, token: PreStock | null, dir: "buy" | "sell") => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);

      if (!amount || !token || parseFloat(amount) <= 0) {
        setQuote(null);
        setStatus("idle");
        return;
      }

      quoteTimerRef.current = setTimeout(async () => {
        try {
          setStatus("quoting");
          setError(null);

          const inputMint =
            dir === "buy" ? USDC_MINT : token.contract_address;
          const outputMint =
            dir === "buy" ? token.contract_address : USDC_MINT;

          const decimals = await getMintDecimals(connection, inputMint);
          const rawAmount = Math.floor(
            parseFloat(amount) * Math.pow(10, decimals)
          );

          const q = await getQuote(inputMint, outputMint, rawAmount, slippage);
          setQuote(q);
          setStatus("ready");
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Failed to get quote"
          );
          setStatus("error");
          setQuote(null);
        }
      }, 500);
    },
    [connection, slippage]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    };
  }, []);

  const handleAmountChange = useCallback(
    (value: string) => {
      setFromAmount(value);
      fetchQuote(value, toToken, direction);
    },
    [toToken, direction, fetchQuote]
  );

  const handleMax = useCallback(() => {
    const maxBal = direction === "buy" ? usdcBalance : tokenBalance;
    if (maxBal > 0) {
      const maxStr = maxBal.toString();
      setFromAmount(maxStr);
      fetchQuote(maxStr, toToken, direction);
    }
  }, [direction, usdcBalance, tokenBalance, toToken, fetchQuote]);

  const [inDecimals, setInDecimals] = useState(6);
  const [outDecimals, setOutDecimals] = useState(6);

  const inputMintAddr = toToken
    ? direction === "buy"
      ? USDC_MINT
      : toToken.contract_address
    : null;
  const outputMintAddr = toToken
    ? direction === "buy"
      ? toToken.contract_address
      : USDC_MINT
    : null;

  useEffect(() => {
    if (inputMintAddr) {
      getMintDecimals(connection, inputMintAddr).then(setInDecimals);
    }
    if (outputMintAddr) {
      getMintDecimals(connection, outputMintAddr).then(setOutDecimals);
    }
  }, [inputMintAddr, outputMintAddr, connection]);

  const toAmount = quote
    ? (parseInt(quote.outAmount) / Math.pow(10, outDecimals)).toFixed(
        Math.min(outDecimals, 6)
      )
    : "";

  const handleSwapDirection = useCallback(() => {
    setDirection((d) => (d === "buy" ? "sell" : "buy"));
    setFromAmount("");
    setQuote(null);
    setStatus("idle");
  }, []);

  // Check if user has sufficient balance
  const inputBalance = direction === "buy" ? usdcBalance : tokenBalance;
  const insufficientBalance =
    fromAmount && parseFloat(fromAmount) > inputBalance;

  const handleSwap = useCallback(async () => {
    if (!connected || !publicKey || !signTransaction || !quote) return;

    try {
      setStatus("signing");
      setError(null);

      const { swapTransaction } = await getSwapTransaction(
        quote,
        publicKey.toBase58()
      );

      setStatus("confirming");

      const txid = await executeSwap(
        connection,
        swapTransaction,
        signTransaction
      );

      setTxSignature(txid);
      setStatus("success");
      setFromAmount("");
      setQuote(null);
      refetchBalances();
      toast.success("Swap successful!", {
        description: `View on Solscan`,
        action: {
          label: "View",
          onClick: () => window.open(`https://solscan.io/tx/${txid}`, "_blank"),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Swap failed";
      setError(msg);
      setStatus("error");
      toast.error("Swap failed", { description: msg });
    }
  }, [connected, publicKey, signTransaction, quote, connection, refetchBalances]);

  const resetStatus = useCallback(() => {
    setStatus("idle");
    setError(null);
    setTxSignature(null);
  }, []);

  const priceImpactHigh = quote
    ? parseFloat(quote.priceImpactPct) > 1
    : false;

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <ArrowDownUp className="h-5 w-5 text-emerald-500" />
            Swap
          </CardTitle>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
          >
            {slippage / 100}% slippage
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Trade stablecoins for pre-IPO stock tokens via Jupiter
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Slippage settings */}
        {showSettings && (
          <div className="rounded-xl border p-3 bg-muted/20 space-y-2">
            <div className="text-sm font-medium">Slippage Tolerance</div>
            <div className="flex gap-2">
              {[25, 50, 100, 200].map((bps) => (
                <button
                  key={bps}
                  onClick={() => {
                    setSlippage(bps);
                    if (fromAmount && toToken) {
                      fetchQuote(fromAmount, toToken, direction);
                    }
                  }}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-sm transition-colors ${
                    slippage === bps
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                      : "hover:bg-muted"
                  }`}
                >
                  {bps / 100}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Success / Error banners */}
        {status === "success" && txSignature && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <div className="flex-1 text-sm">
              <span className="text-emerald-600 font-medium">
                Swap successful!
              </span>
              <a
                href={`https://solscan.io/tx/${txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-1 text-emerald-500 hover:underline"
              >
                View tx <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <button
              onClick={resetStatus}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {status === "error" && error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="flex-1 text-sm text-red-600 break-all">
              {error}
            </span>
            <button
              onClick={resetStatus}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* From */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {direction === "buy" ? "You pay" : "You sell"}
            </span>
            {connected && (
              <button
                onClick={handleMax}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Wallet className="h-3 w-3" />
                {direction === "buy"
                  ? `${usdcBalance.toFixed(2)} USDC`
                  : `${tokenBalance.toFixed(4)} ${toToken?.symbol || ""}`}
                <span className="text-emerald-500 font-medium ml-0.5">
                  MAX
                </span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              placeholder="0.00"
              value={fromAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="border-0 bg-transparent text-2xl font-mono p-0 h-auto focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {direction === "buy" ? (
              <Badge
                variant="outline"
                className="shrink-0 gap-1.5 px-3 py-1.5 text-sm"
              >
                <div className="h-5 w-5 rounded-full bg-muted-foreground flex items-center justify-center text-[10px] font-bold text-white">
                  $
                </div>
                USDC
              </Badge>
            ) : (
              <button
                onClick={() => setShowTokenSelect(!showTokenSelect)}
                className="shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
              >
                {toToken && (
                  <Image
                    src={toToken.image}
                    alt={toToken.symbol}
                    width={20}
                    height={20}
                    className="rounded-full"
                    unoptimized
                  />
                )}
                {toToken?.symbol || "Select"}
                <ChevronDown className="h-3 w-3" />
              </button>
            )}
          </div>
          {insufficientBalance && (
            <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
              <AlertTriangle className="h-3 w-3" />
              Insufficient balance
            </div>
          )}
        </div>

        {/* Swap direction toggle */}
        <div className="flex justify-center -my-1.5 relative z-10">
          <button
            onClick={handleSwapDirection}
            className="rounded-xl border bg-background p-2 shadow-sm hover:bg-muted transition-colors"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        {/* To */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">You receive</span>
            <div className="flex items-center gap-2">
              {status === "quoting" && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
              {connected && direction === "buy" && toToken && (
                <span className="text-xs text-muted-foreground">
                  Balance: {tokenBalance.toFixed(4)}
                </span>
              )}
              {connected && direction === "sell" && (
                <span className="text-xs text-muted-foreground">
                  Balance: {usdcBalance.toFixed(2)} USDC
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-2xl font-mono text-muted-foreground flex-1 min-w-0 truncate">
              {toAmount || "0.00"}
            </div>
            {direction === "buy" ? (
              <button
                onClick={() => setShowTokenSelect(!showTokenSelect)}
                className="shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
              >
                {toToken && (
                  <Image
                    src={toToken.image}
                    alt={toToken.symbol}
                    width={20}
                    height={20}
                    className="rounded-full"
                    unoptimized
                  />
                )}
                {toToken?.symbol || "Select"}
                <ChevronDown className="h-3 w-3" />
              </button>
            ) : (
              <Badge
                variant="outline"
                className="shrink-0 gap-1.5 px-3 py-1.5 text-sm"
              >
                <div className="h-5 w-5 rounded-full bg-muted-foreground flex items-center justify-center text-[10px] font-bold text-white">
                  $
                </div>
                USDC
              </Badge>
            )}
          </div>
        </div>

        {/* Token selector dropdown */}
        {showTokenSelect && (
          <div
            ref={dropdownRef}
            className="absolute left-4 right-4 z-20 rounded-xl border bg-background shadow-lg max-h-64 overflow-y-auto"
          >
            {stocks.map((stock) => {
              const bal = balances.get(stock.contract_address)?.balance ?? 0;
              return (
                <button
                  key={stock.contract_address}
                  onClick={() => {
                    setManualToken(stock);
                    setShowTokenSelect(false);
                    setQuote(null);
                    setStatus("idle");
                    fetchQuote(fromAmount, stock, direction);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted text-left"
                >
                  <Image
                    src={stock.image}
                    alt={stock.symbol}
                    width={24}
                    height={24}
                    className="rounded-full"
                    unoptimized
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{stock.symbol}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {stock.name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono text-muted-foreground">
                      {formatPrice(stock.tokenPrice)}
                    </div>
                    {connected && bal > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        {bal.toFixed(4)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Quote details */}
        {quote && toToken && (
          <>
            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Rate</span>
                <span className="font-mono">
                  1 {toToken.symbol} ={" "}
                  {formatPrice(
                    direction === "buy"
                      ? (parseFloat(quote.inAmount) /
                          Math.pow(10, inDecimals)) /
                          (parseFloat(quote.outAmount) /
                            Math.pow(10, outDecimals))
                      : (parseFloat(quote.outAmount) /
                          Math.pow(10, outDecimals)) /
                          (parseFloat(quote.inAmount) /
                            Math.pow(10, inDecimals))
                  )}{" "}
                  USDC
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Price Impact</span>
                <span
                  className={`font-mono ${priceImpactHigh ? "text-red-500 font-medium" : ""}`}
                >
                  {priceImpactHigh && (
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                  )}
                  {parseFloat(quote.priceImpactPct).toFixed(4)}%
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Route</span>
                <span>
                  {quote.routePlan
                    .map((r) => r.swapInfo.label)
                    .filter(Boolean)
                    .join(" → ") || "Jupiter"}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Slippage</span>
                <span className="font-mono">{quote.slippageBps / 100}%</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Min received</span>
                <span className="font-mono">
                  {(
                    parseInt(quote.otherAmountThreshold) /
                    Math.pow(10, outDecimals)
                  ).toFixed(Math.min(outDecimals, 6))}{" "}
                  {direction === "buy" ? toToken.symbol : "USDC"}
                </span>
              </div>
            </div>
          </>
        )}

        {/* No quote yet but token selected */}
        {!quote && toToken && status === "idle" && (
          <>
            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Estimated Price</span>
                <span className="font-mono">
                  1 {toToken.symbol} = {formatPrice(toToken.tokenPrice)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Mark Price</span>
                <span className="font-mono">
                  {formatPrice(toToken.markPrice)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Route</span>
                <span>Jupiter Aggregator</span>
              </div>
            </div>
          </>
        )}

        {/* Swap button */}
        {!connected ? (
          <Button
            onClick={() => openWalletModal(true)}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-medium"
          >
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet to Swap
          </Button>
        ) : (
          <Button
            onClick={handleSwap}
            disabled={
              !fromAmount ||
              !toToken ||
              !!insufficientBalance ||
              status === "signing" ||
              status === "confirming" ||
              status === "quoting" ||
              (!quote && !!fromAmount)
            }
            className={`w-full h-12 text-white text-base font-medium disabled:opacity-50 ${
              priceImpactHigh
                ? "bg-red-500 hover:bg-red-600"
                : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            {status === "quoting" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finding best route...
              </>
            ) : status === "signing" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sign in wallet...
              </>
            ) : status === "confirming" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming transaction...
              </>
            ) : insufficientBalance ? (
              "Insufficient balance"
            ) : priceImpactHigh ? (
              `Swap anyway (high impact)`
            ) : (
              `Swap ${direction === "buy" ? "USDC" : toToken?.symbol || ""} → ${direction === "buy" ? toToken?.symbol || "" : "USDC"}`
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
