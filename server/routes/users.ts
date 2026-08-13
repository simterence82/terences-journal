import { Router } from "express";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { hashPassword } from "../auth/utils";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res) => {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));
  res.json(rows);
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

    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = await hashPassword(input.password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, displayName: input.displayName, role: input.role })
      .returning();

    res.json({ id: user.id, email: user.email, displayName: user.displayName, role: user.role, createdAt: user.createdAt });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create user" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }
  await db.delete(users).where(eq(users.id, id));
  res.json({ success: true });
});

export default router;
