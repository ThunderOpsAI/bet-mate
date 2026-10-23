import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:3001/api";
    const targetUrl = `${apiUrl}/explore/value-plays`.replace(/([^:]\/)\/+/g, "$1");
    
    const response = await fetch(targetUrl, {
      headers: {
        "Authorization": req.headers.get("Authorization") || "",
      },
      next: { revalidate: 60 }
    });
    
    if (!response.ok) {
      return NextResponse.json({ success: false, data: [] });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Explore value-plays error:", error);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
