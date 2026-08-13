import { Router } from "express";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import {
  comparePassword,
  hashPassword,
  signSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../auth/utils";
import { requireAuth } from "../auth/middleware";

const router = Router();

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

function toPublicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

router.get("/setup-status", async (_req, res) => {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);
  res.json({ hasUsers: Number(count) > 0 });
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});

router.post("/register", async (req, res) => {
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);
    if (Number(count) > 0) {
      res.status(403).json({ error: "Setup already complete. Ask an admin to create your account." });
      return;
    }

    const input = registerSchema.parse(req.body);
    const email = input.email.toLowerCase();

    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = await hashPassword(input.password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, displayName: input.displayName, role: "admin" })
      .returning();

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

    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await comparePassword(input.password, user.passwordHash);
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
