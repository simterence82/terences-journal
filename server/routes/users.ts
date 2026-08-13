import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { toIso, nowMs } from "../db/helpers";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { hashPassword } from "../auth/utils";

const router = Router();
router.use(requireAuth, requireAdmin);

interface UserRow {
  id: number;
  email: string;
  display_name: string;
  role: "admin" | "member";
  created_at: number;
}

function toApi(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: toIso(row.created_at),
  };
}

router.get("/", (_req, res) => {
  const rows = db
    .prepare("SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at ASC")
    .all() as unknown as UserRow[];
  res.json(rows.map(toApi));
});

const createSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "member"]),
});

router.post("/", async (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const email = input.email.toLowerCase();

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = await hashPassword(input.password);
    const createdAt = nowMs();
    const result = db
      .prepare("INSERT INTO users (email, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(email, passwordHash, input.displayName, input.role, createdAt);

    res.json(
      toApi({
        id: Number(result.lastInsertRowid),
        email,
        display_name: input.displayName,
        role: input.role,
        created_at: createdAt,
      })
    );
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create user" });
  }
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ success: true });
});

export default router;
