import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { toBool, toIso, nowMs } from "../db/helpers";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { upload, encodeAttachment } from "../upload";

const router = Router();
router.use(requireAuth);

const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

interface IssueRow {
  id: number;
  title: string;
  description: string | null;
  resolved: number;
  file_name: string | null;
  file_data: string | null;
  file_type: string | null;
  created_by: string | null;
  created_at: number;
}

function toApi(row: Omit<IssueRow, "file_data">) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    resolved: toBool(row.resolved),
    fileName: row.file_name,
    fileType: row.file_type,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
  };
}

const LIST_COLUMNS = "id, title, description, resolved, file_name, file_type, created_by, created_at";

router.get("/", (_req, res) => {
  const rows = db
    .prepare(`SELECT ${LIST_COLUMNS} FROM issues WHERE deleted_at IS NULL ORDER BY resolved ASC, created_at DESC`)
    .all() as Omit<IssueRow, "file_data">[];
  res.json(rows.map(toApi));
});

const fieldsSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
});

router.post("/", upload.single("file"), (req, res) => {
  try {
    if (req.file && !ALLOWED_FILE_TYPES.includes(req.file.mimetype)) {
      res.status(400).json({ error: "Only PDF, JPEG, or PNG attachments are allowed" });
      return;
    }

    const input = fieldsSchema.parse({
      title: req.body.title,
      description: req.body.description || null,
    });

    const attachment = req.file ? encodeAttachment(req.file) : null;
    const createdAt = nowMs();

    const result = db
      .prepare(
        `INSERT INTO issues (title, description, file_name, file_data, file_type, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.title,
        input.description ?? null,
        attachment?.fileName ?? null,
        attachment?.fileData ?? null,
        attachment?.fileType ?? null,
        req.user!.id,
        createdAt
      );

    const row = db
      .prepare(`SELECT ${LIST_COLUMNS} FROM issues WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as Omit<IssueRow, "file_data">;
    res.json(toApi(row));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create issue" });
  }
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  resolved: z.boolean().optional(),
});

const COLUMN_BY_FIELD: Record<string, string> = {
  title: "title",
  description: "description",
  resolved: "resolved",
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
    db.prepare(`UPDATE issues SET ${setClauses.join(", ")} WHERE id = ? AND deleted_at IS NULL`).run(...values);

    const row = db.prepare(`SELECT ${LIST_COLUMNS} FROM issues WHERE id = ?`).get(id) as Omit<IssueRow, "file_data"> | undefined;
    if (!row) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    res.json(toApi(row));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update issue" });
  }
});

router.delete("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE issues SET deleted_at = ? WHERE id = ?").run(nowMs(), id);
  res.json({ success: true });
});

router.get("/:id/file", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT file_name, file_data, file_type FROM issues WHERE id = ?").get(id) as
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
