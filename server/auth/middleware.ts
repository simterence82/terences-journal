import type { Request, Response, NextFunction } from "express";
import { firebaseAuth } from "../firebase";
import "../types";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const decoded = await firebaseAuth.verifyIdToken(token);

    // Firebase Email/Password sign-in is self-service at the SDK level --
    // anyone with the (non-secret) web apiKey can create a Firebase Auth
    // account directly, bypassing our backend entirely. The ONLY thing that
    // marks an account as actually approved by an admin is the "role"
    // custom claim, which only our backend (via the Admin SDK) ever sets.
    // A valid Firebase token with no recognized role claim means "someone
    // signed themselves up, but no admin created this account" -- reject it
    // outright rather than defaulting to member access.
    if (decoded.role !== "admin" && decoded.role !== "member") {
      res.status(403).json({ error: "This account has not been approved by an admin yet." });
      return;
    }

    req.user = {
      id: decoded.uid,
      email: decoded.email ?? "",
      displayName: (decoded.name as string | undefined) ?? decoded.email ?? "",
      role: decoded.role,
    };
    next();
  } catch {
    res.status(401).json({ error: "Not authenticated" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
