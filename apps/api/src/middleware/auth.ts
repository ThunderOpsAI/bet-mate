import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET ?? "change-me-in-production";

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, jwtSecret) as any;
    const userId = payload.sub || payload.userId || payload.id;
    if (!userId || typeof userId !== "string") {
      return res.status(401).json({ error: "Invalid token: missing subject" });
    }
    req.userId = userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
