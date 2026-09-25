import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WalletProvider } from "@/components/providers/wallet-provider";
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
    "Discover, trade, and provide liquidity for tokenized pre-IPO stocks on Solana. Powered by PreStocks and Meteora DBC.",
  openGraph: {
    title: "StockSwap — Pre-IPO Stock Trading on Solana",
    description:
      "Trade tokenized pre-IPO stocks like SpaceX, Anthropic, and Stripe on Solana. 24/7. Permissionless.",
    type: "website",
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
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
