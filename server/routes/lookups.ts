import { Router } from "express";
import { firestoreDb } from "../firebase";
import { requireAuth } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

async function distinctField(collectionName: string, field: string): Promise<string[]> {
  const snap = await firestoreDb.collection(collectionName).where("isDeleted", "==", false).get();
  const values = new Set<string>();
  for (const doc of snap.docs) {
    const value = doc.data()[field];
    if (typeof value === "string" && value.trim() !== "") {
      values.add(value);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

router.get("/", async (_req, res) => {
  const [brands, clientNames, addresses, commissionRecipients, blumOrderNames, taskAssignees] = await Promise.all([
    distinctField("lightingPurchases", "brand"),
    distinctField("lightingPurchases", "clientName"),
    distinctField("lightingPurchases", "address"),
    distinctField("lightingPurchases", "commissionRecipient"),
    distinctField("blumPurchases", "orderName"),
    distinctField("tasks", "assignedTo"),
  ]);

  res.json({ brands, clientNames, addresses, commissionRecipients, blumOrderNames, taskAssignees });
});

export default router;
