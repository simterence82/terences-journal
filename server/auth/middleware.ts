import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { SESSION_COOKIE_NAME, verifySession } from "./utils";
import "../types";

interface UserRow {
  id: number;
  email: string;
  display_name: string;
  role: "admin" | "member";
}

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

  const row = db
    .prepare("SELECT id, email, display_name, role FROM users WHERE id = ?")
    .get(payload.userId) as UserRow | undefined;

  if (!row) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  req.user = {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
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
