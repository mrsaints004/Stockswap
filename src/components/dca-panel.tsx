"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePreStocks } from "@/hooks/use-prestocks";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { formatPrice } from "@/lib/format";
import { USDC_MINT } from "@/lib/jupiter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Timer,
  Wallet,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Info,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import type { PreStock } from "@/lib/types";

const FREQUENCY_OPTIONS = [
  { label: "Every minute", value: 60, description: "Test frequency" },
  { label: "Hourly", value: 3600, description: "24 buys per day" },
  { label: "Daily", value: 86400, description: "Recommended" },
  { label: "Weekly", value: 604800, description: "Lower frequency" },
];

type DCAStatus = "idle" | "creating" | "success" | "error";

export function DCAPanel() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible: openWalletModal } = useWalletModal();
  const { stocks } = usePreStocks();
  const allMints = stocks.map((s) => s.contract_address);
  const { balances } = useTokenBalances(allMints);

  const [selectedToken, setSelectedToken] = useState<PreStock | null>(null);
  const [showTokenSelect, setShowTokenSelect] = useState(false);
  const [totalAmount, setTotalAmount] = useState("100");
  const [numOrders, setNumOrders] = useState("10");
  const [frequency, setFrequency] = useState(86400);
  const [status, setStatus] = useState<DCAStatus>("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = selectedToken ?? stocks[0] ?? null;
  const usdcBalance = balances.get(USDC_MINT)?.balance ?? 0;
  const total = parseFloat(totalAmount) || 0;
  const orders = parseInt(numOrders) || 0;
  const perOrder = orders > 0 ? total / orders : 0;
  const totalDuration = orders * frequency;

  const formatDuration = (seconds: number) => {
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
    if (seconds < 604800) return `${Math.round(seconds / 86400)} days`;
    return `${Math.round(seconds / 604800)} weeks`;
  };

  const handleCreateDCA = useCallback(async () => {
    if (!connected || !publicKey || !signTransaction || !token) return;
    if (total <= 0 || orders <= 0) return;

    setStatus("creating");
    setError(null);

    try {
      // Execute first DCA order immediately via Jupiter swap
      const {
        getQuote: getQ,
        getSwapTransaction: getSwapTx,
        executeSwap,
      } = await import("@/lib/jupiter");

      const rawAmount = Math.floor(perOrder * 1e6);
      const quote = await getQ(USDC_MINT, token.contract_address, rawAmount);
      const { swapTransaction } = await getSwapTx(
        quote,
        publicKey.toBase58()
      );
      const txid = await executeSwap(connection, swapTransaction, signTransaction);

      setTxSignature(txid);
      setStatus("success");

      // Store DCA schedule in localStorage for display
      const dcaOrders = JSON.parse(
        localStorage.getItem("stockswap_dca_orders") || "[]"
      );
      dcaOrders.push({
        id: `dca-${Date.now()}`,
        inputMint: USDC_MINT,
        outputMint: token.contract_address,
        outputSymbol: token.symbol,
        totalAmount: total,
        amountPerCycle: perOrder,
        cycleFrequency: frequency,
        totalCycles: orders,
        completedCycles: 1,
        status: "active",
        createdAt: Date.now(),
        firstTxId: txid,
      });
      localStorage.setItem(
        "stockswap_dca_orders",
        JSON.stringify(dcaOrders)
      );

      toast.success("DCA order created!", {
        description: `First buy of $${perOrder.toFixed(2)} executed. ${orders - 1} more scheduled.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create DCA";
      setError(msg);
      setStatus("error");
      toast.error("DCA creation failed", { description: msg });
    }
  }, [
    connected,
    publicKey,
    signTransaction,
    token,
    total,
    orders,
    perOrder,
    frequency,
    connection,
  ]);

  const resetStatus = () => {
    setStatus("idle");
    setError(null);
    setTxSignature(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <Timer className="h-5 w-5 text-emerald-500" />
          Recurring Buy (DCA)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Dollar-cost average into pre-IPO stocks automatically
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Success banner */}
        {status === "success" && txSignature && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              DCA order created!
            </div>
            <p className="text-xs text-muted-foreground">
              First buy executed. Remaining orders: {orders - 1}
            </p>
            <a
              href={`https://solscan.io/tx/${txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:underline"
            >
              View first buy <ExternalLink className="h-3 w-3" />
            </a>
            <button
              onClick={resetStatus}
              className="block text-xs text-muted-foreground hover:text-foreground mt-1"
            >
              Create another
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

        {/* Token selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Buy Token</label>
          <div className="relative">
            <button
              onClick={() => setShowTokenSelect(!showTokenSelect)}
              className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 hover:bg-muted/50 text-left"
            >
              {token ? (
                <>
                  <Image
                    src={token.image}
                    alt={token.symbol}
                    width={28}
                    height={28}
                    className="rounded-full"
                    unoptimized
                  />
                  <div className="flex-1">
                    <div className="font-medium">{token.symbol}</div>
                    <div className="text-xs text-muted-foreground">
                      {token.name}
                    </div>
                  </div>
                  <div className="text-sm font-mono text-muted-foreground">
                    {formatPrice(token.tokenPrice)}
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">Select a token...</span>
              )}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {showTokenSelect && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border bg-background shadow-lg max-h-48 overflow-y-auto">
                {stocks.map((stock) => (
                  <button
                    key={stock.contract_address}
                    onClick={() => {
                      setSelectedToken(stock);
                      setShowTokenSelect(false);
                    }}
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

        <Separator />

        {/* Total amount */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Total Amount (USDC)
          </label>
          <Input
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="100"
            className="font-mono"
          />
          {connected && (
            <p className="text-xs text-muted-foreground mt-1">
              Available: {usdcBalance.toFixed(2)} USDC
            </p>
          )}
        </div>

        {/* Number of orders */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Number of Orders
          </label>
          <Input
            type="number"
            value={numOrders}
            onChange={(e) => setNumOrders(e.target.value)}
            placeholder="10"
            className="font-mono"
            min="2"
            max="100"
          />
        </div>

        {/* Frequency */}
        <div>
          <label className="text-sm font-medium mb-2 block">Frequency</label>
          <div className="grid grid-cols-2 gap-2">
            {FREQUENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFrequency(opt.value)}
                className={`rounded-xl border p-2.5 text-left transition-colors ${
                  frequency === opt.value
                    ? "border-emerald-500 bg-emerald-500/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-[10px] text-muted-foreground">
                  {opt.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Summary */}
        {total > 0 && orders > 0 && (
          <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarClock className="h-4 w-4 text-emerald-500" />
              DCA Summary
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Per order</div>
              <div className="font-mono text-right">
                ${perOrder.toFixed(2)} USDC
              </div>
              <div className="text-muted-foreground">Total orders</div>
              <div className="font-mono text-right">{orders}</div>
              <div className="text-muted-foreground">Duration</div>
              <div className="font-mono text-right">
                {formatDuration(totalDuration)}
              </div>
              <div className="text-muted-foreground">Est. tokens/order</div>
              <div className="font-mono text-right">
                {token
                  ? `~${(perOrder / token.tokenPrice).toFixed(4)} ${token.symbol}`
                  : "—"}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <Info className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            The first buy executes immediately via Jupiter. Your DCA schedule
            is saved and displayed below. Return to execute each subsequent
            order on schedule.
          </p>
        </div>

        {/* Create button */}
        {!connected ? (
          <Button
            onClick={() => openWalletModal(true)}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-medium"
          >
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet
          </Button>
        ) : (
          <Button
            onClick={handleCreateDCA}
            disabled={
              !token ||
              total <= 0 ||
              orders < 2 ||
              total > usdcBalance ||
              status === "creating"
            }
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-medium disabled:opacity-50"
          >
            {status === "creating" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating DCA order...
              </>
            ) : (
              `Start DCA — $${perOrder.toFixed(2)}/order`
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
