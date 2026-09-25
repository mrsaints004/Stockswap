# StockSwap

Trade tokenized pre-IPO stocks on Solana. Swap, build index baskets, set up recurring buys, and track your portfolio — all on-chain, 24/7, permissionless.

Built for the [Stocklana hackathon](https://hackathons.solana.com).

## What it does

StockSwap gives retail users a single interface to interact with pre-IPO stock tokens on Solana:

- **Swap** — Buy/sell stock tokens against USDC via Jupiter aggregator with real-time quotes
- **Index Basket** — Build a custom portfolio of multiple stocks and buy them in one click
- **Recurring Buy (DCA)** — Dollar-cost average into any stock token on a schedule
- **Portfolio** — Track holdings, allocation percentages, and premium vs. mark price
- **Price Charts** — View token price action with 1H/24H/7D/30D timeframes
- **DBC Pool Creator** — Create Meteora Dynamic Bonding Curve liquidity pools for stock tokens
- **Pyth Oracle** — Live oracle price feeds from Pyth Network shown alongside market prices

## Tech stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Charts**: Recharts
- **Blockchain**: Solana (mainnet), @solana/web3.js, Wallet Adapter
- **DEX**: Jupiter Aggregator (quotes + swaps)
- **Liquidity**: Meteora Dynamic Bonding Curve SDK
- **Oracle**: Pyth Network (Hermes REST API)
- **Data**: PreStocks API (tokenized pre-IPO stock metadata)

## Setup

```bash
git clone https://github.com/mrsaints004/Stockswap.git
cd Stockswap/stockswap
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_PYTH_API_KEY=YOUR_PYTH_KEY
```

Get keys:
- Helius (free): https://dev.helius.xyz
- Pyth (free): https://www.pyth.network/developers

```bash
npm run dev
```

Open http://localhost:3000.

## Project structure

```
src/
  app/
    page.tsx              # Main page layout
    layout.tsx            # Root layout, wallet provider, toasts
    api/prestocks/        # Server-side proxy for PreStocks API
  components/
    header.tsx            # Navigation + wallet connect
    token-list.tsx        # Markets table with Pyth oracle prices
    swap-panel.tsx        # Token swap via Jupiter
    basket-builder.tsx    # Index basket builder
    dca-panel.tsx         # Recurring buy / DCA
    portfolio.tsx         # Wallet holdings tracker
    price-chart.tsx       # Token price charts
    pool-creator.tsx      # Meteora DBC pool creation
    stats-bar.tsx         # Dashboard metrics
    providers/            # Solana wallet provider
    ui/                   # shadcn/ui components
  hooks/
    use-prestocks.ts      # PreStocks data fetching + polling
    use-pyth-prices.ts    # Pyth oracle price feeds
    use-token-balances.ts # Wallet token balance tracking
  lib/
    jupiter.ts            # Jupiter API integration
    meteora.ts            # Meteora DBC SDK integration
    types.ts              # TypeScript interfaces
    format.ts             # Number/price formatting
```

Full technical documentation: [DOCUMENTATION.md](./DOCUMENTATION.md)

## License

MIT
