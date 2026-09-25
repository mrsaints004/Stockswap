"use client";

import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePreStocks } from "@/hooks/use-prestocks";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { formatPrice, formatValuation } from "@/lib/format";
import { USDC_MINT } from "@/lib/jupiter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  PieChart,
  Wallet,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

export function Portfolio() {
  const { connected, publicKey } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const { stocks } = usePreStocks();
  const allMints = stocks.map((s) => s.contract_address);
  const { balances, loading, refetch } = useTokenBalances(allMints);

  if (!connected) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">
            Connect your wallet to view your portfolio
          </p>
          <Button
            onClick={() => openWalletModal(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            Connect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Build holdings
  const holdings = stocks
    .map((stock) => {
      const bal = balances.get(stock.contract_address)?.balance ?? 0;
      return {
        token: stock,
        balance: bal,
        value: bal * stock.tokenPrice,
        premium:
          ((stock.tokenPrice - stock.markPrice) / stock.markPrice) * 100,
      };
    })
    .filter((h) => h.balance > 0)
    .sort((a, b) => b.value - a.value);

  const usdcBal = balances.get(USDC_MINT)?.balance ?? 0;
  const solBal = balances.get("SOL")?.balance ?? 0;
  const totalStockValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const totalValue = totalStockValue + usdcBal;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <PieChart className="h-5 w-5 text-emerald-500" />
            Portfolio
          </CardTitle>
          <button
            onClick={refetch}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {publicKey?.toBase58()}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Portfolio summary */}
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Total Portfolio</p>
            <p className="text-2xl font-bold font-mono">
              {formatPrice(totalValue)}
            </p>
          </div>
          <Separator />
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Stocks</p>
              <p className="font-mono font-medium text-sm">
                {formatPrice(totalStockValue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">USDC</p>
              <p className="font-mono font-medium text-sm">
                ${usdcBal.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">SOL</p>
              <p className="font-mono font-medium text-sm">
                {solBal.toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        {/* Holdings list */}
        {holdings.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            <p>No stock token holdings found</p>
            <p className="text-xs mt-1">
              Buy pre-IPO tokens in the Swap tab to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Holdings ({holdings.length})
            </div>
            {holdings.map((h) => {
              const alloc =
                totalValue > 0 ? (h.value / totalValue) * 100 : 0;
              return (
                <div
                  key={h.token.contract_address}
                  className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/30 transition-colors"
                >
                  <Image
                    src={h.token.image}
                    alt={h.token.symbol}
                    width={32}
                    height={32}
                    className="rounded-full"
                    unoptimized
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {h.token.symbol}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {alloc.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {h.balance.toFixed(4)} tokens
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-medium">
                      {formatPrice(h.value)}
                    </div>
                    <div
                      className={`flex items-center justify-end gap-0.5 text-xs ${
                        h.premium >= 0 ? "text-emerald-500" : "text-red-500"
                      }`}
                    >
                      {h.premium >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {h.premium >= 0 ? "+" : ""}
                      {h.premium.toFixed(2)}% vs mark
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View on explorer */}
        {publicKey && (
          <a
            href={`https://solscan.io/account/${publicKey.toBase58()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View on Solscan <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
