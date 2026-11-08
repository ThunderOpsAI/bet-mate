import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const apiUrl = process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const mlUrl = process.env.ML_API_PROXY_TARGET || process.env.ML_API_URL || "http://localhost:8000";

    // 1. Try Express backend API
    try {
      const expressRes = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/multis/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6000),
      });
      if (expressRes.ok) {
        const data = await expressRes.json();
        return NextResponse.json(data);
      }
    } catch {
      // Fall through to prediction engine directly
    }

    // 2. Direct prediction engine bridge fallback
    const mlRes = await fetch(`${mlUrl.replace(/\/+$/, "")}/api/multis/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (mlRes.ok) {
      const data = await mlRes.json();
      return NextResponse.json(data);
    }

    const errText = await mlRes.text();
    return NextResponse.json(
      { error: "Multi recommendation failed", details: errText },
      { status: mlRes.status }
    );
  } catch (error: any) {
    console.error("Multi recommend API route error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
