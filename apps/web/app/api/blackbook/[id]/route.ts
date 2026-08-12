import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "../../../lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const token = req.headers.get("Authorization") || "";
    
    const response = await fetch(`${API_BASE}/blackbook/${id}`, {
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
