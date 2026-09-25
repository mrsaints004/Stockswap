"use client";

import { useCallback } from "react";
import dynamic from "next/dynamic";
import { TrendingUp } from "lucide-react";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

const NAV_LINKS = [
  { label: "Markets", target: "markets" },
  { label: "Trade", target: "swap" },
  { label: "Portfolio", target: "portfolio" },
];

export function Header() {
  const scrollTo = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;

    const headerHeight = 80; // sticky header + some breathing room
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight;

    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            StockSwap
          </span>
          <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
            Stocklana
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          {NAV_LINKS.map((link) => (
            <a
              key={link.target}
              href={`#${link.target}`}
              onClick={(e) => scrollTo(e, link.target)}
              className="hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <WalletMultiButton
          style={{
            backgroundColor: "rgb(16 185 129)",
            height: "40px",
            borderRadius: "0.5rem",
            fontSize: "14px",
            fontWeight: 500,
          }}
        />
      </div>
    </header>
  );
}
