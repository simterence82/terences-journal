import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { toBool, toIso, nowMs } from "../db/helpers";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { upload, encodeAttachment } from "../upload";

const router = Router();
router.use(requireAuth);

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: "low" | "medium" | "high";
  done: number;
  assigned_to: string | null;
  file_name: string | null;
  file_data: string | null;
  file_type: string | null;
  created_by: string | null;
  created_at: number;
}

function toApi(row: Omit<TaskRow, "file_data">) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    priority: row.priority,
    done: toBool(row.done),
    assignedTo: row.assigned_to,
    fileName: row.file_name,
    fileType: row.file_type,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
  };
}

const LIST_COLUMNS = "id, title, description, due_date, priority, done, assigned_to, file_name, file_type, created_by, created_at";

router.get("/", (_req, res) => {
  const rows = db
    .prepare(`SELECT ${LIST_COLUMNS} FROM tasks WHERE deleted_at IS NULL ORDER BY done ASC, due_date ASC, created_at DESC`)
    .all() as Omit<TaskRow, "file_data">[];
  res.json(rows.map(toApi));
});

const fieldsSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assignedTo: z.string().optional().nullable(),
});

router.post("/", upload.single("file"), (req, res) => {
  try {
    const input = fieldsSchema.parse({
      title: req.body.title,
      description: req.body.description || null,
      dueDate: req.body.dueDate || null,
      priority: req.body.priority || "medium",
      assignedTo: req.body.assignedTo || null,
    });

    const attachment = req.file ? encodeAttachment(req.file) : null;
    const createdAt = nowMs();

    const result = db
      .prepare(
        `INSERT INTO tasks (title, description, due_date, priority, assigned_to, file_name, file_data, file_type, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.title,
        input.description ?? null,
        input.dueDate ?? null,
        input.priority,
        input.assignedTo ?? null,
        attachment?.fileName ?? null,
        attachment?.fileData ?? null,
        attachment?.fileType ?? null,
        req.user!.id,
        createdAt
      );

    const row = db
      .prepare(`SELECT ${LIST_COLUMNS} FROM tasks WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as Omit<TaskRow, "file_data">;
    res.json(toApi(row));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create task" });
  }
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assignedTo: z.string().optional().nullable(),
  done: z.boolean().optional(),
});

const COLUMN_BY_FIELD: Record<string, string> = {
  title: "title",
  description: "description",
  dueDate: "due_date",
  priority: "priority",
  assignedTo: "assigned_to",
  done: "done",
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
      values.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
    }

    if (setClauses.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    values.push(id);
    db.prepare(`UPDATE tasks SET ${setClauses.join(", ")} WHERE id = ? AND deleted_at IS NULL`).run(...values);

    const row = db.prepare(`SELECT ${LIST_COLUMNS} FROM tasks WHERE id = ?`).get(id) as Omit<TaskRow, "file_data"> | undefined;
    if (!row) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json(toApi(row));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update task" });
  }
});

router.delete("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE tasks SET deleted_at = ? WHERE id = ?").run(nowMs(), id);
  res.json({ success: true });
});

router.get("/:id/file", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT file_name, file_data, file_type FROM tasks WHERE id = ?").get(id) as
    | { file_name: string | null; file_data: string | null; file_type: string | null }
    | undefined;

  if (!row || !row.file_data || !row.file_name) {
    res.status(404).json({ error: "No file attached" });
    return;
  }

  const buffer = Buffer.from(row.file_data, "base64");
  res.setHeader("Content-Type", row.file_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(row.file_name)}"`);
  res.send(buffer);
});

export default router;
