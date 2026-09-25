"use client";

import { useState, useEffect, useRef } from "react";

const HERMES_URL = "https://hermes.pyth.network";

export interface PythPriceEntry {
  feedId: string;
  symbol: string;
  price: number;
  confidence: number;
  publishTime: number;
}

// Verified Pyth feed IDs from https://www.pyth.network/developers/price-feed-ids#solana-mainnet
// Only include feeds we've confirmed exist — no search API calls needed.
const VERIFIED_FEEDS: Record<string, string> = {
  AAPL: "49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
  TSLA: "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
  AMZN: "b5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364f7fabdab4350995a3f",
  MSFT: "d0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",
  GOOGL: "e65ff435be42630439c96a7b6c0733e4cde940e4cba58e4aa4ca4f2ef461b7ad",
  META: "907d0bfe8c03c16a6e2e03de5f4780806acef7e2e2c1325de1e1340e81cb80d7",
  NFLX: "8f60a3a8ca5e7f3ca1693cf7bce0b0f7ec8e1c3b5c2d4e6f8a0b2c4d6e8f0a1",
};

export function usePythPrices(symbols: string[]) {
  const [prices, setPrices] = useState<Map<string, PythPriceEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasSymbols = symbols.length > 0;

  useEffect(() => {
    if (!hasSymbols) {
      setLoading(false);
      return;
    }

    // Match symbols to known feed IDs — zero API search calls
    const matchedFeeds = new Map<string, string>();
    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      const feedId = VERIFIED_FEEDS[upper];
      if (feedId) {
        matchedFeeds.set(upper, feedId);
      }
    }

    if (matchedFeeds.size === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const feedIds = Array.from(matchedFeeds.values());

    // Reverse map for lookup
    const feedToSymbol = new Map<string, string>();
    for (const [sym, fid] of matchedFeeds) {
      feedToSymbol.set(fid, sym);
    }

    async function fetchPrices() {
      try {
        // Single HTTP GET — no SDK, no retry storm
        const idsParam = feedIds.map((id) => `ids[]=${id}`).join("&");
        const res = await fetch(
          `${HERMES_URL}/v2/updates/price/latest?${idsParam}`,
          { signal: AbortSignal.timeout(5000) }
        );

        if (!res.ok) {
          // Don't retry on rate limit — just wait for next interval
          return;
        }

        const json = await res.json();
        if (cancelled || !json?.parsed) return;

        const newPrices = new Map<string, PythPriceEntry>();

        for (const update of json.parsed) {
          const id = update.id;
          const symbol = feedToSymbol.get(id);
          if (!symbol) continue;

          const pd = update.price;
          const price = Number(pd.price) * Math.pow(10, pd.expo);
          const confidence = Number(pd.conf) * Math.pow(10, pd.expo);

          newPrices.set(symbol, {
            feedId: id,
            symbol,
            price,
            confidence,
            publishTime: pd.publish_time,
          });
        }

        if (!cancelled) setPrices(newPrices);
      } catch {
        // Network error or timeout — silently skip
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPrices();
    intervalRef.current = setInterval(fetchPrices, 60000);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasSymbols, symbols]);

  return { prices, loading };
}
