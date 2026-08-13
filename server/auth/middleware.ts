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
    const role = decoded.role === "admin" ? "admin" : "member";
    req.user = {
      id: decoded.uid,
      email: decoded.email ?? "",
      displayName: (decoded.name as string | undefined) ?? decoded.email ?? "",
      role,
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
