import { Router } from "express";
import { z } from "zod";
import type { Timestamp } from "firebase-admin/firestore";
import { firestoreDb } from "../firebase";
import { toIso } from "../firestoreUtil";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { deleteAttachment } from "../storage";

const router = Router();
router.use(requireAuth, requireAdmin);

const RETENTION_DAYS = 120;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

type TrashKind = "lighting" | "blum" | "tasks" | "issues" | "schedule";

const COLLECTION_BY_KIND: Record<TrashKind, string> = {
  lighting: "lightingPurchases",
  blum: "blumPurchases",
  tasks: "tasks",
  issues: "issues",
  schedule: "scheduleEvents",
};

router.get("/", async (_req, res) => {
  const [lighting, blum, tasks, issues, schedule] = await Promise.all([
    firestoreDb.collection("lightingPurchases").where("isDeleted", "==", true).get(),
    firestoreDb.collection("blumPurchases").where("isDeleted", "==", true).get(),
    firestoreDb.collection("tasks").where("isDeleted", "==", true).get(),
    firestoreDb.collection("issues").where("isDeleted", "==", true).get(),
    firestoreDb.collection("scheduleEvents").where("isDeleted", "==", true).get(),
  ]);

  const items: { kind: TrashKind; id: string; title: string; subtitle: string; hasFile: boolean; deletedAt: Timestamp }[] = [
    ...lighting.docs.map((doc) => {
      const d = doc.data();
      return { kind: "lighting" as const, id: doc.id, title: `${d.brand} - ${d.clientName}`, subtitle: "Smart Lighting Purchase", hasFile: false, deletedAt: d.deletedAt as Timestamp };
    }),
    ...blum.docs.map((doc) => {
      const d = doc.data();
      return { kind: "blum" as const, id: doc.id, title: d.orderName, subtitle: "Blum Purchase", hasFile: false, deletedAt: d.deletedAt as Timestamp };
    }),
    ...tasks.docs.map((doc) => {
      const d = doc.data();
      return { kind: "tasks" as const, id: doc.id, title: d.title, subtitle: "Outstanding Task", hasFile: !!d.fileName, deletedAt: d.deletedAt as Timestamp };
    }),
    ...issues.docs.map((doc) => {
      const d = doc.data();
      return { kind: "issues" as const, id: doc.id, title: d.title, subtitle: "Outstanding Issue", hasFile: !!d.fileName, deletedAt: d.deletedAt as Timestamp };
    }),
    ...schedule.docs.map((doc) => {
      const d = doc.data();
      return { kind: "schedule" as const, id: doc.id, title: d.title, subtitle: `Schedule - ${d.date}`, hasFile: false, deletedAt: d.deletedAt as Timestamp };
    }),
  ];

  const sorted = items
    .sort((a, b) => b.deletedAt.toMillis() - a.deletedAt.toMillis())
    .map(({ deletedAt, ...rest }) => ({
      ...rest,
      deletedAt: toIso(deletedAt),
      purgeAt: new Date(deletedAt.toMillis() + RETENTION_MS).toISOString(),
    }));

  res.json(sorted);
});

const kindSchema = z.enum(["lighting", "blum", "tasks", "issues", "schedule"]);
const actionSchema = z.object({ kind: kindSchema, id: z.string().min(1) });

router.post("/restore", async (req, res) => {
  try {
    const { kind, id } = actionSchema.parse(req.body);
    const docRef = firestoreDb.collection(COLLECTION_BY_KIND[kind]).doc(id);
    const snap = await docRef.get();
    if (snap.exists) {
      await docRef.update({ isDeleted: false, deletedAt: null });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to restore item" });
  }
});

router.post("/permanent-delete", async (req, res) => {
  try {
    const { kind, id } = actionSchema.parse(req.body);
    const docRef = firestoreDb.collection(COLLECTION_BY_KIND[kind]).doc(id);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data() as { storagePath?: string | null };
      if (data.storagePath) {
        await deleteAttachment(data.storagePath);
      }
      await docRef.delete();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to permanently delete item" });
  }
});

export default router;
