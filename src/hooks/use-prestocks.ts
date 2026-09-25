"use client";

import { useSyncExternalStore, useCallback } from "react";
import type { PreStock } from "@/lib/types";

let cachedStocks: PreStock[] = [];
let cachedError: string | null = null;
let cachedLoading = true;
let listeners: Array<() => void> = [];
let pollTimer: ReturnType<typeof setInterval> | null = null;

// Stable references for server snapshots — must never change identity
const SERVER_STOCKS: PreStock[] = [];
const SERVER_LOADING = true;
const SERVER_ERROR: string | null = null;

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];

  // Start polling when first listener subscribes
  if (listeners.length === 1 && !pollTimer) {
    fetchStocksData();
    pollTimer = setInterval(fetchStocksData, 30000);
  }

  return () => {
    listeners = listeners.filter((l) => l !== listener);

    // Stop polling when no listeners remain
    if (listeners.length === 0 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}

async function fetchStocksData() {
  try {
    cachedLoading = true;
    emitChange();
    const res = await fetch("/api/prestocks");
    if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json();
    cachedStocks = data;
    cachedError = null;
  } catch (err) {
    cachedError =
      err instanceof Error ? err.message : "Failed to fetch stocks";
  } finally {
    cachedLoading = false;
    emitChange();
  }
}

export function usePreStocks() {
  const stocks = useSyncExternalStore(
    subscribe,
    () => cachedStocks,
    () => SERVER_STOCKS
  );
  const loading = useSyncExternalStore(
    subscribe,
    () => cachedLoading,
    () => SERVER_LOADING
  );
  const error = useSyncExternalStore(
    subscribe,
    () => cachedError,
    () => SERVER_ERROR
  );

  const refetch = useCallback(() => {
    fetchStocksData();
  }, []);

  return { stocks, loading, error, refetch };
}
