# StockSwap — Documentation

## The Problem

Pre-IPO stock tokens exist on Solana through providers like PreStocks, but there is no unified application where users can discover these tokens, trade them, build diversified portfolios, and automate buying strategies — all in one place. Users currently have to jump between multiple tools and interfaces to do basic things like buying a pre-IPO token or tracking what they hold.

## What StockSwap Does

StockSwap is a single web app that brings together everything a retail user needs to trade tokenized pre-IPO stocks on Solana. It connects to real Solana DeFi infrastructure — Jupiter for swaps, Meteora for liquidity pools, and PreStocks for token data — so users can go from discovery to trade to portfolio management without leaving the app.

## How It Works

### Architecture

StockSwap is a Next.js 16 application that runs almost entirely client-side. The only server component is a thin API proxy that fetches token metadata from PreStocks (to avoid browser CORS issues). Everything else — wallet interaction, swap execution, balance tracking, pool creation — happens directly in the user's browser.

```
PreStocks API ──> /api/prestocks (Next.js proxy) ──> usePreStocks hook ──> UI
                                                                           │
Solana RPC ──────────────────────> useTokenBalances hook ─────────────────>│
                                                                           │
Jupiter API ──────────────────────> jupiter.ts (getQuote/getSwap) ────────>│
                                                                           │
Meteora SDK ──────────────────────> meteora.ts (createDbcPool) ──────────>│
```

### Client-side State

No global state manager (no Redux, no Zustand). State is managed with:

- **`usePreStocks()`** — Singleton external store via `useSyncExternalStore`. Fetches stock metadata from `/api/prestocks`, polls every 30 seconds. Shared across all components.
- **`useTokenBalances(mints)`** — Fetches wallet token balances via `getParsedTokenAccountsByOwner` for both the legacy Token Program and Token-2022 Program. Uses module-level caching with a 15-second minimum interval to prevent RPC rate limits. Only polls when a wallet is connected.
- **Component-local state** — Each panel (Swap, Basket, DCA, Pool) manages its own form state, status, and errors independently.

---

## Features

### 1. Markets Table

Displays all PreStocks tokens in a sortable, searchable table. Shows token name, symbol, on-chain price, mark price, premium/discount percentage, implied valuation, and supply. Clicking a row selects that token for the Swap panel and Price Chart.

### 2. Swap

Buy or sell stock tokens against USDC using Jupiter aggregator.

How it works:
1. User enters an amount, selects a token, and chooses buy or sell
2. After a 500ms debounce, a quote is fetched from Jupiter
3. The app displays the exchange rate, price impact, route, slippage, and minimum received
4. User clicks Swap — a swap transaction is fetched from Jupiter
5. The transaction is simulated first to catch errors before spending SOL
6. User signs in their wallet and the transaction is sent to Solana
7. Confirmation is polled, balance refreshes, and a toast notification appears

Slippage is user-configurable (0.25%, 0.5%, 1%, 2%) with a default of 0.5%. A price impact warning appears when impact exceeds 1%.

### 3. Index Basket

Buy multiple stock tokens in a single session with custom allocation percentages.

Comes with preset baskets:
- AI Leaders: OPENAI 40%, ANTHROPIC 35%, DATABRICKS 25%
- Tech Giants: SPACEX 40%, STRIPE 35%, CANVA 25%

Users can also build custom baskets by adding tokens and adjusting percentages (total must equal 100%). Swaps execute sequentially with a progress bar showing completion status. Each individual swap result is shown inline.

### 4. Recurring Buy (DCA)

Dollar-cost averaging: spread a purchase across multiple orders at a set frequency.

Configuration options:
- Token to buy
- Total USDC amount
- Number of orders (minimum 2)
- Frequency: every minute (for testing), hourly, daily, or weekly

The first buy executes immediately via Jupiter swap. The DCA schedule is saved and displayed in the app so the user can return to execute subsequent orders on schedule.

### 5. Portfolio

Shows the connected wallet's holdings of all PreStocks stock tokens.

Displays total portfolio value (stocks + USDC + SOL), per-token balance, USD value, allocation percentage, and premium vs. mark price. Supports both legacy SPL tokens and Token-2022 tokens. Includes a link to view the wallet on Solscan.

### 6. Price Chart

Interactive area chart for the selected token with time ranges: 1H, 24H, 7D, 30D. Shows mark price, premium percentage, valuation, and supply below the chart.

### 7. DBC Pool Creator

Create Meteora Dynamic Bonding Curve liquidity pools for stock tokens paired with USDC.

Three curve presets:
- Conservative: 30 bps trade fee, $50,000 graduation threshold
- Standard: 50 bps trade fee, $25,000 graduation threshold
- Aggressive: 100 bps trade fee, $10,000 graduation threshold

All pools use linear fee decay (starts at 2x trade fee, decays to 1x over one hour), dynamic fees enabled, and automatic migration to Meteora DAMM v2 at the graduation threshold. Liquidity is 100% permanently locked.

---

## API Integrations

### PreStocks
- Endpoint: `https://prestocks.com/api/prestocks`
- Returns token metadata: name, symbol, image, contract address, mark price, token price, implied valuation, supply
- Cached server-side for 30 seconds via Next.js ISR

### Jupiter Aggregator
- Base URL: `https://api.jup.ag/swap/v1`
- Used for swap quotes (`GET /quote`) and swap transaction generation (`POST /swap`)
- Also uses `https://api.jup.ag/price/v2` for token price data

### Meteora
- SDK: `@meteora-ag/dynamic-bonding-curve-sdk`
- Used for creating Dynamic Bonding Curve pools with configurable parameters

### Solana RPC
- Primary: Helius (configured via environment variable)
- Fallback: `https://api.mainnet-beta.solana.com`
- Used for transaction broadcast, balance queries, mint info, and token account lookups

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_HELIUS_RPC_URL` | Recommended | Helius RPC endpoint. Falls back to public Solana RPC if not set. |
| `NEXT_PUBLIC_RPC_URL` | Optional | Alternative RPC URL. |

---

## Wallet Support

Works with any Solana wallet:
- Phantom
- Solflare
- Coinbase Wallet
- Any wallet implementing the Solana Wallet Standard

---

## Build and Deploy

```bash
npm run dev      # Development server on localhost:3000
npm run build    # Production build
npm start        # Serve production build
npm run lint     # ESLint
```

Deploy to Vercel:
```bash
npx vercel --prod
```

Set environment variables in the Vercel dashboard.
