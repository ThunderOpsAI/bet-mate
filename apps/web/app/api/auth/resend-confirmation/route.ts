import { NextResponse } from "next/server";
import { localUsersMap, getTargetBase, sendWebConfirmationEmail } from "../store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const targetBase = getTargetBase();

    // Try forwarding to external API backend if available
    if (targetBase && targetBase !== "/api") {
      try {
        const proxyRes = await fetch(`${targetBase.replace(/\/+$/, "")}/api/auth/resend-confirmation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        if (proxyRes.ok) {
          const data = await proxyRes.json();
          return NextResponse.json(data, { status: 200 });
        } else {
          const errData = await proxyRes.json().catch(() => null);
          return NextResponse.json(
            { error: errData?.error || "Failed to resend confirmation email" },
            { status: proxyRes.status }
          );
        }
      } catch {
        // Fall back to local check
      }
    }

    // Local standalone authentication fallback
    const cleanEmail = String(email).toLowerCase().trim();
    const user = [...localUsersMap.values()].find((u) => u.email === cleanEmail);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const emailSent = await sendWebConfirmationEmail(cleanEmail);

    return NextResponse.json({
      success: true,
      emailSent,
      message: emailSent
        ? `Confirmation email dispatched to ${cleanEmail}.`
        : `Email service unavailable or link generated locally.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to resend confirmation email" }, { status: 500 });
  }
}
