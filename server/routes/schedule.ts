import { Router } from "express";
import { z } from "zod";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { firestoreDb } from "../firebase";
import { toIso, compareNullableAsc } from "../firestoreUtil";
import { requireAuth, requireAdmin } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

const collection = firestoreDb.collection("scheduleEvents");

interface ScheduleDoc {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: Timestamp;
  isDeleted: boolean;
}

function toApi(id: string, data: ScheduleDoc) {
  return {
    id,
    title: data.title,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    notes: data.notes,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
  };
}

router.get("/", async (_req, res) => {
  const snap = await collection.where("isDeleted", "==", false).get();
  const items = snap.docs.map((doc) => toApi(doc.id, doc.data() as ScheduleDoc));
  items.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : compareNullableAsc(a.startTime, b.startTime)));
  res.json(items);
});

const createSchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post("/", async (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const docRef = await collection.add({
      title: input.title,
      date: input.date,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
      createdBy: req.user!.id,
      createdAt: FieldValue.serverTimestamp(),
      isDeleted: false,
    });
    const snap = await docRef.get();
    res.json(toApi(snap.id, snap.data() as ScheduleDoc));
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

router.patch("/:id", async (req, res) => {
  try {
    const updates = updateSchema.parse(req.body);
    const docRef = collection.doc(req.params.id);
    const existing = await docRef.get();
    if (!existing.exists || (existing.data() as ScheduleDoc).isDeleted) {
      res.status(404).json({ error: "Schedule entry not found" });
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
    res.json(toApi(snap.id, snap.data() as ScheduleDoc));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update schedule entry" });
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

export default router;
