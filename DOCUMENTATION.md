# StockSwap — Technical Documentation

## Overview

StockSwap is a web application for trading tokenized pre-IPO stocks on the Solana blockchain. It connects to existing Solana DeFi infrastructure (Jupiter, Meteora, Pyth) to provide a unified interface for discovering, buying, selling, and managing pre-IPO stock tokens.

The core problem: pre-IPO stock tokens exist on Solana via providers like PreStocks, but there's no single app that lets a user discover them, trade them, build portfolios around them, and set up automated strategies — all without leaving one interface.

---

## Architecture

### Data flow

```
PreStocks API ──> /api/prestocks (Next.js route) ──> usePreStocks hook ──> UI
                                                                          │
Pyth Hermes ──────────────────────> usePythPrices hook ──────────────────>│
                                                                          │
Solana RPC ──────────────────────> useTokenBalances hook ────────────────>│
                                                                          │
Jupiter API ──────────────────────> jupiter.ts (getQuote/getSwap) ──────>│
                                                                          │
Meteora SDK ──────────────────────> meteora.ts (createDbcPool) ─────────>│
```

### Server-side

Only one server route: `GET /api/prestocks`. This is a thin proxy to `https://prestocks.com/api/prestocks` with 30-second cache (Next.js ISR). The proxy exists to avoid CORS issues when calling PreStocks from the browser.

Everything else runs client-side. Wallet signing, Jupiter quotes, Pyth prices, Meteora pool creation — all happen in the browser.

### Client-side state

No global state manager (Redux, Zustand, etc.). State is managed with:

- **`usePreStocks()`** — Singleton external store via `useSyncExternalStore`. Fetches stock metadata from `/api/prestocks`, polls every 30s. Shared across all components that need stock data.
- **`usePythPrices(symbols)`** — Fetches oracle prices from Pyth Hermes REST API. Polls every 60s. Only fetches for symbols that have known Pyth feed IDs.
- **`useTokenBalances(mints)`** — Fetches wallet token balances via `getParsedTokenAccountsByOwner`. Only polls when a wallet is connected. Polls every 30s.
- **Component-local state** — Each panel (Swap, Basket, DCA, Pool) manages its own form state, status, errors.

---

## Features

### 1. Markets Table (`token-list.tsx`)

Displays all PreStocks tokens in a sortable, searchable table.

**Data sources:**
- Token metadata (name, symbol, image, price, valuation) from PreStocks API
- Oracle prices from Pyth Network (when available)

**Columns:** Token name/symbol, on-chain price, mark price + oracle price, premium/discount badge, implied valuation, supply.

Clicking a row selects that token and populates it into the Swap panel and Price Chart.

### 2. Swap (`swap-panel.tsx` + `jupiter.ts`)

Buy or sell stock tokens against USDC using Jupiter aggregator.

**Flow:**
1. User enters amount, selects token, chooses direction (buy/sell)
2. After 500ms debounce, fetches a quote from Jupiter `/quote` endpoint
3. Displays: exchange rate, price impact, route, slippage, minimum received
4. User clicks Swap → fetches swap transaction from Jupiter `/swap` endpoint
5. Transaction is simulated first (`simulateTransaction`) to catch errors before spending SOL
6. User signs in wallet → transaction sent to Solana
7. Confirmation polled, balance refreshed, toast shown

**Slippage:** User-configurable (0.25%, 0.5%, 1%, 2%). Default 0.5%.

**Balance display:** Shows wallet balance for input/output tokens with MAX button.

**Price impact warning:** Button turns red and shows warning when price impact > 1%.

### 3. Index Basket (`basket-builder.tsx`)

Buy multiple stock tokens in a single session with custom allocation percentages.

**Preset baskets:**
- AI Leaders: OPENAI 40%, ANTHROPIC 35%, DATABRICKS 25%
- Tech Giants: SPACEX 40%, STRIPE 35%, CANVA 25%

Users can also build custom baskets by adding tokens and setting percentages. Total must equal 100%.

**Execution:** Swaps are executed sequentially (not batched into one transaction — Jupiter quotes are per-pair). Progress bar shows completion. Each swap result (success/fail) is shown inline.

### 4. Recurring Buy / DCA (`dca-panel.tsx`)

Dollar-cost averaging: spread a purchase over multiple orders at a set frequency.

**Configuration:**
- Token to buy
- Total USDC amount
- Number of orders (min 2)
- Frequency: every minute (testing), hourly, daily, weekly

**Execution:** First buy is executed immediately via Jupiter swap. DCA schedule is stored in localStorage for the UI to display. The remaining orders are intended to be executed via Jupiter's on-chain DCA program.

### 5. Portfolio (`portfolio.tsx`)

Shows the connected wallet's holdings of all PreStocks stock tokens.

**Displays:**
- Total portfolio value (stocks + USDC + SOL)
- Per-token: balance, USD value, allocation %, premium vs. mark price
- Link to view wallet on Solscan

Only renders when a wallet is connected.

### 6. Price Chart (`price-chart.tsx`)

Interactive area chart for the selected token.

**Time ranges:** 1H, 24H, 7D, 30D

**Metrics below chart:** Mark price, premium %, valuation, supply.

Note: Chart data is currently generated client-side using a random walk from the current price. In production, this would pull from Birdeye, DexScreener, or Jupiter's price history API.

### 7. DBC Pool Creator (`pool-creator.tsx` + `meteora.ts`)

Create Meteora Dynamic Bonding Curve liquidity pools for stock tokens.

**Curve presets:**
| Preset | Trade Fee | Migration Fee | Graduation |
|--------|-----------|---------------|------------|
| Conservative | 30 bps | 100 bps | $50,000 |
| Standard | 50 bps | 200 bps | $25,000 |
| Aggressive | 100 bps | 300 bps | $10,000 |

**Pool config:**
- Quote token: USDC (fixed)
- Fee schedule: Linear decay (starts at 2x trade fee, decays to 1x over 1 hour)
- Dynamic fee: Enabled
- Migration: Automatic to Meteora DAMM v2 at graduation threshold
- Liquidity: 100% permanently locked

**Execution:** Creates a config account (keypair-signed) + pool-with-first-buy in two transactions.

### 8. Pyth Oracle Integration (`use-pyth-prices.ts`)

Fetches real-time oracle prices from Pyth Network's Hermes API.

**Implementation:** Direct HTTP fetch to `hermes.pyth.network/v2/updates/price/latest` with Bearer token auth. No SDK (the HermesClient SDK has aggressive retry logic that causes 429 storms).

**Feed matching:** Hard-coded map of stock symbols to verified Pyth feed IDs. Only fetches for symbols with known feeds (AAPL, TSLA, AMZN, MSFT, GOOGL, META).

**Display:** Oracle prices shown in the markets table with a pulsing indicator.

---

## API Integrations

### PreStocks

- **Endpoint:** `https://prestocks.com/api/prestocks`
- **Method:** GET
- **Returns:** Array of `PreStock` objects (name, symbol, image, contract_address, markPrice, tokenPrice, impliedValuation, supply)
- **Rate limit:** None documented
- **Caching:** 30s server-side via Next.js ISR

### Jupiter Aggregator

- **Base URL:** `https://api.jup.ag/swap/v1`
- **Endpoints used:**
  - `GET /quote` — Get swap quote with route plan
  - `POST /swap` — Generate swap transaction
- **Also:** `https://api.jup.ag/price/v2` — Token price data

### Pyth Network (Hermes)

- **Base URL:** `https://hermes.pyth.network`
- **Endpoint:** `GET /v2/updates/price/latest?ids[]=<feedId>`
- **Auth:** `Authorization: Bearer <API_KEY>`

### Meteora

- **SDK:** `@meteora-ag/dynamic-bonding-curve-sdk`
- **Used for:** DBC pool creation with configurable curves

### Solana RPC

- **Primary:** Helius (via env var)
- **Fallback:** `https://api.mainnet-beta.solana.com`
- **Used for:** Transaction broadcast, balance queries, mint info, token accounts

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_HELIUS_RPC_URL` | Recommended | Helius RPC endpoint. Falls back to public Solana RPC (rate-limited). |
| `NEXT_PUBLIC_PYTH_API_KEY` | Optional | Pyth Hermes API key. Without it, oracle prices won't load. |
| `NEXT_PUBLIC_RPC_URL` | Optional | Alternative RPC URL. |

---

## Wallet Support

Supported wallets:
- Phantom (adapter)
- Solflare (auto-registers via Wallet Standard)
- Coinbase Wallet (adapter)
- Any wallet implementing the Solana Wallet Standard

Auto-connect is disabled to prevent "wallet not initialized" errors on page load.

---

## Build & Deploy

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

Set environment variables in Vercel dashboard.
