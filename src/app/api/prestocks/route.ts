import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://prestocks.com/api/prestocks", {
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch PreStocks data" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch PreStocks data" },
      { status: 500 }
    );
  }
}
