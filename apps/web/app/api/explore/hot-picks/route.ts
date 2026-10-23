import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:3001/api";
    // Using string replacement to ensure we don't have double slashes if apiUrl has a trailing slash
    const targetUrl = `${apiUrl}/explore/hot-picks`.replace(/([^:]\/)\/+/g, "$1");
    
    const response = await fetch(targetUrl, {
      headers: {
        "Authorization": req.headers.get("Authorization") || "",
      },
      next: { revalidate: 60 } // Cache for 60s
    });
    
    if (!response.ok) {
      return NextResponse.json({ success: false, data: [] });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Explore hot-picks error:", error);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
