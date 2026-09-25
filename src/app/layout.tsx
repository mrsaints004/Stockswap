import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WalletProvider } from "@/components/providers/wallet-provider";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StockSwap — Pre-IPO Stock Trading on Solana",
  description:
    "Discover, trade, and provide liquidity for tokenized pre-IPO stocks on Solana. Build index baskets, DCA into pre-IPO stocks, and track your portfolio. Powered by PreStocks, Meteora DBC, Jupiter, and Pyth.",
  keywords: [
    "Solana",
    "pre-IPO",
    "stock trading",
    "tokenized stocks",
    "DeFi",
    "PreStocks",
    "Meteora",
    "Jupiter",
    "Pyth",
    "StockSwap",
    "index basket",
    "DCA",
  ],
  openGraph: {
    title: "StockSwap — Pre-IPO Stock Trading on Solana",
    description:
      "Trade tokenized pre-IPO stocks like SpaceX, Anthropic, and Stripe on Solana. Build custom index baskets, DCA, and track your portfolio. 24/7. Permissionless.",
    type: "website",
    siteName: "StockSwap",
  },
  twitter: {
    card: "summary_large_image",
    title: "StockSwap — Pre-IPO Stock Trading on Solana",
    description:
      "Trade tokenized pre-IPO stocks on Solana. Index baskets, DCA, portfolio tracking. 24/7. Permissionless.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark antialiased scroll-smooth`}
    >
      <body className="min-h-screen bg-background font-sans">
        <WalletProvider>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            richColors
            closeButton
          />
        </WalletProvider>
      </body>
    </html>
  );
}
