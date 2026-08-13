import { Router } from "express";
import { db } from "../db";
import { requireAuth } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

function distinctColumn(table: string, column: string): string[] {
  const rows = db
    .prepare(`SELECT DISTINCT ${column} as value FROM ${table} WHERE deleted_at IS NULL AND ${column} IS NOT NULL AND TRIM(${column}) != ''`)
    .all() as { value: string }[];
  return rows.map((r) => r.value).sort((a, b) => a.localeCompare(b));
}

router.get("/", (_req, res) => {
  res.json({
    brands: distinctColumn("lighting_purchases", "brand"),
    clientNames: distinctColumn("lighting_purchases", "client_name"),
    addresses: distinctColumn("lighting_purchases", "address"),
    commissionRecipients: distinctColumn("lighting_purchases", "commission_recipient"),
    blumOrderNames: distinctColumn("blum_purchases", "order_name"),
    taskAssignees: distinctColumn("tasks", "assigned_to"),
  });
});

export default router;
