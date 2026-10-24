export interface LocalUser {
  id: string;
  email: string;
  username: string;
  passwordHash?: string;
  currentBankroll: number;
  emailConfirmed: boolean;
}

// In-memory fallback user store for standalone web deployments
const globalAuthStore = globalThis as unknown as {
  __betmate_local_users?: Map<string, LocalUser>;
};

if (!globalAuthStore.__betmate_local_users) {
  globalAuthStore.__betmate_local_users = new Map<string, LocalUser>();
}

export const localUsersMap = globalAuthStore.__betmate_local_users;

export const DEFAULT_LOCAL_API_TARGET = "http://127.0.0.1:3001";
export const DEFAULT_PRODUCTION_API_TARGET = "https://bet-mate-api.vercel.app";

export function getTargetBase(): string | null {
  return (
    (process.env.API_PROXY_TARGET && process.env.API_PROXY_TARGET !== "/api"
      ? process.env.API_PROXY_TARGET
      : null) ||
    (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_API_TARGET : DEFAULT_LOCAL_API_TARGET)
  );
}

export async function sendWebConfirmationEmail(email: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddr = process.env.NOTIFY_EMAIL_FROM || "BetMate <notifications@localedge.website>";
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.NODE_ENV === "production" ? "https://bet-mate-web.vercel.app" : "http://localhost:3000");
  const confirmUrl = `${appBaseUrl}/login?confirmEmail=${encodeURIComponent(email)}`;

  if (!apiKey) {
    console.log(`[Web Auth] RESEND_API_KEY not configured. Confirmation link for ${email}: ${confirmUrl}`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [email],
        subject: "Confirm your BetMate Account",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px;">
            <h2 style="color: #10b981; margin-top: 0;">Welcome to BetMate!</h2>
            <p style="color: #cbd5e1; line-height: 1.6;">Please confirm your email address to unlock full paper betting and Blackbook watch rules.</p>
            <div style="margin: 24px 0;">
              <a href="${confirmUrl}" style="background: #10b981; color: #020617; font-weight: bold; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Confirm Email Address</a>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">If you didn't create a BetMate account, you can safely ignore this message.</p>
          </div>
        `,
      }),
    });
    if (res.ok) {
      console.log(`[Web Auth] Confirmation email sent successfully to ${email}`);
      return true;
    } else {
      const errText = await res.text();
      console.error(`[Web Auth] Resend API error (${res.status}): ${errText}`);
      return false;
    }
  } catch (err) {
    console.error("[Web Auth] Failed to dispatch confirmation email:", err);
    return false;
  }
}
