import {
  Connection,
  Keypair,
  PublicKey,
  type VersionedTransaction,
  type Transaction,
} from "@solana/web3.js";
import { getMintDecimals } from "./jupiter";
import {
  DynamicBondingCurveClient,
  buildCurve,
  ActivationType,
  CollectFeeMode,
  MigrationOption,
  MigrationFeeOption,
  TokenDecimal,
  TokenType,
  BaseFeeMode,
  TokenAuthorityOption,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import BN from "bn.js";

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

export interface CurvePreset {
  name: string;
  description: string;
  tradeFee: number;
  migrationFee: number;
  graduationThreshold: number;
}

export const CURVE_PRESETS: CurvePreset[] = [
  {
    name: "Conservative",
    description: "Slow graduation, tight spreads — ideal for equity assets",
    tradeFee: 30,
    migrationFee: 100,
    graduationThreshold: 50000,
  },
  {
    name: "Standard",
    description: "Balanced fees and graduation speed",
    tradeFee: 50,
    migrationFee: 200,
    graduationThreshold: 25000,
  },
  {
    name: "Aggressive",
    description: "Fast graduation, higher fees — for high-volume tokens",
    tradeFee: 100,
    migrationFee: 300,
    graduationThreshold: 10000,
  },
];

export async function createDbcPool(
  connection: Connection,
  payer: PublicKey,
  stockMint: PublicKey,
  preset: CurvePreset,
  initialLiquidityUsdc: number,
  signAllTransactions: <T extends Transaction | VersionedTransaction>(
    txs: T[]
  ) => Promise<T[]>
): Promise<{ poolAddress: string; txSignatures: string[] }> {
  const client = new DynamicBondingCurveClient(connection, "confirmed");

  // Fetch actual token decimals from chain
  const baseDecimals = await getMintDecimals(
    connection,
    stockMint.toBase58()
  );
  const tokenDecimalMap: Record<number, TokenDecimal> = {
    6: TokenDecimal.SIX,
    7: TokenDecimal.SEVEN,
    8: TokenDecimal.EIGHT,
    9: TokenDecimal.NINE,
  };
  const tokenBaseDecimal = tokenDecimalMap[baseDecimals] ?? TokenDecimal.SIX;

  const curveConfig = buildCurve({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal,
      tokenQuoteDecimal: TokenDecimal.SIX,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: 1_000_000_000,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: preset.tradeFee * 2,
          endingFeeBps: preset.tradeFee,
          numberOfPeriod: 600,
          totalDuration: 3600,
        },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 0,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps100,
      migrationFee: {
        feePercentage: 1,
        creatorFeePercentage: 0,
      },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 100,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Slot,
    percentageSupplyOnMigration: 100,
    migrationQuoteThreshold: preset.graduationThreshold,
  });

  const partnerService = client.partner;
  const configKeypair = Keypair.generate();

  // Convert USDC to raw amount (6 decimals)
  const buyAmount = new BN(Math.floor(initialLiquidityUsdc * 1e6));

  const { createConfigTx, createPoolWithFirstBuyTx } =
    await partnerService.createConfigAndPoolWithFirstBuy({
      config: configKeypair.publicKey,
      feeClaimer: payer,
      leftoverReceiver: payer,
      quoteMint: USDC_MINT,
      payer,
      preCreatePoolParam: {
        name: "StockSwap Pool",
        symbol: "SSWP",
        uri: "",
        poolCreator: payer,
        baseMint: stockMint,
      },
      firstBuyParam: buyAmount.gtn(0)
        ? {
            buyer: payer,
            buyAmount,
            minimumAmountOut: new BN(0),
            referralTokenAccount: null,
          }
        : undefined,
      ...curveConfig,
    });

  const txs = [createConfigTx, createPoolWithFirstBuyTx].filter(Boolean);
  const signed = await signAllTransactions(txs);
  const signatures: string[] = [];

  for (const signedTx of signed) {
    const raw = signedTx.serialize();
    const sig = await connection.sendRawTransaction(
      raw instanceof Uint8Array ? raw : Buffer.from(raw),
      {
        skipPreflight: false,
        maxRetries: 3,
      }
    );
    signatures.push(sig);
  }

  if (signatures.length > 0) {
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      {
        signature: signatures[signatures.length - 1],
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "confirmed"
    );
  }

  return {
    poolAddress: signatures[signatures.length - 1] || "",
    txSignatures: signatures,
  };
}
