import { Router } from "express";
import { isNull } from "drizzle-orm";
import { db } from "../db";
import { lightingPurchases, blumPurchases, tasks } from "../db/schema";
import { requireAuth } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

function distinctNonEmpty(values: (string | null)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (v && v.trim().length > 0) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

router.get("/", async (_req, res) => {
  const [lighting, blum, taskRows] = await Promise.all([
    db
      .select({ brand: lightingPurchases.brand, clientName: lightingPurchases.clientName, address: lightingPurchases.address, commissionRecipient: lightingPurchases.commissionRecipient })
      .from(lightingPurchases)
      .where(isNull(lightingPurchases.deletedAt)),
    db.select({ orderName: blumPurchases.orderName }).from(blumPurchases).where(isNull(blumPurchases.deletedAt)),
    db.select({ assignedTo: tasks.assignedTo }).from(tasks).where(isNull(tasks.deletedAt)),
  ]);

  res.json({
    brands: distinctNonEmpty(lighting.map((r) => r.brand)),
    clientNames: distinctNonEmpty(lighting.map((r) => r.clientName)),
    addresses: distinctNonEmpty(lighting.map((r) => r.address)),
    commissionRecipients: distinctNonEmpty(lighting.map((r) => r.commissionRecipient)),
    blumOrderNames: distinctNonEmpty(blum.map((r) => r.orderName)),
    taskAssignees: distinctNonEmpty(taskRows.map((r) => r.assignedTo)),
  });
});

export default router;
