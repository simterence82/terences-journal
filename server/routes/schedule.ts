import { Router } from "express";
import { z } from "zod";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { scheduleEvents } from "../db/schema";
import { requireAuth, requireAdmin } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(scheduleEvents)
    .where(isNull(scheduleEvents.deletedAt))
    .orderBy(asc(scheduleEvents.date), asc(scheduleEvents.startTime));
  res.json(rows);
});

const createSchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post("/", async (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const [row] = await db
      .insert(scheduleEvents)
      .values({ ...input, createdBy: req.user!.id })
      .returning();
    res.json(row);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create schedule entry" });
  }
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updates = updateSchema.parse(req.body);
    const [row] = await db
      .update(scheduleEvents)
      .set(updates)
      .where(and(eq(scheduleEvents.id, id), isNull(scheduleEvents.deletedAt)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Schedule entry not found" });
      return;
    }
    res.json(row);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update schedule entry" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.update(scheduleEvents).set({ deletedAt: new Date() }).where(eq(scheduleEvents.id, id));
  res.json({ success: true });
});

export default router;
