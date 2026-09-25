"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

export function useTokenBalances(mints: string[]) {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [balances, setBalances] = useState<Map<string, TokenBalance>>(
    new Map()
  );
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!publicKey || !connected) {
      setBalances(new Map());
      return;
    }

    setLoading(true);
    try {
      const newBalances = new Map<string, TokenBalance>();

      // Fetch all token accounts for the wallet in a single RPC call
      const accounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const mintSet = new Set(mints);
      mintSet.add(USDC_MINT);

      for (const { account } of accounts.value) {
        const parsed = account.data.parsed.info;
        const mint = parsed.mint as string;
        if (mintSet.has(mint)) {
          newBalances.set(mint, {
            mint,
            balance: parsed.tokenAmount.uiAmount ?? 0,
            decimals: parsed.tokenAmount.decimals,
          });
        }
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

      setBalances(newBalances);
    } catch {
      // Silently fail — balances are informational
    } finally {
      setLoading(false);
    }
  }, [publicKey, connected, connection, mints]);

  useEffect(() => {
    // Only start polling when wallet is actually connected
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
  }, [publicKey, connected, fetchBalances]);

  return { balances, loading, refetch: fetchBalances };
}
