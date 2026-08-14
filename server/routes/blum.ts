import { Router } from "express";
import { z } from "zod";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { firestoreDb } from "../firebase";
import { toIso } from "../firestoreUtil";
import { requireAuth, requireAdmin } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

const collection = firestoreDb.collection("blumPurchases");

interface BlumDoc {
  orderName: string;
  amount: number;
  date: string;
  paidToSeller: boolean;
  reimbursed: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: Timestamp;
  isDeleted: boolean;
}

function toApi(id: string, data: BlumDoc) {
  return {
    id,
    orderName: data.orderName,
    amount: data.amount,
    date: data.date,
    paidToSeller: data.paidToSeller,
    reimbursed: data.reimbursed,
    notes: data.notes,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
  };
}

router.get("/", async (_req, res) => {
  const snap = await collection.where("isDeleted", "==", false).orderBy("createdAt", "desc").get();
  res.json(snap.docs.map((doc) => toApi(doc.id, doc.data() as BlumDoc)));
});

const createSchema = z.object({
  orderName: z.string().min(1),
  amount: z.number().min(0).default(0),
  date: z.string().min(1),
  notes: z.string().optional().nullable(),
});

router.post("/", async (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const docRef = await collection.add({
      orderName: input.orderName,
      amount: input.amount,
      date: input.date,
      paidToSeller: false,
      reimbursed: false,
      notes: input.notes ?? null,
      createdBy: req.user!.id,
      createdAt: FieldValue.serverTimestamp(),
      isDeleted: false,
    });
    const snap = await docRef.get();
    res.json(toApi(snap.id, snap.data() as BlumDoc));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create order" });
  }
});

const updateSchema = z.object({
  orderName: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  date: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  paidToSeller: z.boolean().optional(),
  reimbursed: z.boolean().optional(),
});

router.patch("/:id", async (req, res) => {
  try {
    const updates = updateSchema.parse(req.body);
    const docRef = collection.doc(req.params.id);
    const existing = await docRef.get();
    if (!existing.exists || (existing.data() as BlumDoc).isDeleted) {
      res.status(404).json({ error: "Order not found" });
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
    res.json(toApi(snap.id, snap.data() as BlumDoc));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update order" });
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
