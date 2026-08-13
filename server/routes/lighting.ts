import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { lightingPurchases } from "../db/schema";
import { requireAuth, requireAdmin } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(lightingPurchases)
    .where(isNull(lightingPurchases.deletedAt))
    .orderBy(desc(lightingPurchases.createdAt));
  res.json(rows);
});

const createSchema = z.object({
  brand: z.string().min(1),
  clientName: z.string().min(1),
  address: z.string().min(1),
  date: z.string().min(1),
  commissionGiven: z.number().min(0).default(0),
  commissionRecipient: z.string().optional().nullable(),
  cost: z.number().min(0).default(0),
  selling: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

router.post("/", async (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const [row] = await db
      .insert(lightingPurchases)
      .values({ ...input, createdBy: req.user!.id })
      .returning();
    res.json(row);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create entry" });
  }
});

const updateSchema = z.object({
  brand: z.string().min(1).optional(),
  clientName: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  commissionGiven: z.number().min(0).optional(),
  commissionRecipient: z.string().optional().nullable(),
  cost: z.number().min(0).optional(),
  selling: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  paidToSeller: z.boolean().optional(),
  reimbursed: z.boolean().optional(),
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updates = updateSchema.parse(req.body);
    const [row] = await db
      .update(lightingPurchases)
      .set(updates)
      .where(and(eq(lightingPurchases.id, id), isNull(lightingPurchases.deletedAt)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json(row);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update entry" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.update(lightingPurchases).set({ deletedAt: new Date() }).where(eq(lightingPurchases.id, id));
  res.json({ success: true });
});

export default router;
