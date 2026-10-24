import { NextResponse } from "next/server";
import { localUsersMap, getTargetBase } from "../store";

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

    const targetBase = getTargetBase();

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
            {
              error: errData?.error || "Invalid credentials",
              requireConfirmation: errData?.requireConfirmation ?? false,
              email: errData?.email,
            },
            { status: proxyRes.status }
          );
        }
      } catch {
        // Only fall back if the fetch itself fails (e.g. ECONNREFUSED)
      }
    }

    // Local standalone authentication fallback
    const input = String(emailOrUsername).toLowerCase().trim();
    const existingUser = [...localUsersMap.values()].find(
      (u) => u.email === input || u.username.toLowerCase() === input
    );

    if (!existingUser) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!existingUser.emailConfirmed) {
      return NextResponse.json(
        {
          error: "Please confirm your email address before logging in. Check your inbox or click below to resend confirmation email.",
          requireConfirmation: true,
          email: existingUser.email,
        },
        { status: 403 }
      );
    }

    const accessToken = `bm_jwt_${Date.now()}_${existingUser.id}`;

    return NextResponse.json(
      {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          username: existingUser.username,
          currentBankroll: existingUser.currentBankroll,
          emailConfirmed: true,
        },
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
