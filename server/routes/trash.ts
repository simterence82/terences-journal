import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { toIso, nowMs } from "../db/helpers";
import { requireAuth, requireAdmin } from "../auth/middleware";

const router = Router();
router.use(requireAuth, requireAdmin);

const RETENTION_DAYS = 120;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

type TrashKind = "lighting" | "blum" | "tasks" | "issues" | "schedule";

const TABLE_BY_KIND: Record<TrashKind, string> = {
  lighting: "lighting_purchases",
  blum: "blum_purchases",
  tasks: "tasks",
  issues: "issues",
  schedule: "schedule_events",
};

interface TrashRow {
  id: number;
  title: string;
  subtitle: string;
  hasFile: boolean;
  deletedAt: number;
}

router.get("/", (_req, res) => {
  const lighting = db
    .prepare("SELECT id, brand, client_name, deleted_at FROM lighting_purchases WHERE deleted_at IS NOT NULL")
    .all() as { id: number; brand: string; client_name: string; deleted_at: number }[];

  const blum = db
    .prepare("SELECT id, order_name, deleted_at FROM blum_purchases WHERE deleted_at IS NOT NULL")
    .all() as { id: number; order_name: string; deleted_at: number }[];

  const tasks = db
    .prepare("SELECT id, title, file_name, deleted_at FROM tasks WHERE deleted_at IS NOT NULL")
    .all() as { id: number; title: string; file_name: string | null; deleted_at: number }[];

  const issues = db
    .prepare("SELECT id, title, file_name, deleted_at FROM issues WHERE deleted_at IS NOT NULL")
    .all() as { id: number; title: string; file_name: string | null; deleted_at: number }[];

  const schedule = db
    .prepare("SELECT id, title, date, deleted_at FROM schedule_events WHERE deleted_at IS NOT NULL")
    .all() as { id: number; title: string; date: string; deleted_at: number }[];

  const items = [
    ...lighting.map((r) => ({
      kind: "lighting" as const,
      id: r.id,
      title: `${r.brand} - ${r.client_name}`,
      subtitle: "Smart Lighting Purchase",
      hasFile: false,
      deletedAt: r.deleted_at,
    })),
    ...blum.map((r) => ({
      kind: "blum" as const,
      id: r.id,
      title: r.order_name,
      subtitle: "Blum Purchase",
      hasFile: false,
      deletedAt: r.deleted_at,
    })),
    ...tasks.map((r) => ({
      kind: "tasks" as const,
      id: r.id,
      title: r.title,
      subtitle: "Outstanding Task",
      hasFile: !!r.file_name,
      deletedAt: r.deleted_at,
    })),
    ...issues.map((r) => ({
      kind: "issues" as const,
      id: r.id,
      title: r.title,
      subtitle: "Outstanding Issue",
      hasFile: !!r.file_name,
      deletedAt: r.deleted_at,
    })),
    ...schedule.map((r) => ({
      kind: "schedule" as const,
      id: r.id,
      title: r.title,
      subtitle: `Schedule - ${r.date}`,
      hasFile: false,
      deletedAt: r.deleted_at,
    })),
  ]
    .sort((a, b) => b.deletedAt - a.deletedAt)
    .map((item) => ({
      ...item,
      deletedAt: toIso(item.deletedAt),
      purgeAt: toIso(item.deletedAt + RETENTION_MS),
    }));

  res.json(items);
});

const kindSchema = z.enum(["lighting", "blum", "tasks", "issues", "schedule"]);
const actionSchema = z.object({ kind: kindSchema, id: z.number() });

router.post("/restore", (req, res) => {
  try {
    const { kind, id } = actionSchema.parse(req.body);
    const table = TABLE_BY_KIND[kind];
    db.prepare(`UPDATE ${table} SET deleted_at = NULL WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to restore item" });
  }
});

router.post("/permanent-delete", (req, res) => {
  try {
    const { kind, id } = actionSchema.parse(req.body);
    const table = TABLE_BY_KIND[kind];
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to permanently delete item" });
  }
});

export default router;
