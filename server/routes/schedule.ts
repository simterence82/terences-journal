import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { toIso, nowMs } from "../db/helpers";
import { requireAuth, requireAdmin } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

interface ScheduleRow {
  id: number;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: number;
}

function toApi(row: ScheduleRow) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
  };
}

router.get("/", (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM schedule_events WHERE deleted_at IS NULL ORDER BY date ASC, start_time ASC")
    .all() as unknown as ScheduleRow[];
  res.json(rows.map(toApi));
});

const createSchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post("/", (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const createdAt = nowMs();
    const result = db
      .prepare(
        `INSERT INTO schedule_events (title, date, start_time, end_time, location, notes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.title,
        input.date,
        input.startTime ?? null,
        input.endTime ?? null,
        input.location ?? null,
        input.notes ?? null,
        req.user!.id,
        createdAt
      );

    const row = db.prepare("SELECT * FROM schedule_events WHERE id = ?").get(Number(result.lastInsertRowid)) as unknown as ScheduleRow;
    res.json(toApi(row));
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

const COLUMN_BY_FIELD: Record<string, string> = {
  title: "title",
  date: "date",
  startTime: "start_time",
  endTime: "end_time",
  location: "location",
  notes: "notes",
};

router.patch("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const updates = updateSchema.parse(req.body);

    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];
    for (const [field, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      setClauses.push(`${COLUMN_BY_FIELD[field]} = ?`);
      values.push(value ?? null);
    }

    if (setClauses.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    values.push(id);
    db.prepare(`UPDATE schedule_events SET ${setClauses.join(", ")} WHERE id = ? AND deleted_at IS NULL`).run(...values);

    const row = db.prepare("SELECT * FROM schedule_events WHERE id = ?").get(id) as unknown as ScheduleRow | undefined;
    if (!row) {
      res.status(404).json({ error: "Schedule entry not found" });
      return;
    }
    res.json(toApi(row));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update schedule entry" });
  }
});

router.delete("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE schedule_events SET deleted_at = ? WHERE id = ?").run(nowMs(), id);
  res.json({ success: true });
});

export default router;
