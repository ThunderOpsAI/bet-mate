import { NextResponse } from "next/server";

const DEFAULT_LOCAL_API_TARGET = "http://127.0.0.1:3001";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { emailOrUsername, password } = body;

    if (!emailOrUsername) {
      return NextResponse.json(
        { error: "Email or username is required." },
        { status: 400 }
      );
    }

    const targetBase = process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || DEFAULT_LOCAL_API_TARGET;

    // Try forwarding to external API backend if available
    if (targetBase && targetBase !== "/api") {
      try {
        const proxyRes = await fetch(`${targetBase.replace(/\/+$/, "")}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailOrUsername, password }),
        });

        if (proxyRes.ok) {
          const data = await proxyRes.json();
          return NextResponse.json(data, { status: 200 });
        } else {
          const errData = await proxyRes.json().catch(() => null);
          return NextResponse.json(
            { error: errData?.error || "Invalid credentials" },
            { status: proxyRes.status }
          );
        }
      } catch {
        // Only fall back if the fetch itself fails (e.g. ECONNREFUSED)
      }
    }

    // Local standalone authentication fallback
    const input = String(emailOrUsername).toLowerCase().trim();
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const username = input.includes("@") ? input.split("@")[0] : input;

    const user = {
      id: userId,
      email: input.includes("@") ? input : `${input}@betmate.user`,
      username: username || "BetMateUser",
      currentBankroll: 10000,
    };

    const accessToken = `bm_jwt_${Date.now()}_${userId}`;

    return NextResponse.json(
      {
        user,
        accessToken,
        mode: "local",
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Login failed" },
      { status: 500 }
    );
  }
}
