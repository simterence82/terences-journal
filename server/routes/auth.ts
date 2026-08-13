import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { toIso, nowMs } from "../db/helpers";
import {
  comparePassword,
  hashPassword,
  signSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../auth/utils";
import { requireAuth } from "../auth/middleware";

const router = Router();

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  display_name: string;
  role: "admin" | "member";
  created_at: number;
}

function toPublicUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: toIso(row.created_at),
  };
}

function setSessionCookie(res: import("express").Response, userId: number) {
  const token = signSession({ userId });
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS * 1000,
    path: "/",
  });
}

router.get("/setup-status", (_req, res) => {
  const { count } = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  res.json({ hasUsers: count > 0 });
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});

router.post("/register", async (req, res) => {
  try {
    const { count } = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    if (count > 0) {
      res.status(403).json({ error: "Setup already complete. Ask an admin to create your account." });
      return;
    }

    const input = registerSchema.parse(req.body);
    const email = input.email.toLowerCase();

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = await hashPassword(input.password);
    const createdAt = nowMs();
    const result = db
      .prepare("INSERT INTO users (email, password_hash, display_name, role, created_at) VALUES (?, ?, ?, 'admin', ?)")
      .run(email, passwordHash, input.displayName, createdAt);

    const user: UserRow = {
      id: Number(result.lastInsertRowid),
      email,
      password_hash: passwordHash,
      display_name: input.displayName,
      role: "admin",
      created_at: createdAt,
    };

    setSessionCookie(res, user.id);
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Registration failed" });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  try {
    const input = loginSchema.parse(req.body);
    const email = input.email.toLowerCase();

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await comparePassword(input.password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    setSessionCookie(res, user.id);
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Login failed" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  res.json({ success: true });
});

router.get("/session", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
