import React, { useState } from "react";
import { Plus, Trash2, Package, DollarSign, Clock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useBlumList, useCreateBlum, useUpdateBlum, useDeleteBlum } from "../hooks/useBlum";
import { useLookups } from "../hooks/useLookups";
import { useAuth } from "../lib/AuthContext";
import { formatSGD } from "../lib/formatCurrency";
import { SummaryCard } from "../components/SummaryCard";
import { AutoCompleteField } from "../components/AutoCompleteField";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Checkbox } from "../components/Checkbox";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "../components/Dialog";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/Skeleton";

const EMPTY_FORM = { orderName: "", amount: "", date: new Date().toISOString().slice(0, 10), notes: "" };

export const BlumPage: React.FC = () => {
  const { authState } = useAuth();
  const isAdmin = authState.type === "authenticated" && authState.user.role === "admin";

  const listQuery = useBlumList();
  const lookupsQuery = useLookups();
  const createMutation = useCreateBlum();
  const updateMutation = useUpdateBlum();
  const deleteMutation = useDeleteBlum();
  const deleteTarget = useConfirmDialog<number>();

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const entries = listQuery.data ?? [];
  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const pendingPayment = entries.filter((e) => !e.paidToSeller).length;
  const pendingReimbursement = entries.filter((e) => !e.reimbursed).length;

  const setField = (key: keyof typeof EMPTY_FORM) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const resetForm = () => setForm(EMPTY_FORM);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.orderName || !form.date) {
      toast.error("Order name and date are required");
      return;
    }
    createMutation.mutate(
      { orderName: form.orderName, amount: Number(form.amount) || 0, date: form.date, notes: form.notes || null },
      {
        onSuccess: () => {
          toast.success("Blum order added");
          resetForm();
          setIsOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add order"),
      }
    );
  };

  const toggleField = (id: number, field: "paidToSeller" | "reimbursed", current: boolean) => {
    updateMutation.mutate({ id, [field]: !current }, { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update") });
  };

  const handleDelete = async () => {
    if (deleteTarget.target === null) return;
    await deleteMutation.mutateAsync(deleteTarget.target, {
      onSuccess: () => toast.success("Order moved to Trash Bin"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete order"),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Blum Purchases</h1>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">Track Blum hardware orders and reimbursements</p>
        </div>
        <Button onClick={() => setIsOpen(true)}>
          <Plus size={16} /> Add Order
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
        <DialogHeader>
          <DialogTitle>Add Blum Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AutoCompleteField label="Order Name" required options={lookupsQuery.data?.blumOrderNames ?? []} value={form.orderName} onChange={setField("orderName")} />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Amount (S$)</label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setField("amount")(e.target.value)} placeholder="0.00" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Date *</label>
              <Input type="date" value={form.date} onChange={(e) => setField("date")(e.target.value)} required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Notes</label>
            <Textarea value={form.notes} onChange={(e) => setField("notes")(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save Order"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Orders" value={entries.length} icon={<Package size={18} />} />
        <SummaryCard label="Total Amount" value={formatSGD(totalAmount)} icon={<DollarSign size={18} />} />
        <SummaryCard label="Pending Payment" value={pendingPayment} icon={<Clock size={18} />} />
        <SummaryCard label="Pending Reimbursement" value={pendingReimbursement} icon={<RotateCcw size={18} />} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow">
        {listQuery.isLoading ? (
          <div className="p-6">
            <Skeleton style={{ height: 200 }} />
          </div>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No Blum orders recorded yet.</p>
        ) : (
          <table className="w-full whitespace-nowrap text-[0.8125rem]">
            <thead>
              <tr>
                {["Date", "Order Name", "Amount", "Notes", "Paid", "Reimbursed", ""].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-surface">
                  <td className="border-b border-border px-4 py-3 text-foreground">{new Date(entry.date).toLocaleDateString("en-SG")}</td>
                  <td className="border-b border-border px-4 py-3 text-foreground">{entry.orderName}</td>
                  <td className="border-b border-border px-4 py-3 text-foreground">{formatSGD(entry.amount)}</td>
                  <td className="max-w-[16rem] truncate border-b border-border px-4 py-3 text-foreground">{entry.notes || "-"}</td>
                  <td className="border-b border-border px-4 py-3">
                    <Checkbox checked={entry.paidToSeller} onChange={() => toggleField(entry.id, "paidToSeller", entry.paidToSeller)} />
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    <Checkbox checked={entry.reimbursed} onChange={() => toggleField(entry.id, "reimbursed", entry.reimbursed)} />
                  </td>
                  {isAdmin && (
                    <td className="border-b border-border px-4 py-3">
                      <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(entry.id)} aria-label="Delete order">
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget.isOpen}
        onOpenChange={(open) => !open && deleteTarget.close()}
        title="Delete this order?"
        description="This will move the order to the Trash Bin, where it can be restored within 120 days before being permanently removed."
        onConfirm={handleDelete}
      />
    </div>
  );
};
