import { Router } from "express";
import { z } from "zod";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { issues } from "../db/schema";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { upload, encodeAttachment } from "../upload";

const router = Router();
router.use(requireAuth);

const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

router.get("/", async (_req, res) => {
  const rows = await db
    .select({
      id: issues.id,
      title: issues.title,
      description: issues.description,
      resolved: issues.resolved,
      fileName: issues.fileName,
      fileType: issues.fileType,
      createdBy: issues.createdBy,
      createdAt: issues.createdAt,
    })
    .from(issues)
    .where(isNull(issues.deletedAt))
    .orderBy(asc(issues.resolved), desc(issues.createdAt));
  res.json(rows);
});

const fieldsSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
});

router.post("/", upload.single("file"), async (req, res) => {
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

    const [row] = await db
      .insert(issues)
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
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create issue" });
  }
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  resolved: z.boolean().optional(),
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updates = updateSchema.parse(req.body);
    const [row] = await db
      .update(issues)
      .set(updates)
      .where(and(eq(issues.id, id), isNull(issues.deletedAt)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    const { fileData, ...rest } = row;
    res.json(rest);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update issue" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.update(issues).set({ deletedAt: new Date() }).where(eq(issues.id, id));
  res.json({ success: true });
});

router.get("/:id/file", async (req, res) => {
  const id = Number(req.params.id);
  const row = await db.query.issues.findFirst({ where: eq(issues.id, id) });
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
