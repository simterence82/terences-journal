import { Router } from "express";
import { z } from "zod";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { tasks } from "../db/schema";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { upload, encodeAttachment } from "../upload";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      dueDate: tasks.dueDate,
      priority: tasks.priority,
      done: tasks.done,
      assignedTo: tasks.assignedTo,
      fileName: tasks.fileName,
      fileType: tasks.fileType,
      createdBy: tasks.createdBy,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .where(isNull(tasks.deletedAt))
    .orderBy(asc(tasks.done), asc(tasks.dueDate), desc(tasks.createdAt));
  res.json(rows);
});

const fieldsSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assignedTo: z.string().optional().nullable(),
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const input = fieldsSchema.parse({
      title: req.body.title,
      description: req.body.description || null,
      dueDate: req.body.dueDate || null,
      priority: req.body.priority || "medium",
      assignedTo: req.body.assignedTo || null,
    });

    const attachment = req.file ? encodeAttachment(req.file) : null;

    const [row] = await db
      .insert(tasks)
      .values({
        ...input,
        fileName: attachment?.fileName ?? null,
        fileData: attachment?.fileData ?? null,
        fileType: attachment?.fileType ?? null,
        createdBy: req.user!.id,
      })
      .returning();

    const { fileData, ...rest } = row;
    res.json(rest);
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

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updates = updateSchema.parse(req.body);
    const [row] = await db
      .update(tasks)
      .set(updates)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const { fileData, ...rest } = row;
    res.json(rest);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update task" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, id));
  res.json({ success: true });
});

router.get("/:id/file", async (req, res) => {
  const id = Number(req.params.id);
  const row = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!row || !row.fileData || !row.fileName) {
    res.status(404).json({ error: "No file attached" });
    return;
  }
  const buffer = Buffer.from(row.fileData, "base64");
  res.setHeader("Content-Type", row.fileType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(row.fileName)}"`);
  res.send(buffer);
});

export default router;
