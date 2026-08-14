import { Router } from "express";
import { z } from "zod";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { firestoreDb } from "../firebase";
import { toIso } from "../firestoreUtil";
import { requireAuth, requireAdmin } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

const collection = firestoreDb.collection("lightingPurchases");

interface LightingDoc {
  brand: string;
  clientName: string;
  address: string;
  date: string;
  commissionGiven: number;
  commissionRecipient: string | null;
  cost: number;
  selling: number;
  paidToSeller: boolean;
  reimbursed: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: Timestamp;
  isDeleted: boolean;
}

function toApi(id: string, data: LightingDoc) {
  return {
    id,
    brand: data.brand,
    clientName: data.clientName,
    address: data.address,
    date: data.date,
    commissionGiven: data.commissionGiven,
    commissionRecipient: data.commissionRecipient,
    cost: data.cost,
    selling: data.selling,
    paidToSeller: data.paidToSeller,
    reimbursed: data.reimbursed,
    notes: data.notes,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
  };
}

router.get("/", async (_req, res) => {
  const snap = await collection.where("isDeleted", "==", false).orderBy("createdAt", "desc").get();
  res.json(snap.docs.map((doc) => toApi(doc.id, doc.data() as LightingDoc)));
});

const createSchema = z.object({
  brand: z.string().min(1),
  clientName: z.string().min(1),
  address: z.string().min(1),
  date: z.string().min(1),
  commissionGiven: z.number().min(0).default(0),
  commissionRecipient: z.string().optional().nullable(),
  cost: z.number().min(0).default(0),
  selling: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

router.post("/", async (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const docRef = await collection.add({
      brand: input.brand,
      clientName: input.clientName,
      address: input.address,
      date: input.date,
      commissionGiven: input.commissionGiven,
      commissionRecipient: input.commissionRecipient ?? null,
      cost: input.cost,
      selling: input.selling,
      paidToSeller: false,
      reimbursed: false,
      notes: input.notes ?? null,
      createdBy: req.user!.id,
      createdAt: FieldValue.serverTimestamp(),
      isDeleted: false,
    });
    const snap = await docRef.get();
    res.json(toApi(snap.id, snap.data() as LightingDoc));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create entry" });
  }
});

const updateSchema = z.object({
  brand: z.string().min(1).optional(),
  clientName: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  commissionGiven: z.number().min(0).optional(),
  commissionRecipient: z.string().optional().nullable(),
  cost: z.number().min(0).optional(),
  selling: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  paidToSeller: z.boolean().optional(),
  reimbursed: z.boolean().optional(),
});

router.patch("/:id", async (req, res) => {
  try {
    const updates = updateSchema.parse(req.body);
    const docRef = collection.doc(req.params.id);
    const existing = await docRef.get();
    if (!existing.exists || (existing.data() as LightingDoc).isDeleted) {
      res.status(404).json({ error: "Entry not found" });
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
    res.json(toApi(snap.id, snap.data() as LightingDoc));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update entry" });
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
