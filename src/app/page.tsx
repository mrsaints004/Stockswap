"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { StatsBar } from "@/components/stats-bar";
import { TokenList } from "@/components/token-list";
import { SwapPanel } from "@/components/swap-panel";
import { PoolCreator } from "@/components/pool-creator";
import { PriceChart } from "@/components/price-chart";
import { Portfolio } from "@/components/portfolio";
import { BasketBuilder } from "@/components/basket-builder";
import { DCAPanel } from "@/components/dca-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PreStock } from "@/lib/types";

export default function Home() {
  const [selectedToken, setSelectedToken] = useState<PreStock | null>(null);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {/* Hero section */}
        <section className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Trade Pre-IPO Stocks on Solana
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Discover, trade, and invest in tokenized pre-IPO stocks like SpaceX,
            Anthropic, and Stripe. Index baskets, DCA, portfolio tracking — all
            24/7, permissionless, on-chain.
          </p>
        </section>

        {/* Stats */}
        <section>
          <StatsBar />
        </section>

        {/* Price chart (shown when a token is selected) */}
        {selectedToken && (
          <section id="chart" className="scroll-mt-20">
            <PriceChart token={selectedToken} />
          </section>
        )}

        {/* Main content grid */}
        <section
          id="markets"
          className="scroll-mt-20 grid gap-6 lg:grid-cols-[1fr_400px]"
        >
          {/* Left: Markets table */}
          <div className="space-y-6">
            <TokenList onSelectToken={setSelectedToken} />
          </div>

          {/* Right: Action sidebar */}
          <div className="space-y-6 scroll-mt-20" id="swap">
            <div className="lg:sticky lg:top-20 space-y-4">
              <Tabs defaultValue="swap">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="swap" className="text-xs sm:text-sm">
                    Swap
                  </TabsTrigger>
                  <TabsTrigger value="basket" className="text-xs sm:text-sm">
                    Basket
                  </TabsTrigger>
                  <TabsTrigger value="dca" className="text-xs sm:text-sm">
                    DCA
                  </TabsTrigger>
                  <TabsTrigger value="pool" className="text-xs sm:text-sm">
                    Pool
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="swap" className="mt-3">
                  <SwapPanel selectedToken={selectedToken} />
                </TabsContent>
                <TabsContent value="basket" className="mt-3">
                  <BasketBuilder />
                </TabsContent>
                <TabsContent value="dca" className="mt-3">
                  <DCAPanel />
                </TabsContent>
                <TabsContent value="pool" className="mt-3">
                  <PoolCreator selectedToken={selectedToken} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </section>

        {/* Portfolio section */}
        <section id="portfolio" className="scroll-mt-20">
          <Portfolio />
        </section>

        {/* Footer */}
        <footer className="border-t pt-6 pb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Built for{" "}
              <span className="font-medium text-foreground">Stocklana</span>{" "}
              hackathon. Powered by{" "}
              <a
                href="https://prestocks.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-500 hover:underline"
              >
                PreStocks
              </a>
              ,{" "}
              <a
                href="https://meteora.ag"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Meteora
              </a>
              ,{" "}
              <a
                href="https://jup.ag"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-500 hover:underline"
              >
                Jupiter
              </a>
              {" & "}
              <a
                href="https://pyth.network"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:underline"
              >
                Pyth
              </a>
              .
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a
                href="https://solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                Solana
              </a>
              <a
                href="https://docs.meteora.ag/developer-guides/dbc"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                Meteora DBC
              </a>
              <a
                href="https://pyth.network"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                Pyth
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
