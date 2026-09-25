"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { USDC_MINT } from "@/lib/jupiter";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

export interface TokenBalance {
  mint: string;
  balance: number;
  decimals: number;
}

// Module-level cache to prevent duplicate fetches across components
let lastFetchTime = 0;
let cachedResult: Map<string, TokenBalance> = new Map();
let fetchPromise: Promise<Map<string, TokenBalance>> | null = null;
let forceNextFetch = false;

const MIN_FETCH_INTERVAL = 15000; // 15 seconds minimum between fetches

export function useTokenBalances(mints: string[]) {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [balances, setBalances] = useState<Map<string, TokenBalance>>(
    new Map()
  );
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const walletKey = publicKey?.toBase58() ?? "";

  // Stabilize mints reference to prevent effect re-fires
  const mintsKey = useMemo(() => mints.sort().join(","), [mints]);

  const fetchBalances = useCallback(async () => {
    if (!publicKey || !connected) {
      setBalances(new Map());
      return;
    }

    const now = Date.now();

    // If another component just fetched, reuse the cached result (unless forced)
    if (!forceNextFetch && now - lastFetchTime < MIN_FETCH_INTERVAL && cachedResult.size > 0) {
      setBalances(cachedResult);
      return;
    }
    forceNextFetch = false;

    // If a fetch is already in progress, wait for it
    if (fetchPromise) {
      try {
        const result = await fetchPromise;
        setBalances(result);
      } catch {
        // ignore
      }
      return;
    }

    setLoading(true);

    const doFetch = async (): Promise<Map<string, TokenBalance>> => {
      const newBalances = new Map<string, TokenBalance>();

      // Fetch all token accounts in a single RPC call
      const accounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      for (const { account } of accounts.value) {
        const parsed = account.data.parsed.info;
        const mint = parsed.mint as string;
        newBalances.set(mint, {
          mint,
          balance: parsed.tokenAmount.uiAmount ?? 0,
          decimals: parsed.tokenAmount.decimals,
        });
      }

      // Ensure USDC entry exists even if zero
      if (!newBalances.has(USDC_MINT)) {
        newBalances.set(USDC_MINT, {
          mint: USDC_MINT,
          balance: 0,
          decimals: 6,
        });
      }

      // Also fetch SOL balance
      const solBalance = await connection.getBalance(publicKey);
      newBalances.set("SOL", {
        mint: "SOL",
        balance: solBalance / 1e9,
        decimals: 9,
      });

      return newBalances;
    };

    fetchPromise = doFetch();

    try {
      const result = await fetchPromise;
      cachedResult = result;
      lastFetchTime = Date.now();
      setBalances(result);
    } catch {
      // Silently fail — balances are informational
    } finally {
      fetchPromise = null;
      setLoading(false);
    }
  }, [publicKey, connected, connection, walletKey]);

  useEffect(() => {
    if (!publicKey || !connected) {
      setBalances(new Map());
      return;
    }

    fetchBalances();
    intervalRef.current = setInterval(fetchBalances, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [walletKey, connected, fetchBalances]);

  const forceRefetch = useCallback(() => {
    forceNextFetch = true;
    fetchBalances();
  }, [fetchBalances]);

  return { balances, loading, refetch: forceRefetch };
}
