"use client";

import { useSyncExternalStore } from "react";
import type { PreStock } from "@/lib/types";

let cachedStocks: PreStock[] = [];
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
    cachedError = err instanceof Error ? err.message : "Failed to fetch stocks";
  } finally {
    cachedLoading = false;
    emitChange();
  }
}

// Initial fetch + polling
let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  if (typeof window !== "undefined") {
    fetchStocksData();
    setInterval(fetchStocksData, 30000);
  }
}

export function usePreStocks() {
  ensureInitialized();

  const stocks = useSyncExternalStore(
    subscribe,
    () => cachedStocks,
    () => [] as PreStock[]
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

  return { stocks, loading, error, refetch: fetchStocksData };
}
