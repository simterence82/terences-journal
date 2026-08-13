import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { blumPurchases } from "../db/schema";
import { requireAuth, requireAdmin } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(blumPurchases)
    .where(isNull(blumPurchases.deletedAt))
    .orderBy(desc(blumPurchases.createdAt));
  res.json(rows);
});

const createSchema = z.object({
  orderName: z.string().min(1),
  amount: z.number().min(0).default(0),
  date: z.string().min(1),
  notes: z.string().optional().nullable(),
});

router.post("/", async (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const [row] = await db
      .insert(blumPurchases)
      .values({ ...input, createdBy: req.user!.id })
      .returning();
    res.json(row);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create order" });
  }
});

const updateSchema = z.object({
  orderName: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  date: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  paidToSeller: z.boolean().optional(),
  reimbursed: z.boolean().optional(),
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updates = updateSchema.parse(req.body);
    const [row] = await db
      .update(blumPurchases)
      .set(updates)
      .where(and(eq(blumPurchases.id, id), isNull(blumPurchases.deletedAt)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(row);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update order" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.update(blumPurchases).set({ deletedAt: new Date() }).where(eq(blumPurchases.id, id));
  res.json({ success: true });
});

export default router;
