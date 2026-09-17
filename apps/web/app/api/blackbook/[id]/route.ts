import { NextRequest, NextResponse } from "next/server";

const DEFAULT_LOCAL_API_TARGET = "http://127.0.0.1:3001";
const DEFAULT_PRODUCTION_API_TARGET = "https://bet-mate-api.vercel.app";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const token = req.headers.get("Authorization") || "";
    const targetBase =
      (process.env.API_PROXY_TARGET && process.env.API_PROXY_TARGET !== "/api" ? process.env.API_PROXY_TARGET : null) ||
      (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_API_TARGET : DEFAULT_LOCAL_API_TARGET);
    
    const response = await fetch(`${targetBase.replace(/\/+$/, "")}/api/blackbook/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
      },
      body: JSON.stringify(body),
    });

    let data = {};
    try {
      data = await response.json();
    } catch {}

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
  }
}
