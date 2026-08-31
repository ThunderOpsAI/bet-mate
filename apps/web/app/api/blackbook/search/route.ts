import { NextRequest, NextResponse } from "next/server";

const DEFAULT_LOCAL_ML_TARGET = "http://127.0.0.1:8000";
const DEFAULT_PRODUCTION_ML_TARGET = "https://thunderops-ai--betmate-prediction-engine-web.modal.run";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";

  try {
    const mlApiUrl =
      process.env.ML_API_URL ||
      process.env.ML_API_PROXY_TARGET ||
      (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_ML_TARGET : DEFAULT_LOCAL_ML_TARGET);
    const response = await fetch(`${mlApiUrl.replace(/\/+$/, "")}/blackbook/search?q=${encodeURIComponent(q)}`, {
      headers: {
        "Authorization": req.headers.get("Authorization") || "",
      }
    });
    
    if (!response.ok) {
      throw new Error("Search failed");
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Blackbook search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
