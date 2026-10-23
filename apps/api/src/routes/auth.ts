import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET ?? "change-me-in-production";

const memoryUsers = new Map<
  string,
  { id: string; email: string; username: string; passwordHash: string; currentBankroll: number; emailConfirmed: boolean; marketingOptIn: boolean }
>();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(8),
  startingBankroll: z.number().positive().default(10000),
  marketingOptIn: z.boolean().default(false),
});

const loginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});

function makeToken(userId: string) {
  return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: "30d" });
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: parsed.data.email }, { username: parsed.data.username }] },
    });
    if (existing) return res.status(409).json({ error: "Email or username already exists" });

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        username: parsed.data.username,
        passwordHash,
        startingBankroll: parsed.data.startingBankroll,
        currentBankroll: parsed.data.startingBankroll,
        emailConfirmed: false,
        marketingOptIn: parsed.data.marketingOptIn,
      },
    });

    void sendConfirmationEmail(user.email);

    return res.status(201).json({
      success: true,
      requireConfirmation: true,
      email: user.email,
      message: "Account created! Please check your email inbox to confirm your account before logging in.",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        emailConfirmed: false,
      },
    });
  } catch (dbErr) {
    console.warn("Prisma user creation fallback:", dbErr);
    const existingMem = [...memoryUsers.values()].find(
      (u) => u.email === parsed.data.email || u.username === parsed.data.username
    );
    if (existingMem) return res.status(409).json({ error: "Email or username already exists" });

    const id = `local-${Date.now()}`;
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const u = {
      id,
      email: parsed.data.email,
      username: parsed.data.username,
      passwordHash,
      currentBankroll: parsed.data.startingBankroll,
      emailConfirmed: false,
      marketingOptIn: parsed.data.marketingOptIn,
    };
    memoryUsers.set(id, u);

    void sendConfirmationEmail(u.email);

    return res.status(201).json({
      success: true,
      requireConfirmation: true,
      email: u.email,
      message: "Account created! Please check your email inbox to confirm your account before logging in.",
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        emailConfirmed: false,
      },
      mode: "fallback",
    });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: parsed.data.emailOrUsername }, { username: parsed.data.emailOrUsername }] },
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.emailConfirmed) {
      return res.status(403).json({
        error: "Please confirm your email address before logging in. Check your inbox or click below to resend confirmation email.",
        requireConfirmation: true,
        email: user.email,
      });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        currentBankroll: Number(user.currentBankroll),
        emailConfirmed: user.emailConfirmed,
        marketingOptIn: user.marketingOptIn,
      },
      accessToken: makeToken(user.id),
    });
  } catch (dbErr) {
    console.warn("Prisma login fallback:", dbErr);
    const user = [...memoryUsers.values()].find(
      (c) => c.email === parsed.data.emailOrUsername || c.username === parsed.data.emailOrUsername
    );
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.emailConfirmed) {
      return res.status(403).json({
        error: "Please confirm your email address before logging in. Check your inbox or click below to resend confirmation email.",
        requireConfirmation: true,
        email: user.email,
      });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        currentBankroll: user.currentBankroll,
        emailConfirmed: user.emailConfirmed,
        marketingOptIn: user.marketingOptIn,
      },
      accessToken: makeToken(user.id),
      mode: "fallback",
    });
  }
});

// Helper to send transactional confirmation emails via Resend
async function sendConfirmationEmail(email: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddr = process.env.NOTIFY_EMAIL_FROM || "onboarding@resend.dev";
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const confirmUrl = `${appBaseUrl}/login?confirmEmail=${encodeURIComponent(email)}`;

  if (!apiKey) {
    console.log(`[Auth Email] RESEND_API_KEY not configured. Confirmation link for ${email}: ${confirmUrl}`);
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
      console.log(`[Auth Email] Confirmation email sent successfully to ${email}`);
      return true;
    } else {
      const errText = await res.text();
      console.error(`[Auth Email] Resend API error (${res.status}): ${errText}`);
      return false;
    }
  } catch (err) {
    console.error("[Auth Email] Failed to dispatch confirmation email:", err);
    return false;
  }
}

// POST /api/auth/resend-confirmation
router.post("/resend-confirmation", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const memUser = [...memoryUsers.values()].find((u) => u.email === email);
      if (!memUser) return res.status(404).json({ error: "User not found" });
    }

    const emailSent = await sendConfirmationEmail(email);

    return res.json({
      success: true,
      emailSent,
      message: emailSent
        ? `Confirmation email dispatched to ${email}.`
        : `Resend API key not set. In dev mode, confirm directly at /api/auth/confirm-email.`,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to resend confirmation email" });
  }
});

// POST /api/auth/confirm-email
router.post("/confirm-email", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.user.update({
        where: { email },
        data: { emailConfirmed: true },
      });
      return res.json({ success: true, emailConfirmed: true });
    }

    const memUser = [...memoryUsers.values()].find((u) => u.email === email);
    if (memUser) {
      memUser.emailConfirmed = true;
      return res.json({ success: true, emailConfirmed: true, mode: "fallback" });
    }

    return res.status(404).json({ error: "User not found" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to confirm email" });
  }
});

export default router;
