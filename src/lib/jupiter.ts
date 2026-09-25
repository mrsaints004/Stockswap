import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

const JUPITER_API = "https://api.jup.ag/swap/v1";

// USDC mint on mainnet
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const decimalsCache = new Map<string, number>();

export async function getMintDecimals(
  connection: Connection,
  mint: string
): Promise<number> {
  if (mint === USDC_MINT) return 6;
  const cached = decimalsCache.get(mint);
  if (cached !== undefined) return cached;

  const info = await connection.getParsedAccountInfo(new PublicKey(mint));
  const data = info.value?.data;
  if (!data || !("parsed" in data)) {
    throw new Error(`Could not fetch mint info for ${mint}`);
  }
  const decimals = data.parsed.info.decimals as number;
  decimalsCache.set(mint, decimals);
  return decimals;
}

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps = 50
): Promise<JupiterQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
  });

  const res = await fetch(`${JUPITER_API}/quote?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter quote failed: ${text}`);
  }
  return res.json();
}

export async function getSwapTransaction(
  quoteResponse: JupiterQuote,
  userPublicKey: string
): Promise<{
  swapTransaction: string;
  lastValidBlockHeight: number;
}> {
  const res = await fetch(`${JUPITER_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 1000000,
          priorityLevel: "medium",
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter swap failed: ${text}`);
  }
  return res.json();
}

export async function executeSwap(
  connection: Connection,
  swapTransaction: string,
  signTransaction: (
    tx: VersionedTransaction
  ) => Promise<VersionedTransaction>
): Promise<string> {
  const txBuf = Buffer.from(swapTransaction, "base64");
  const transaction = VersionedTransaction.deserialize(txBuf);

  // Simulate before sending to catch errors early and save SOL fees
  const simulation = await connection.simulateTransaction(transaction, {
    replaceRecentBlockhash: true,
    commitment: "confirmed",
  });
  if (simulation.value.err) {
    throw new Error(
      `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`
    );
  }

  const signed = await signTransaction(transaction);

  // Use the blockhash from the transaction itself to avoid mismatch
  const txMessage = transaction.message;
  const blockhash = txMessage.recentBlockhash;

  const txid = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  // Get the lastValidBlockHeight for this blockhash
  const blockheight = await connection.getLatestBlockhash("confirmed");

  await connection.confirmTransaction(
    {
      signature: txid,
      blockhash,
      lastValidBlockHeight: blockheight.lastValidBlockHeight,
    },
    "confirmed"
  );

  return txid;
}

// ── Wallet token balance helpers ──

export async function getTokenBalance(
  connection: Connection,
  walletAddress: PublicKey,
  mintAddress: string
): Promise<number> {
  try {
    const mint = new PublicKey(mintAddress);
    const accounts = await connection.getParsedTokenAccountsByOwner(
      walletAddress,
      { mint }
    );
    if (accounts.value.length === 0) return 0;
    const balance =
      accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return balance ?? 0;
  } catch {
    return 0;
  }
}

export async function getSolBalance(
  connection: Connection,
  walletAddress: PublicKey
): Promise<number> {
  try {
    const balance = await connection.getBalance(walletAddress);
    return balance / 1e9;
  } catch {
    return 0;
  }
}

// ── Jupiter Price API ──

export interface JupiterPriceData {
  id: string;
  type: string;
  price: string;
}

export async function getJupiterPrices(
  mints: string[]
): Promise<Record<string, JupiterPriceData>> {
  if (mints.length === 0) return {};
  const ids = mints.join(",");
  const res = await fetch(
    `https://api.jup.ag/price/v2?ids=${ids}&vsToken=${USDC_MINT}`
  );
  if (!res.ok) return {};
  const json = await res.json();
  return json.data ?? {};
}

// ── Jupiter DCA helpers ──

export const JUPITER_DCA_PROGRAM = "DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M";

export interface DCAParams {
  inputMint: string;
  outputMint: string;
  totalInAmount: number;
  inAmountPerCycle: number;
  cycleFrequency: number; // seconds
  minOutAmountPerCycle?: number;
  maxOutAmountPerCycle?: number;
}
