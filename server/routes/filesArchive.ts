import { Router } from "express";
import { db } from "../db";
import { toIso } from "../db/helpers";
import { requireAuth } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

router.get("/", (_req, res) => {
  const taskFiles = db
    .prepare(
      "SELECT id, title, file_name, file_type, created_at FROM tasks WHERE deleted_at IS NULL AND file_name IS NOT NULL"
    )
    .all() as { id: number; title: string; file_name: string; file_type: string | null; created_at: number }[];

  const issueFiles = db
    .prepare(
      "SELECT id, title, file_name, file_type, created_at FROM issues WHERE deleted_at IS NULL AND file_name IS NOT NULL"
    )
    .all() as { id: number; title: string; file_name: string; file_type: string | null; created_at: number }[];

  const items = [
    ...taskFiles.map((f) => ({
      kind: "tasks" as const,
      id: f.id,
      sourceTitle: f.title,
      fileName: f.file_name,
      fileType: f.file_type,
      createdAt: toIso(f.created_at),
      downloadUrl: `/api/tasks/${f.id}/file`,
      _sort: f.created_at,
    })),
    ...issueFiles.map((f) => ({
      kind: "issues" as const,
      id: f.id,
      sourceTitle: f.title,
      fileName: f.file_name,
      fileType: f.file_type,
      createdAt: toIso(f.created_at),
      downloadUrl: `/api/issues/${f.id}/file`,
      _sort: f.created_at,
    })),
  ]
    .sort((a, b) => b._sort - a._sort)
    .map(({ _sort, ...rest }) => rest);

  res.json(items);
});

export default router;
