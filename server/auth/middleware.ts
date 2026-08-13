import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { SESSION_COOKIE_NAME, verifySession } from "./utils";
import "../types";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const payload = verifySession(token);
  if (!payload) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, payload.userId) });
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
