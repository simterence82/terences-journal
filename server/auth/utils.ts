import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const envSecret = process.env.JWT_SECRET;
if (!envSecret) {
  throw new Error("JWT_SECRET environment variable is not set. Copy .env.example to .env and fill it in.");
}
const JWT_SECRET: string = envSecret;

export const SESSION_COOKIE_NAME = "journal_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 1 week

export interface SessionPayload {
  userId: number;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_MAX_AGE_SECONDS });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "object" && decoded !== null && typeof (decoded as { userId?: unknown }).userId === "number") {
      return { userId: (decoded as { userId: number }).userId };
    }
    return null;
  } catch {
    return null;
  }
}
