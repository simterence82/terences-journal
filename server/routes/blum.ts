import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { toBool, toIso, nowMs } from "../db/helpers";
import { requireAuth, requireAdmin } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

interface BlumRow {
  id: number;
  order_name: string;
  amount: number;
  date: string;
  paid_to_seller: number;
  reimbursed: number;
  notes: string | null;
  created_by: string | null;
  created_at: number;
}

function toApi(row: BlumRow) {
  return {
    id: row.id,
    orderName: row.order_name,
    amount: row.amount,
    date: row.date,
    paidToSeller: toBool(row.paid_to_seller),
    reimbursed: toBool(row.reimbursed),
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
  };
}

router.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM blum_purchases WHERE deleted_at IS NULL ORDER BY created_at DESC").all() as unknown as BlumRow[];
  res.json(rows.map(toApi));
});

const createSchema = z.object({
  orderName: z.string().min(1),
  amount: z.number().min(0).default(0),
  date: z.string().min(1),
  notes: z.string().optional().nullable(),
});

router.post("/", (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const createdAt = nowMs();
    const result = db
      .prepare("INSERT INTO blum_purchases (order_name, amount, date, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(input.orderName, input.amount, input.date, input.notes ?? null, req.user!.id, createdAt);

    const row = db.prepare("SELECT * FROM blum_purchases WHERE id = ?").get(Number(result.lastInsertRowid)) as unknown as BlumRow;
    res.json(toApi(row));
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

const COLUMN_BY_FIELD: Record<string, string> = {
  orderName: "order_name",
  amount: "amount",
  date: "date",
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
      setClauses.push(`${COLUMN_BY_FIELD[field]} = ?`);
      values.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
    }

    if (setClauses.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    values.push(id);
    db.prepare(`UPDATE blum_purchases SET ${setClauses.join(", ")} WHERE id = ? AND deleted_at IS NULL`).run(...values);

    const row = db.prepare("SELECT * FROM blum_purchases WHERE id = ?").get(id) as unknown as BlumRow | undefined;
    if (!row) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(toApi(row));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update order" });
  }
});

router.delete("/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE blum_purchases SET deleted_at = ? WHERE id = ?").run(nowMs(), id);
  res.json({ success: true });
});

export default router;
