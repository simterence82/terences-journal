import { Router } from "express";
import { z } from "zod";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { firestoreDb } from "../firebase";
import { toIso } from "../firestoreUtil";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { upload, encodeAttachment } from "../upload";

const router = Router();
router.use(requireAuth);

const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const collection = firestoreDb.collection("issues");

interface IssueDoc {
  title: string;
  description: string | null;
  resolved: boolean;
  fileName: string | null;
  fileType: string | null;
  fileData: string | null;
  hasFile: boolean;
  createdBy: string | null;
  createdAt: Timestamp;
  isDeleted: boolean;
}

function toApi(id: string, data: IssueDoc) {
  return {
    id,
    title: data.title,
    description: data.description,
    resolved: data.resolved,
    fileName: data.fileName,
    fileType: data.fileType,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
  };
}

router.get("/", async (_req, res) => {
  const snap = await collection.where("isDeleted", "==", false).get();
  const items = snap.docs.map((doc) => toApi(doc.id, doc.data() as IssueDoc));
  items.sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  res.json(items);
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

    const docRef = await collection.add({
      title: input.title,
      description: input.description ?? null,
      resolved: false,
      fileName: attachment?.fileName ?? null,
      fileType: attachment?.fileType ?? null,
      fileData: attachment?.fileData ?? null,
      hasFile: !!attachment,
      createdBy: req.user!.id,
      createdAt: FieldValue.serverTimestamp(),
      isDeleted: false,
    });

    const snap = await docRef.get();
    res.json(toApi(snap.id, snap.data() as IssueDoc));
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
    const updates = updateSchema.parse(req.body);
    const docRef = collection.doc(req.params.id);
    const existing = await docRef.get();
    if (!existing.exists || (existing.data() as IssueDoc).isDeleted) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }

    const fields: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      fields[field] = value;
    }

    if (Object.keys(fields).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    await docRef.update(fields);
    const snap = await docRef.get();
    res.json(toApi(snap.id, snap.data() as IssueDoc));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update issue" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const docRef = collection.doc(req.params.id);
  const snap = await docRef.get();
  if (snap.exists) {
    await docRef.update({ isDeleted: true, deletedAt: FieldValue.serverTimestamp() });
  }
  res.json({ success: true });
});

router.get("/:id/file", async (req, res) => {
  const snap = await collection.doc(req.params.id).get();
  const data = snap.data() as IssueDoc | undefined;

  if (!data || !data.fileData || !data.fileName) {
    res.status(404).json({ error: "No file attached" });
    return;
  }

  const buffer = Buffer.from(data.fileData, "base64");
  res.setHeader("Content-Type", data.fileType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(data.fileName)}"`);
  res.send(buffer);
});

export default router;
