"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePreStocks } from "@/hooks/use-prestocks";
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
} from "lucide-react";
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
  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive active token: manual selection > parent prop > first stock
  const toToken = manualToken ?? selectedToken ?? stocks[0] ?? null;

  const fetchQuote = useCallback(
    async (amount: string, token: PreStock | null, dir: "buy" | "sell") => {
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

          const q = await getQuote(inputMint, outputMint, rawAmount);
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
    [connection]
  );

  const handleAmountChange = useCallback(
    (value: string) => {
      setFromAmount(value);
      fetchQuote(value, toToken, direction);
    },
    [toToken, direction, fetchQuote]
  );

  const [inDecimals, setInDecimals] = useState(6);
  const [outDecimals, setOutDecimals] = useState(6);

  // Fetch mint decimals when direction or token changes
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed");
      setStatus("error");
    }
  }, [connected, publicKey, signTransaction, quote, connection]);

  const resetStatus = useCallback(() => {
    setStatus("idle");
    setError(null);
    setTxSignature(null);
  }, []);

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <ArrowDownUp className="h-5 w-5 text-emerald-500" />
          Swap
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Trade stablecoins for pre-IPO stock tokens via Jupiter
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
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
                <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
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
            {status === "quoting" && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-2xl font-mono text-muted-foreground flex-1">
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
                <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
                  $
                </div>
                USDC
              </Badge>
            )}
          </div>
        </div>

        {/* Token selector dropdown */}
        {showTokenSelect && (
          <div className="absolute left-4 right-4 z-20 rounded-xl border bg-background shadow-lg max-h-64 overflow-y-auto">
            {stocks.map((stock) => (
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
                <div className="flex-1">
                  <div className="text-sm font-medium">{stock.symbol}</div>
                  <div className="text-xs text-muted-foreground">
                    {stock.name}
                  </div>
                </div>
                <div className="text-sm font-mono text-muted-foreground">
                  {formatPrice(stock.tokenPrice)}
                </div>
              </button>
            ))}
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
                      ? (parseFloat(quote.inAmount) / Math.pow(10, inDecimals)) /
                          (parseFloat(quote.outAmount) / Math.pow(10, outDecimals))
                      : (parseFloat(quote.outAmount) / Math.pow(10, outDecimals)) /
                          (parseFloat(quote.inAmount) / Math.pow(10, inDecimals))
                  )}{" "}
                  USDC
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Price Impact</span>
                <span
                  className={`font-mono ${parseFloat(quote.priceImpactPct) > 1 ? "text-red-500" : ""}`}
                >
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
              status === "signing" ||
              status === "confirming" ||
              status === "quoting" ||
              (!quote && !!fromAmount)
            }
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-medium disabled:opacity-50"
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
            ) : (
              `Swap ${direction === "buy" ? "USDC" : toToken?.symbol || ""} → ${direction === "buy" ? toToken?.symbol || "" : "USDC"}`
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
