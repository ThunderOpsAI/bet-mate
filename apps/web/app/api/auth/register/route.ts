import { NextResponse } from "next/server";
import { localUsersMap, getTargetBase, sendWebConfirmationEmail } from "../store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, username, password, startingBankroll = 10000, marketingOptIn = false } = body;

    if (!email || !username) {
      return NextResponse.json(
        { error: "Email and username are required." },
        { status: 400 }
      );
    }

    const targetBase = getTargetBase();

    // Try forwarding to external API backend if available
    if (targetBase && targetBase !== "/api") {
      try {
        const proxyRes = await fetch(`${targetBase.replace(/\/+$/, "")}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username, password, startingBankroll, marketingOptIn }),
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
      emailConfirmed: false,
    };

    localUsersMap.set(userId, newUser);

    // Dispatch confirmation email
    await sendWebConfirmationEmail(cleanEmail);

    // Strictly require email confirmation - do NOT issue an accessToken
    return NextResponse.json(
      {
        success: true,
        requireConfirmation: true,
        email: cleanEmail,
        message: "Account created! Please check your email inbox to confirm your account before logging in.",
        user: {
          id: userId,
          email: cleanEmail,
          username: cleanUsername,
          emailConfirmed: false,
        },
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
