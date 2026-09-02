import React, { useState } from "react";
import { Plus, X, Trash2, Pencil, Lightbulb, DollarSign, Clock, RotateCcw } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { toast } from "sonner";
import { useLightingList, useCreateLighting, useUpdateLighting, useDeleteLighting } from "../hooks/useLighting";
import { useLookups } from "../hooks/useLookups";
import { useAuth } from "../lib/AuthContext";
import { formatSGD } from "../lib/formatCurrency";
import { todayISODate } from "../lib/date";
import { SummaryCard } from "../components/SummaryCard";
import { AutoCompleteField } from "../components/AutoCompleteField";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Checkbox } from "../components/Checkbox";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "../components/Dialog";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/Skeleton";
import type { LightingCostItem, LightingPurchase } from "../lib/types";

const EMPTY_FORM = {
  brand: "",
  clientName: "",
  address: "",
  date: todayISODate(),
  commissionGiven: "",
  commissionRecipient: "",
  selling: "",
  notes: "",
};
const CHECKBOX_COLUMNS = ["Paid", "Claimed"];

interface CostRow {
  vendor: string;
  amount: string;
}
const EMPTY_COST_ROW: CostRow = { vendor: "", amount: "" };

function costRowsTotal(rows: CostRow[]): number {
  return rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

function buildCosts(rows: CostRow[]): LightingCostItem[] {
  const cleaned = rows
    .filter((r) => r.amount.trim() !== "" || r.vendor.trim() !== "")
    .map((r) => ({ vendor: r.vendor.trim() || null, amount: Number(r.amount) || 0 }));
  return cleaned.length > 0 ? cleaned : [{ vendor: null, amount: 0 }];
}

function costsToRows(costs: LightingCostItem[]): CostRow[] {
  return costs.length > 0 ? costs.map((c) => ({ vendor: c.vendor ?? "", amount: String(c.amount) })) : [{ ...EMPTY_COST_ROW }];
}

export const LightingPage: React.FC = () => {
  const { authState } = useAuth();
  const isAdmin = authState.type === "authenticated" && authState.user.role === "admin";

  const listQuery = useLightingList();
  const lookupsQuery = useLookups();
  const createMutation = useCreateLighting();
  const updateMutation = useUpdateLighting();
  const deleteMutation = useDeleteLighting();
  const deleteTarget = useConfirmDialog<string>();

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [costRows, setCostRows] = useState<CostRow[]>([{ ...EMPTY_COST_ROW }]);
  const [editingEntry, setEditingEntry] = useState<LightingPurchase | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editCostRows, setEditCostRows] = useState<CostRow[]>([{ ...EMPTY_COST_ROW }]);

  const entries = listQuery.data ?? [];
  const totalProfit = entries.reduce((sum, e) => sum + (e.selling - e.cost), 0);
  const pendingPayment = entries.filter((e) => !e.paidToSeller).length;
  const pendingReimbursement = entries.filter((e) => !e.reimbursed).length;

  const setField = (key: keyof typeof EMPTY_FORM) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const resetForm = () => {
    setForm(EMPTY_FORM);
    setCostRows([{ ...EMPTY_COST_ROW }]);
  };
  const setEditField = (key: keyof typeof EMPTY_FORM) => (value: string) => setEditForm((prev) => ({ ...prev, [key]: value }));

  const addCostRow = (setRows: React.Dispatch<React.SetStateAction<CostRow[]>>) => setRows((prev) => [...prev, { ...EMPTY_COST_ROW }]);
  const removeCostRow = (setRows: React.Dispatch<React.SetStateAction<CostRow[]>>, index: number) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  const updateCostRow = (setRows: React.Dispatch<React.SetStateAction<CostRow[]>>, index: number, field: keyof CostRow, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand || !form.clientName || !form.address || !form.date) {
      toast.error("Brand, client name, address, and date are required");
      return;
    }
    createMutation.mutate(
      {
        brand: form.brand,
        clientName: form.clientName,
        address: form.address,
        date: form.date,
        commissionGiven: Number(form.commissionGiven) || 0,
        commissionRecipient: form.commissionRecipient || null,
        costs: buildCosts(costRows),
        selling: Number(form.selling) || 0,
        notes: form.notes || null,
      },
      {
        onSuccess: () => {
          toast.success("Lighting purchase added");
          resetForm();
          setIsOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add entry"),
      }
    );
  };

  const toggleField = (id: string, field: "paidToSeller" | "reimbursed", current: boolean) => {
    updateMutation.mutate({ id, [field]: !current }, { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update") });
  };

  const openEdit = (entry: LightingPurchase) => {
    setEditingEntry(entry);
    setEditForm({
      brand: entry.brand,
      clientName: entry.clientName,
      address: entry.address,
      date: entry.date.slice(0, 10),
      commissionGiven: String(entry.commissionGiven),
      commissionRecipient: entry.commissionRecipient ?? "",
      selling: String(entry.selling),
      notes: entry.notes ?? "",
    });
    setEditCostRows(costsToRows(entry.costs));
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    if (!editForm.brand || !editForm.clientName || !editForm.address || !editForm.date) {
      toast.error("Brand, client name, address, and date are required");
      return;
    }
    updateMutation.mutate(
      {
        id: editingEntry.id,
        brand: editForm.brand,
        clientName: editForm.clientName,
        address: editForm.address,
        date: editForm.date,
        commissionGiven: Number(editForm.commissionGiven) || 0,
        commissionRecipient: editForm.commissionRecipient || null,
        costs: buildCosts(editCostRows),
        selling: Number(editForm.selling) || 0,
        notes: editForm.notes || null,
      },
      {
        onSuccess: () => {
          toast.success("Lighting purchase updated");
          setEditingEntry(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update entry"),
      }
    );
  };

  const handleDelete = async () => {
    if (deleteTarget.target === null) return;
    await deleteMutation.mutateAsync(deleteTarget.target, {
      onSuccess: () => toast.success("Entry moved to Trash Bin"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete entry"),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Smart Lighting Purchases</h1>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">Track lighting jobs, commissions, and claims</p>
        </div>
        <Button
          onClick={() => setIsOpen(true)}
        >
          <Plus size={16} /> Add Entry
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
        <DialogHeader>
          <DialogTitle>Add Smart Product Purchase</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AutoCompleteField label="Brand" required options={lookupsQuery.data?.brands ?? []} value={form.brand} onChange={setField("brand")} />
          <AutoCompleteField label="Client Name" required options={lookupsQuery.data?.clientNames ?? []} value={form.clientName} onChange={setField("clientName")} />
          <AutoCompleteField label="Address" required options={lookupsQuery.data?.addresses ?? []} value={form.address} onChange={setField("address")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Date *</label>
              <Input type="date" value={form.date} onChange={(e) => setField("date")(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Commission Given (S$)</label>
              <Input type="number" min="0" step="0.01" value={form.commissionGiven} onChange={(e) => setField("commissionGiven")(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <AutoCompleteField label="Commission Recipient" options={lookupsQuery.data?.commissionRecipients ?? []} value={form.commissionRecipient} onChange={setField("commissionRecipient")} />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[0.8125rem] font-medium text-foreground">Costs (S$)</label>
              <Button type="button" variant="ghost" size="sm" onClick={() => addCostRow(setCostRows)}>
                <Plus size={14} /> Add Vendor
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {costRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="grid flex-1 grid-cols-2 gap-2">
                    <AutoCompleteField
                      options={lookupsQuery.data?.lightingVendors ?? []}
                      value={row.vendor}
                      onChange={(v) => updateCostRow(setCostRows, i, "vendor", v)}
                      placeholder="Vendor (optional)"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={row.amount}
                      onChange={(e) => updateCostRow(setCostRows, i, "amount", e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCostRow(setCostRows, i)}
                    disabled={costRows.length === 1}
                    aria-label="Remove cost"
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-right text-xs text-muted-foreground">Total cost: {formatSGD(costRowsTotal(costRows))}</div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Selling Price (S$)</label>
            <Input type="number" min="0" step="0.01" value={form.selling} onChange={(e) => setField("selling")(e.target.value)} placeholder="0.00" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Notes</label>
            <Textarea value={form.notes} onChange={(e) => setField("notes")(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save Entry"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={editingEntry !== null} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogHeader>
          <DialogTitle>Edit Smart Product Purchase</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <AutoCompleteField label="Brand" required options={lookupsQuery.data?.brands ?? []} value={editForm.brand} onChange={setEditField("brand")} />
          <AutoCompleteField label="Client Name" required options={lookupsQuery.data?.clientNames ?? []} value={editForm.clientName} onChange={setEditField("clientName")} />
          <AutoCompleteField label="Address" required options={lookupsQuery.data?.addresses ?? []} value={editForm.address} onChange={setEditField("address")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Date *</label>
              <Input type="date" value={editForm.date} onChange={(e) => setEditField("date")(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Commission Given (S$)</label>
              <Input type="number" min="0" step="0.01" value={editForm.commissionGiven} onChange={(e) => setEditField("commissionGiven")(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <AutoCompleteField label="Commission Recipient" options={lookupsQuery.data?.commissionRecipients ?? []} value={editForm.commissionRecipient} onChange={setEditField("commissionRecipient")} />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[0.8125rem] font-medium text-foreground">Costs (S$)</label>
              <Button type="button" variant="ghost" size="sm" onClick={() => addCostRow(setEditCostRows)}>
                <Plus size={14} /> Add Vendor
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {editCostRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="grid flex-1 grid-cols-2 gap-2">
                    <AutoCompleteField
                      options={lookupsQuery.data?.lightingVendors ?? []}
                      value={row.vendor}
                      onChange={(v) => updateCostRow(setEditCostRows, i, "vendor", v)}
                      placeholder="Vendor (optional)"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={row.amount}
                      onChange={(e) => updateCostRow(setEditCostRows, i, "amount", e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCostRow(setEditCostRows, i)}
                    disabled={editCostRows.length === 1}
                    aria-label="Remove cost"
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-right text-xs text-muted-foreground">Total cost: {formatSGD(costRowsTotal(editCostRows))}</div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Selling Price (S$)</label>
            <Input type="number" min="0" step="0.01" value={editForm.selling} onChange={(e) => setEditField("selling")(e.target.value)} placeholder="0.00" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Notes</label>
            <Textarea value={editForm.notes} onChange={(e) => setEditField("notes")(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Entries" value={entries.length} icon={<Lightbulb size={18} />} />
        <SummaryCard label="Total Profit" value={formatSGD(totalProfit)} icon={<DollarSign size={18} />} />
        <SummaryCard label="Pending Payment" value={pendingPayment} icon={<Clock size={18} />} />
        <SummaryCard label="Pending Claims" value={pendingReimbursement} icon={<RotateCcw size={18} />} />
      </div>

      {listQuery.isLoading ? (
        <div className="rounded-lg border border-border bg-card p-6 shadow">
          <Skeleton style={{ height: 200 }} />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-border bg-card shadow">
          <EmptyState icon={<Lightbulb size={28} />} message="No lighting purchases recorded yet." />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow md:block">
            <table className="w-full whitespace-nowrap text-[0.8125rem]">
              <thead className="bg-surface">
                <tr>
                  {["Date", "Brand", "Client", "Address", "Cost", "Selling", "Profit", "Commission", "Recipient", "Notes", "Paid", "Claimed", ""].map((h) => (
                    <th
                      key={h}
                      className={`border-b border-border px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground ${
                        CHECKBOX_COLUMNS.includes(h) ? "text-center" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface">
                    <td className="border-b border-border px-4 py-3 text-foreground">{new Date(entry.date).toLocaleDateString("en-SG")}</td>
                    <td className="border-b border-border px-4 py-3 text-foreground">{entry.brand}</td>
                    <td className="border-b border-border px-4 py-3 text-foreground">{entry.clientName}</td>
                    <td className="max-w-[12rem] truncate border-b border-border px-4 py-3 text-foreground">{entry.address}</td>
                    <td
                      className="border-b border-border px-4 py-3 text-foreground"
                      title={entry.costs.map((c) => `${c.vendor ?? "Vendor"}: ${formatSGD(c.amount)}`).join(", ")}
                    >
                      {formatSGD(entry.cost)}
                    </td>
                    <td className="border-b border-border px-4 py-3 text-foreground">{formatSGD(entry.selling)}</td>
                    <td className="border-b border-border px-4 py-3 font-semibold text-success">{formatSGD(entry.selling - entry.cost)}</td>
                    <td className="border-b border-border px-4 py-3 text-foreground">{formatSGD(entry.commissionGiven)}</td>
                    <td className="border-b border-border px-4 py-3 text-foreground">{entry.commissionRecipient || "-"}</td>
                    <td className="max-w-[12rem] truncate border-b border-border px-4 py-3 text-foreground">{entry.notes || "-"}</td>
                    <td className="border-b border-border px-4 py-3 text-center">
                      <Checkbox checked={entry.paidToSeller} onChange={() => toggleField(entry.id, "paidToSeller", entry.paidToSeller)} />
                    </td>
                    <td className="border-b border-border px-4 py-3 text-center">
                      <Checkbox checked={entry.reimbursed} onChange={() => toggleField(entry.id, "reimbursed", entry.reimbursed)} />
                    </td>
                    <td className="border-b border-border px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(entry)} aria-label="Edit entry">
                          <Pencil size={16} />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(entry.id)} aria-label="Delete entry">
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border bg-card p-4 shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">{entry.brand} &middot; {entry.clientName}</span>
                    <span className="truncate text-xs text-muted-foreground">{entry.address}</span>
                    <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString("en-SG")}</span>
                  </div>
                  <span className="shrink-0 font-semibold text-success">{formatSGD(entry.selling - entry.cost)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Cost: <span className="text-foreground">{formatSGD(entry.cost)}</span></span>
                  <span>Selling: <span className="text-foreground">{formatSGD(entry.selling)}</span></span>
                  <span>Commission: <span className="text-foreground">{formatSGD(entry.commissionGiven)}</span></span>
                  {entry.commissionRecipient && <span>To: <span className="text-foreground">{entry.commissionRecipient}</span></span>}
                </div>
                {entry.costs.length > 1 && (
                  <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {entry.costs.map((c, i) => (
                      <span key={i}>{c.vendor || "Vendor"}: <span className="text-foreground">{formatSGD(c.amount)}</span></span>
                    ))}
                  </div>
                )}
                {entry.notes && <p className="mt-2 text-xs text-muted-foreground">{entry.notes}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-foreground">
                  <label className="flex items-center gap-1.5">
                    <Checkbox checked={entry.paidToSeller} onChange={() => toggleField(entry.id, "paidToSeller", entry.paidToSeller)} /> Paid
                  </label>
                  <label className="flex items-center gap-1.5">
                    <Checkbox checked={entry.reimbursed} onChange={() => toggleField(entry.id, "reimbursed", entry.reimbursed)} /> Claimed
                  </label>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(entry)} aria-label="Edit entry">
                    <Pencil size={16} />
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(entry.id)} aria-label="Delete entry">
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteTarget.isOpen}
        onOpenChange={(open) => !open && deleteTarget.close()}
        title="Delete this entry?"
        description="This will move the entry to the Trash Bin, where it can be restored within 60 days before being permanently removed."
        onConfirm={handleDelete}
      />
    </div>
  );
};
