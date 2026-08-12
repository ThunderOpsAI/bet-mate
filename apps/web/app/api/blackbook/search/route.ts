import { NextRequest, NextResponse } from "next/server";
import { ML_API } from "../../../lib/mlApi";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    const mlApiUrl = process.env.ML_API_URL || "http://localhost:8000";
    const response = await fetch(`${mlApiUrl}/blackbook/search?q=${encodeURIComponent(q)}`, {
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
