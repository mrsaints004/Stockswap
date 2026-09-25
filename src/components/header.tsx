"use client";

import dynamic from "next/dynamic";
import { TrendingUp } from "lucide-react";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            StockSwap
          </span>
          <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
            Stocklana
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <a href="#markets" className="hover:text-foreground transition-colors scroll-smooth">
            Markets
          </a>
          <a href="#swap" className="hover:text-foreground transition-colors scroll-smooth">
            Swap
          </a>
          <a href="#prices" className="hover:text-foreground transition-colors scroll-smooth">
            Price Feeds
          </a>
        </nav>

        <WalletMultiButton
          style={{
            backgroundColor: "rgb(16 185 129)",
            height: "40px",
            borderRadius: "0.5rem",
            fontSize: "14px",
            fontWeight: 500,
          }}
        />
      </div>
    </header>
  );
}
