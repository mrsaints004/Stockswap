"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatPrice } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart as LineChartIcon, TrendingUp, TrendingDown } from "lucide-react";
import type { PreStock } from "@/lib/types";

interface PriceChartProps {
  token: PreStock | null;
}

interface PricePoint {
  timestamp: number;
  price: number;
  label: string;
}

const TIME_RANGES = [
  { label: "1H", hours: 1 },
  { label: "24H", hours: 24 },
  { label: "7D", hours: 168 },
  { label: "30D", hours: 720 },
];

export function PriceChart({ token }: PriceChartProps) {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(24);

  useEffect(() => {
    if (!token) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Generate realistic-looking price data based on current price
    // In production, this would fetch from Birdeye, Jupiter, or DexScreener API
    const now = Date.now();
    const points: PricePoint[] = [];
    const numPoints = range <= 1 ? 60 : range <= 24 ? 96 : range <= 168 ? 168 : 360;
    const intervalMs = (range * 3600 * 1000) / numPoints;

    let price = token.tokenPrice;
    // Work backwards from current price with random walk
    const volatility = 0.002 + Math.random() * 0.008; // 0.2-1% per step

    // Generate backwards
    const pricesReverse: number[] = [price];
    for (let i = 1; i < numPoints; i++) {
      const change = (Math.random() - 0.48) * volatility * price;
      price = Math.max(price * 0.5, price - change);
      pricesReverse.push(price);
    }
    pricesReverse.reverse();

    for (let i = 0; i < numPoints; i++) {
      const ts = now - (numPoints - 1 - i) * intervalMs;
      const date = new Date(ts);
      let label: string;
      if (range <= 1) {
        label = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (range <= 24) {
        label = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (range <= 168) {
        label = date.toLocaleDateString([], { weekday: "short", hour: "2-digit" });
      } else {
        label = date.toLocaleDateString([], { month: "short", day: "numeric" });
      }

      points.push({
        timestamp: ts,
        price: pricesReverse[i],
        label,
      });
    }

    setData(points);
    setLoading(false);
  }, [token, range]);

  if (!token) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <LineChartIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a token to view its price chart</p>
        </CardContent>
      </Card>
    );
  }

  const firstPrice = data.length > 0 ? data[0].price : token.tokenPrice;
  const lastPrice = data.length > 0 ? data[data.length - 1].price : token.tokenPrice;
  const change = ((lastPrice - firstPrice) / firstPrice) * 100;
  const isPositive = change >= 0;
  const chartColor = isPositive ? "#10b981" : "#ef4444";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {token.symbol}
              <span className="text-muted-foreground font-normal text-sm">
                / USDC
              </span>
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold font-mono">
                {formatPrice(lastPrice)}
              </span>
              <Badge
                className={`text-xs ${
                  isPositive
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-red-500/10 text-red-600"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {isPositive ? "+" : ""}
                {change.toFixed(2)}%
              </Badge>
            </div>
          </div>
          <div className="flex gap-1">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.label}
                onClick={() => setRange(tr.hours)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  range === tr.hours
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        {loading ? (
          <Skeleton className="h-[200px] mx-4 rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#888", fontSize: 10 }}
                interval="preserveStartEnd"
                minTickGap={60}
              />
              <YAxis
                domain={["auto", "auto"]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#888", fontSize: 10 }}
                width={60}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as PricePoint;
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 shadow-lg">
                      <p className="text-xs text-muted-foreground">{d.label}</p>
                      <p className="font-mono font-medium">
                        {formatPrice(d.price)}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                strokeWidth={2}
                fill="url(#priceGradient)"
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: chartColor,
                  strokeWidth: 2,
                  fill: "var(--background)",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* Key metrics */}
        <div className="grid grid-cols-4 gap-2 px-4 pt-2">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Mark Price</p>
            <p className="text-xs font-mono">{formatPrice(token.markPrice)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Premium</p>
            <p
              className={`text-xs font-mono ${
                token.tokenPrice >= token.markPrice
                  ? "text-emerald-500"
                  : "text-red-500"
              }`}
            >
              {(
                ((token.tokenPrice - token.markPrice) / token.markPrice) *
                100
              ).toFixed(2)}
              %
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Valuation</p>
            <p className="text-xs font-mono">
              ${(token.impliedValuation / 1e9).toFixed(1)}B
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Supply</p>
            <p className="text-xs font-mono">
              {(token.supply / 1e6).toFixed(1)}M
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
