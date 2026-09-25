export interface PreStock {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  contract_address: string;
  markPrice: number;
  markValuation: number;
  tokenPrice: number;
  impliedValuation: number;
  supply: number;
}

export interface BasketAllocation {
  token: PreStock;
  percentage: number;
}

export interface BasketConfig {
  name: string;
  allocations: BasketAllocation[];
  totalUsdc: number;
}

export interface PortfolioHolding {
  token: PreStock;
  balance: number;
  value: number;
  allocation: number; // percentage of total portfolio
}

export interface DCAOrder {
  id: string;
  inputMint: string;
  outputMint: string;
  totalAmount: number;
  amountPerCycle: number;
  cycleFrequency: number;
  remainingCycles: number;
  status: "active" | "completed" | "cancelled";
  createdAt: number;
}

export interface TransactionRecord {
  signature: string;
  type: "swap" | "pool_create" | "basket_buy" | "dca";
  timestamp: number;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  status: "confirmed" | "failed";
}
