import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { toBool, toIso, nowMs } from "../db/helpers";
import { requireAuth, requireAdmin } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

interface LightingRow {
  id: number;
  brand: string;
  client_name: string;
  address: string;
  date: string;
  commission_given: number;
  commission_recipient: string | null;
  cost: number;
  selling: number;
  paid_to_seller: number;
  reimbursed: number;
  notes: string | null;
  created_by: number | null;
  created_at: number;
}

function toApi(row: LightingRow) {
  return {
    id: row.id,
    brand: row.brand,
    clientName: row.client_name,
    address: row.address,
    date: row.date,
    commissionGiven: row.commission_given,
    commissionRecipient: row.commission_recipient,
    cost: row.cost,
    selling: row.selling,
    paidToSeller: toBool(row.paid_to_seller),
    reimbursed: toBool(row.reimbursed),
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
  };
}

router.get("/", (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM lighting_purchases WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all() as unknown as LightingRow[];
  res.json(rows.map(toApi));
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

router.post("/", (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const createdAt = nowMs();
    const result = db
      .prepare(
        `INSERT INTO lighting_purchases
          (brand, client_name, address, date, commission_given, commission_recipient, cost, selling, notes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.brand,
        input.clientName,
        input.address,
        input.date,
        input.commissionGiven,
        input.commissionRecipient ?? null,
        input.cost,
        input.selling,
        input.notes ?? null,
        req.user!.id,
        createdAt
      );

    const row = db.prepare("SELECT * FROM lighting_purchases WHERE id = ?").get(Number(result.lastInsertRowid)) as unknown as LightingRow;
    res.json(toApi(row));
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

const COLUMN_BY_FIELD: Record<string, string> = {
  brand: "brand",
  clientName: "client_name",
  address: "address",
  date: "date",
  commissionGiven: "commission_given",
  commissionRecipient: "commission_recipient",
  cost: "cost",
  selling: "selling",
  notes: "notes",
  paidToSeller: "paid_to_seller",
  reimbursed: "reimbursed",
};

router.patch("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const updates = updateSchema.parse(req.body);

    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];
    for (const [field, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      const column = COLUMN_BY_FIELD[field];
      setClauses.push(`${column} = ?`);
      values.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
    }

    if (setClauses.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    values.push(id);
    db.prepare(`UPDATE lighting_purchases SET ${setClauses.join(", ")} WHERE id = ? AND deleted_at IS NULL`).run(...values);

    const row = db.prepare("SELECT * FROM lighting_purchases WHERE id = ?").get(id) as unknown as LightingRow | undefined;
    if (!row) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json(toApi(row));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update entry" });
  }
});

router.delete("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE lighting_purchases SET deleted_at = ? WHERE id = ?").run(nowMs(), id);
  res.json({ success: true });
});

export default router;
