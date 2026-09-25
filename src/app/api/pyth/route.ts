import { NextResponse } from "next/server";

// Pyth price feed IDs — verified from hermes.pyth.network/v2/price_feeds
// Shows equity (market hours) vs xStock (24/7 crypto) feeds for arbitrage surface
const PYTH_FEED_IDS: Record<
  string,
  { name: string; equity?: string; xstock?: string }
> = {
  AAPL: {
    name: "Apple",
    equity:
      "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
    xstock:
      "0x978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675",
  },
  TSLA: {
    name: "Tesla",
    equity:
      "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
    xstock:
      "0x47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362",
  },
  GOOGL: {
    name: "Alphabet",
    equity:
      "0xe65ff435be2bc97da3f4bece2d42a06851bc4b7cd3eb9c1b14479c579b83c4c1",
    xstock:
      "0xb911b0329028cd0283e4259c33809d62942bd2716a58084e5f31d64c00b5424e",
  },
  AMZN: {
    name: "Amazon",
    equity:
      "0xb5d0e0fa58a1fbc8c864c166f0fc2ceadb2b2cb6a529fbe5b6d7fc3b8aa790e9",
    xstock:
      "0x7148fbe6e493ff2580305c92a8d7f8628c9943b11b9b253aebc24863fec290e8",
  },
  NVDA: {
    name: "NVIDIA",
    equity:
      "0x20ce806d0731e16a03e89787e08e3d1ad05daedc2c40e33b3a2e99d31e0dab77",
    xstock:
      "0x4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f",
  },
  META: {
    name: "Meta",
    equity:
      "0x5246474745e09e28a8b0bf60b4f67afb3cf7b0bea468d81f16db0413e4a8e600",
    xstock:
      "0xbf3e5871be3f80ab7a4d1f1fd039145179fb58569e159aee1ccd472868ea5900",
  },
  MSFT: {
    name: "Microsoft",
    equity:
      "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",
    xstock:
      "0xbb723a70af731ab56b9a650eb7e8ac22b7bc07ea77f8670bd1fa9a37bf6df3f5",
  },
};

export async function GET() {
  try {
    const allFeedIds: string[] = [];
    for (const feeds of Object.values(PYTH_FEED_IDS)) {
      if (feeds.equity) allFeedIds.push(feeds.equity);
      if (feeds.xstock) allFeedIds.push(feeds.xstock);
    }

    const params = allFeedIds.map((id) => `ids[]=${id}`).join("&");
    const res = await fetch(
      `https://hermes.pyth.network/v2/updates/price/latest?${params}`,
      { next: { revalidate: 10 } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch Pyth data" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      feeds: data.parsed || [],
      feedMap: PYTH_FEED_IDS,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch Pyth data" },
      { status: 500 }
    );
  }
}
