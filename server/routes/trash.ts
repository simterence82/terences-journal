import { Router } from "express";
import { z } from "zod";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { lightingPurchases, blumPurchases, tasks, issues, scheduleEvents } from "../db/schema";
import { requireAuth, requireAdmin } from "../auth/middleware";

const router = Router();
router.use(requireAuth, requireAdmin);

const RETENTION_DAYS = 120;
const purgeAt = (deletedAt: Date) => new Date(deletedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

type TrashKind = "lighting" | "blum" | "tasks" | "issues" | "schedule";

router.get("/", async (_req, res) => {
  const [lighting, blum, taskRows, issueRows, schedule] = await Promise.all([
    db
      .select({ id: lightingPurchases.id, brand: lightingPurchases.brand, clientName: lightingPurchases.clientName, deletedAt: lightingPurchases.deletedAt })
      .from(lightingPurchases)
      .where(isNotNull(lightingPurchases.deletedAt)),
    db
      .select({ id: blumPurchases.id, orderName: blumPurchases.orderName, deletedAt: blumPurchases.deletedAt })
      .from(blumPurchases)
      .where(isNotNull(blumPurchases.deletedAt)),
    db
      .select({ id: tasks.id, title: tasks.title, fileName: tasks.fileName, deletedAt: tasks.deletedAt })
      .from(tasks)
      .where(isNotNull(tasks.deletedAt)),
    db
      .select({ id: issues.id, title: issues.title, fileName: issues.fileName, deletedAt: issues.deletedAt })
      .from(issues)
      .where(isNotNull(issues.deletedAt)),
    db
      .select({ id: scheduleEvents.id, title: scheduleEvents.title, date: scheduleEvents.date, deletedAt: scheduleEvents.deletedAt })
      .from(scheduleEvents)
      .where(isNotNull(scheduleEvents.deletedAt)),
  ]);

  const items = [
    ...lighting.map((r) => ({
      kind: "lighting" as const,
      id: r.id,
      title: `${r.brand} - ${r.clientName}`,
      subtitle: "Smart Lighting Purchase",
      hasFile: false,
      deletedAt: r.deletedAt!,
      purgeAt: purgeAt(r.deletedAt!),
    })),
    ...blum.map((r) => ({
      kind: "blum" as const,
      id: r.id,
      title: r.orderName,
      subtitle: "Blum Purchase",
      hasFile: false,
      deletedAt: r.deletedAt!,
      purgeAt: purgeAt(r.deletedAt!),
    })),
    ...taskRows.map((r) => ({
      kind: "tasks" as const,
      id: r.id,
      title: r.title,
      subtitle: "Outstanding Task",
      hasFile: !!r.fileName,
      deletedAt: r.deletedAt!,
      purgeAt: purgeAt(r.deletedAt!),
    })),
    ...issueRows.map((r) => ({
      kind: "issues" as const,
      id: r.id,
      title: r.title,
      subtitle: "Outstanding Issue",
      hasFile: !!r.fileName,
      deletedAt: r.deletedAt!,
      purgeAt: purgeAt(r.deletedAt!),
    })),
    ...schedule.map((r) => ({
      kind: "schedule" as const,
      id: r.id,
      title: r.title,
      subtitle: `Schedule - ${r.date}`,
      hasFile: false,
      deletedAt: r.deletedAt!,
      purgeAt: purgeAt(r.deletedAt!),
    })),
  ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

  res.json(items);
});

const kindSchema = z.enum(["lighting", "blum", "tasks", "issues", "schedule"]);
const actionSchema = z.object({ kind: kindSchema, id: z.number() });

async function restoreByKind(kind: TrashKind, id: number) {
  switch (kind) {
    case "lighting":
      return db.update(lightingPurchases).set({ deletedAt: null }).where(eq(lightingPurchases.id, id));
    case "blum":
      return db.update(blumPurchases).set({ deletedAt: null }).where(eq(blumPurchases.id, id));
    case "tasks":
      return db.update(tasks).set({ deletedAt: null }).where(eq(tasks.id, id));
    case "issues":
      return db.update(issues).set({ deletedAt: null }).where(eq(issues.id, id));
    case "schedule":
      return db.update(scheduleEvents).set({ deletedAt: null }).where(eq(scheduleEvents.id, id));
  }
}

async function permanentDeleteByKind(kind: TrashKind, id: number) {
  switch (kind) {
    case "lighting":
      return db.delete(lightingPurchases).where(eq(lightingPurchases.id, id));
    case "blum":
      return db.delete(blumPurchases).where(eq(blumPurchases.id, id));
    case "tasks":
      return db.delete(tasks).where(eq(tasks.id, id));
    case "issues":
      return db.delete(issues).where(eq(issues.id, id));
    case "schedule":
      return db.delete(scheduleEvents).where(eq(scheduleEvents.id, id));
  }
}

router.post("/restore", async (req, res) => {
  try {
    const { kind, id } = actionSchema.parse(req.body);
    await restoreByKind(kind, id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to restore item" });
  }
});

router.post("/permanent-delete", async (req, res) => {
  try {
    const { kind, id } = actionSchema.parse(req.body);
    await permanentDeleteByKind(kind, id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to permanently delete item" });
  }
});

export default router;
