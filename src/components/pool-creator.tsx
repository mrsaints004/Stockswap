"use client";

import { useState } from "react";
import Image from "next/image";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { usePreStocks } from "@/hooks/use-prestocks";
import { formatPrice } from "@/lib/format";
import { createDbcPool, CURVE_PRESETS } from "@/lib/meteora";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Droplets,
  Wallet,
  ChevronDown,
  Loader2,
  Settings2,
  Info,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type { PreStock } from "@/lib/types";

interface PoolCreatorProps {
  selectedToken?: PreStock | null;
}

type CreateStatus = "idle" | "creating" | "success" | "error";

export function PoolCreator({ selectedToken }: PoolCreatorProps) {
  const { connected, publicKey, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const { setVisible: openWalletModal } = useWalletModal();
  const { stocks } = usePreStocks();
  const [manualToken, setManualToken] = useState<PreStock | null>(null);
  const [showTokenSelect, setShowTokenSelect] = useState(false);
  const [curvePreset, setCurvePreset] = useState(0);
  const [initialLiquidity, setInitialLiquidity] = useState("1000");
  const [status, setStatus] = useState<CreateStatus>("idle");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derive active token: manual selection > parent prop > first stock
  const token = manualToken ?? selectedToken ?? stocks[0] ?? null;

  const preset = CURVE_PRESETS[curvePreset];

  const handleCreatePool = async () => {
    if (!connected || !publicKey || !signAllTransactions || !token) return;

    try {
      setStatus("creating");
      setError(null);

      const result = await createDbcPool(
        connection,
        publicKey,
        new PublicKey(token.contract_address),
        preset,
        parseFloat(initialLiquidity),
        signAllTransactions
      );

      const lastTx = result.txSignatures[result.txSignatures.length - 1];
      setTxSignature(lastTx);
      setStatus("success");
      toast.success("Pool created!", {
        action: {
          label: "View",
          onClick: () => window.open(`https://solscan.io/tx/${lastTx}`, "_blank"),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create pool";
      setError(msg);
      setStatus("error");
      toast.error("Pool creation failed", { description: msg });
    }
  };

  const resetStatus = () => {
    setStatus("idle");
    setError(null);
    setTxSignature(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <Droplets className="h-5 w-5 text-emerald-500" />
          Create DBC Pool
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Launch stock-paired liquidity via{" "}
          <a
            href="https://docs.meteora.ag/developer-guides/dbc"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-500 hover:underline"
          >
            Meteora Dynamic Bonding Curve
          </a>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Success banner */}
        {status === "success" && txSignature && (
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-sm text-emerald-600 font-medium">
                Pool created successfully!
              </span>
            </div>
            <a
              href={`https://solscan.io/tx/${txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:underline"
            >
              View transaction on Solscan <ExternalLink className="h-3 w-3" />
            </a>
            <button
              onClick={resetStatus}
              className="text-xs text-muted-foreground hover:text-foreground self-start"
            >
              Create another
            </button>
          </div>
        )}

        {/* Error banner */}
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

        {/* Token selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Stock Token</label>
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
                <span className="text-muted-foreground">
                  Select a token...
                </span>
              )}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {showTokenSelect && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border bg-background shadow-lg max-h-48 overflow-y-auto">
                {stocks.map((stock) => (
                  <button
                    key={stock.contract_address}
                    onClick={() => {
                      setManualToken(stock);
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
                    <span className="text-muted-foreground text-xs flex-1">
                      {stock.name}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {formatPrice(stock.tokenPrice)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quote token */}
        <div>
          <label className="text-sm font-medium mb-2 block">Quote Token</label>
          <div className="flex items-center gap-3 rounded-xl border px-4 py-3 bg-muted/30">
            <div className="h-7 w-7 rounded-full bg-muted-foreground flex items-center justify-center text-xs font-bold text-white">
              $
            </div>
            <div className="flex-1">
              <div className="font-medium">USDC</div>
              <div className="text-xs text-muted-foreground">USD Coin</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Curve presets */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Curve Configuration
          </label>
          <div className="grid gap-2">
            {CURVE_PRESETS.map((p, i) => (
              <button
                key={p.name}
                onClick={() => setCurvePreset(i)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  curvePreset === i
                    ? "border-emerald-500 bg-emerald-500/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{p.name}</span>
                  {curvePreset === i && (
                    <Badge className="bg-emerald-500/10 text-emerald-500 text-[10px]">
                      Selected
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Advanced settings toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {showAdvanced ? "Hide" : "Show"} advanced settings
        </button>

        {showAdvanced && (
          <div className="space-y-3 rounded-xl border p-3 bg-muted/20">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Info className="h-3 w-3" /> Trade Fee
              </span>
              <span className="font-mono">{preset.tradeFee} bps</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Migration Fee</span>
              <span className="font-mono">{preset.migrationFee} bps</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Graduation Threshold
              </span>
              <span className="font-mono">
                ${preset.graduationThreshold.toLocaleString()} USDC
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Migrates to</span>
              <span>Meteora DAMM v2</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Fee Schedule</span>
              <span>Linear decay (high → low)</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Dynamic Fee</span>
              <span className="text-emerald-500">Enabled</span>
            </div>
          </div>
        )}

        {/* Initial liquidity */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Initial Liquidity (USDC)
          </label>
          <Input
            type="number"
            value={initialLiquidity}
            onChange={(e) => setInitialLiquidity(e.target.value)}
            placeholder="1000"
            className="font-mono"
          />
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
            onClick={handleCreatePool}
            disabled={
              !token ||
              !initialLiquidity ||
              parseFloat(initialLiquidity) < 1 ||
              status === "creating"
            }
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-medium disabled:opacity-50"
          >
            {status === "creating" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Pool...
              </>
            ) : (
              `Create ${token?.symbol || ""}/USDC Pool`
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
