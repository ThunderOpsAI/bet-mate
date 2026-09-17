import { NextRequest, NextResponse } from "next/server";

const DEFAULT_LOCAL_API_TARGET = "http://127.0.0.1:3001";
const DEFAULT_PRODUCTION_API_TARGET = "https://bet-mate-api.vercel.app";

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("Authorization") || "";
    const targetBase =
      (process.env.API_PROXY_TARGET && process.env.API_PROXY_TARGET !== "/api" ? process.env.API_PROXY_TARGET : null) ||
      (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_API_TARGET : DEFAULT_LOCAL_API_TARGET);
    
    const response = await fetch(`${targetBase.replace(/\/+$/, "")}/api/blackbook`, {
      method: "GET",
      headers: {
        "Authorization": token,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data, { status: 200 });
    } else {
      const errData = await response.json().catch(() => null);
      return NextResponse.json(errData || { error: "Failed to fetch" }, { status: response.status });
    }
  } catch (error) {
    // mock fallback
    return NextResponse.json({ success: true, data: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = req.headers.get("Authorization") || "";
    const targetBase =
      (process.env.API_PROXY_TARGET && process.env.API_PROXY_TARGET !== "/api" ? process.env.API_PROXY_TARGET : null) ||
      (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_API_TARGET : DEFAULT_LOCAL_API_TARGET);
    
    const response = await fetch(`${targetBase.replace(/\/+$/, "")}/api/blackbook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } else {
      const errData = await response.json().catch(() => null);
      return NextResponse.json(errData || { error: "Failed to create" }, { status: response.status });
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to create record" }, { status: 500 });
  }
}
