"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PythPriceFeed } from "@/lib/types";

interface PythData {
  feeds: PythPriceFeed[];
  feedMap: Record<string, { name: string; equity?: string; xstock?: string }>;
}

let cachedData: PythData | null = null;
let cachedError: string | null = null;
let cachedLoading = true;
let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

async function fetchPythData() {
  try {
    cachedLoading = true;
    emitChange();
    const res = await fetch("/api/pyth");
    if (!res.ok) throw new Error("Failed to fetch");
    const json = await res.json();
    cachedData = json;
    cachedError = null;
  } catch (err) {
    cachedError =
      err instanceof Error ? err.message : "Failed to fetch prices";
  } finally {
    cachedLoading = false;
    emitChange();
  }
}

let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  if (typeof window !== "undefined") {
    fetchPythData();
    setInterval(fetchPythData, 10000);
  }
}

export function usePythPrices() {
  ensureInitialized();

  const data = useSyncExternalStore(
    subscribe,
    () => cachedData,
    () => null as PythData | null
  );
  const loading = useSyncExternalStore(
    subscribe,
    () => cachedLoading,
    () => true
  );
  const error = useSyncExternalStore(
    subscribe,
    () => cachedError,
    () => null as string | null
  );

  const getPriceForFeedId = useCallback(
    (feedId: string): number | null => {
      if (!data) return null;
      const feed = data.feeds.find(
        (f) => f.id === feedId || `0x${f.id}` === feedId
      );
      if (!feed) return null;
      const price = parseFloat(feed.price.price);
      const expo = feed.price.expo;
      return price * Math.pow(10, expo);
    },
    [data]
  );

  const getPricesForSymbol = useCallback(
    (
      symbol: string
    ): { equityPrice: number | null; xstockPrice: number | null } => {
      if (!data) return { equityPrice: null, xstockPrice: null };
      const feedIds = data.feedMap[symbol];
      if (!feedIds) return { equityPrice: null, xstockPrice: null };

      return {
        equityPrice: feedIds.equity ? getPriceForFeedId(feedIds.equity) : null,
        xstockPrice: feedIds.xstock ? getPriceForFeedId(feedIds.xstock) : null,
      };
    },
    [data, getPriceForFeedId]
  );

  return { data, loading, error, getPricesForSymbol, refetch: fetchPythData };
}
