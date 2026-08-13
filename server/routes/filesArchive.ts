import { Router } from "express";
import { and, desc, isNull, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { tasks, issues } from "../db/schema";
import { requireAuth } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const [taskFiles, issueFiles] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, fileName: tasks.fileName, fileType: tasks.fileType, createdAt: tasks.createdAt })
      .from(tasks)
      .where(and(isNull(tasks.deletedAt), isNotNull(tasks.fileName))),
    db
      .select({ id: issues.id, title: issues.title, fileName: issues.fileName, fileType: issues.fileType, createdAt: issues.createdAt })
      .from(issues)
      .where(and(isNull(issues.deletedAt), isNotNull(issues.fileName))),
  ]);

  const items = [
    ...taskFiles.map((f) => ({
      kind: "tasks" as const,
      id: f.id,
      sourceTitle: f.title,
      fileName: f.fileName!,
      fileType: f.fileType,
      createdAt: f.createdAt,
      downloadUrl: `/api/tasks/${f.id}/file`,
    })),
    ...issueFiles.map((f) => ({
      kind: "issues" as const,
      id: f.id,
      sourceTitle: f.title,
      fileName: f.fileName!,
      fileType: f.fileType,
      createdAt: f.createdAt,
      downloadUrl: `/api/issues/${f.id}/file`,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json(items);
});

export default router;
