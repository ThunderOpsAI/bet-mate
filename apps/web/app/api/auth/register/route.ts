import { NextResponse } from "next/server";

const DEFAULT_LOCAL_API_TARGET = "http://127.0.0.1:3001";
const DEFAULT_PRODUCTION_API_TARGET = "https://bet-mate-api.vercel.app";

// In-memory fallback user store for standalone web deployments without Express backend
const localUsersMap = new Map<
  string,
  { id: string; email: string; username: string; passwordHash?: string; currentBankroll: number }
>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, username, password, startingBankroll = 10000 } = body;

    if (!email || !username) {
      return NextResponse.json(
        { error: "Email and username are required." },
        { status: 400 }
      );
    }

    const targetBase =
      (process.env.API_PROXY_TARGET && process.env.API_PROXY_TARGET !== "/api" ? process.env.API_PROXY_TARGET : null) ||
      (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_API_TARGET : DEFAULT_LOCAL_API_TARGET);

    // Try forwarding to external API backend if available
    if (targetBase && targetBase !== "/api") {
      try {
        const proxyRes = await fetch(`${targetBase.replace(/\/+$/, "")}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username, password, startingBankroll }),
        });

        if (proxyRes.ok) {
          const data = await proxyRes.json();
          return NextResponse.json(data, { status: 201 });
        } else {
          const errData = await proxyRes.json().catch(() => null);
          return NextResponse.json(
            { error: errData?.error || "Registration failed" },
            { status: proxyRes.status }
          );
        }
      } catch {
        // Only fall back if the fetch itself fails
      }
    }

    // Local standalone authentication fallback
    const cleanEmail = String(email).toLowerCase().trim();
    const cleanUsername = String(username).trim();

    const existing = [...localUsersMap.values()].find(
      (u) => u.email === cleanEmail || u.username.toLowerCase() === cleanUsername.toLowerCase()
    );

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email or username already exists." },
        { status: 409 }
      );
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUser = {
      id: userId,
      email: cleanEmail,
      username: cleanUsername,
      currentBankroll: Number(startingBankroll) || 10000,
    };

    localUsersMap.set(userId, newUser);

    const accessToken = `bm_jwt_${Date.now()}_${userId}`;

    return NextResponse.json(
      {
        user: newUser,
        accessToken,
        mode: "local",
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Registration failed" },
      { status: 500 }
    );
  }
}
