"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { StatsBar } from "@/components/stats-bar";
import { TokenList } from "@/components/token-list";
import { SwapPanel } from "@/components/swap-panel";
import { PoolCreator } from "@/components/pool-creator";
import { PriceFeeds } from "@/components/price-feeds";
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
            Discover and trade tokenized pre-IPO stocks like SpaceX, Anthropic,
            and Stripe. 24/7 markets, permissionless access, real-time Pyth
            price feeds.
          </p>
        </section>

        {/* Stats */}
        <section>
          <StatsBar />
        </section>

        {/* Main content grid */}
        <section id="markets" className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Left: Markets table */}
          <div className="space-y-6">
            <TokenList onSelectToken={setSelectedToken} />

            {/* Pyth Price Feeds */}
            <div id="prices">
              <PriceFeeds />
            </div>
          </div>

          {/* Right: Swap + Pool sidebar */}
          <div className="space-y-6" id="swap">
            <Tabs defaultValue="swap">
              <TabsList className="w-full">
                <TabsTrigger value="swap" className="flex-1">
                  Swap
                </TabsTrigger>
                <TabsTrigger value="pool" className="flex-1" id="pools">
                  Create Pool
                </TabsTrigger>
              </TabsList>
              <TabsContent value="swap" className="mt-3">
                <SwapPanel selectedToken={selectedToken} />
              </TabsContent>
              <TabsContent value="pool" className="mt-3">
                <PoolCreator selectedToken={selectedToken} />
              </TabsContent>
            </Tabs>
          </div>
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
              , and{" "}
              <a
                href="https://pyth.network"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-500 hover:underline"
              >
                Pyth Network
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
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
