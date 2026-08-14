import { Router } from "express";
import { z } from "zod";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { firestoreDb } from "../firebase";
import { toIso, compareNullableAsc } from "../firestoreUtil";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { upload, encodeAttachment } from "../upload";

const router = Router();
router.use(requireAuth);

const collection = firestoreDb.collection("tasks");

interface TaskDoc {
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  done: boolean;
  assignedTo: string | null;
  fileName: string | null;
  fileType: string | null;
  fileData: string | null;
  hasFile: boolean;
  createdBy: string | null;
  createdAt: Timestamp;
  isDeleted: boolean;
}

function toApi(id: string, data: TaskDoc) {
  return {
    id,
    title: data.title,
    description: data.description,
    dueDate: data.dueDate,
    priority: data.priority,
    done: data.done,
    assignedTo: data.assignedTo,
    fileName: data.fileName,
    fileType: data.fileType,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
  };
}

router.get("/", async (_req, res) => {
  const snap = await collection.where("isDeleted", "==", false).get();
  const items = snap.docs.map((doc) => toApi(doc.id, doc.data() as TaskDoc));
  items.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const dueCmp = compareNullableAsc(a.dueDate, b.dueDate);
    if (dueCmp !== 0) return dueCmp;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  res.json(items);
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

    const docRef = await collection.add({
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate ?? null,
      priority: input.priority,
      done: false,
      assignedTo: input.assignedTo ?? null,
      fileName: attachment?.fileName ?? null,
      fileType: attachment?.fileType ?? null,
      fileData: attachment?.fileData ?? null,
      hasFile: !!attachment,
      createdBy: req.user!.id,
      createdAt: FieldValue.serverTimestamp(),
      isDeleted: false,
    });

    const snap = await docRef.get();
    res.json(toApi(snap.id, snap.data() as TaskDoc));
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
    const updates = updateSchema.parse(req.body);
    const docRef = collection.doc(req.params.id);
    const existing = await docRef.get();
    if (!existing.exists || (existing.data() as TaskDoc).isDeleted) {
      res.status(404).json({ error: "Task not found" });
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
    res.json(toApi(snap.id, snap.data() as TaskDoc));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update task" });
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
  const data = snap.data() as TaskDoc | undefined;

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
