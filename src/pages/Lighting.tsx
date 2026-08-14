import React, { useState } from "react";
import { Plus, Trash2, Lightbulb, DollarSign, Clock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useLightingList, useCreateLighting, useUpdateLighting, useDeleteLighting } from "../hooks/useLighting";
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

const EMPTY_FORM = {
  brand: "",
  clientName: "",
  address: "",
  date: new Date().toISOString().slice(0, 10),
  commissionGiven: "",
  commissionRecipient: "",
  cost: "",
  selling: "",
  notes: "",
};

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

  const entries = listQuery.data ?? [];
  const totalProfit = entries.reduce((sum, e) => sum + (e.selling - e.cost), 0);
  const pendingPayment = entries.filter((e) => !e.paidToSeller).length;
  const pendingReimbursement = entries.filter((e) => !e.reimbursed).length;

  const setField = (key: keyof typeof EMPTY_FORM) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const resetForm = () => setForm(EMPTY_FORM);

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
        cost: Number(form.cost) || 0,
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
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">Track lighting jobs, commissions, and reimbursements</p>
        </div>
        <Button
          onClick={() => setIsOpen(true)}
        >
          <Plus size={16} /> Add Entry
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
        <DialogHeader>
          <DialogTitle>Add Lighting Purchase</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AutoCompleteField label="Brand" required options={lookupsQuery.data?.brands ?? []} value={form.brand} onChange={setField("brand")} />
          <AutoCompleteField label="Client Name" required options={lookupsQuery.data?.clientNames ?? []} value={form.clientName} onChange={setField("clientName")} />
          <AutoCompleteField label="Address" required options={lookupsQuery.data?.addresses ?? []} value={form.address} onChange={setField("address")} />
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Cost (S$)</label>
              <Input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setField("cost")(e.target.value)} placeholder="0.00" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Selling Price (S$)</label>
              <Input type="number" min="0" step="0.01" value={form.selling} onChange={(e) => setField("selling")(e.target.value)} placeholder="0.00" />
            </div>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Entries" value={entries.length} icon={<Lightbulb size={18} />} />
        <SummaryCard label="Total Profit" value={formatSGD(totalProfit)} icon={<DollarSign size={18} />} />
        <SummaryCard label="Pending Payment" value={pendingPayment} icon={<Clock size={18} />} />
        <SummaryCard label="Pending Reimbursement" value={pendingReimbursement} icon={<RotateCcw size={18} />} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow">
        {listQuery.isLoading ? (
          <div className="p-6">
            <Skeleton style={{ height: 200 }} />
          </div>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No lighting purchases recorded yet.</p>
        ) : (
          <table className="w-full whitespace-nowrap text-[0.8125rem]">
            <thead>
              <tr>
                {["Date", "Brand", "Client", "Address", "Cost", "Selling", "Profit", "Commission", "Recipient", "Notes", "Paid", "Reimbursed", ""].map((h) => (
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
                  <td className="border-b border-border px-4 py-3 text-foreground">{entry.brand}</td>
                  <td className="border-b border-border px-4 py-3 text-foreground">{entry.clientName}</td>
                  <td className="max-w-[12rem] truncate border-b border-border px-4 py-3 text-foreground">{entry.address}</td>
                  <td className="border-b border-border px-4 py-3 text-foreground">{formatSGD(entry.cost)}</td>
                  <td className="border-b border-border px-4 py-3 text-foreground">{formatSGD(entry.selling)}</td>
                  <td className="border-b border-border px-4 py-3 font-semibold text-success">{formatSGD(entry.selling - entry.cost)}</td>
                  <td className="border-b border-border px-4 py-3 text-foreground">{formatSGD(entry.commissionGiven)}</td>
                  <td className="border-b border-border px-4 py-3 text-foreground">{entry.commissionRecipient || "-"}</td>
                  <td className="max-w-[12rem] truncate border-b border-border px-4 py-3 text-foreground">{entry.notes || "-"}</td>
                  <td className="border-b border-border px-4 py-3">
                    <Checkbox checked={entry.paidToSeller} onChange={() => toggleField(entry.id, "paidToSeller", entry.paidToSeller)} />
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    <Checkbox checked={entry.reimbursed} onChange={() => toggleField(entry.id, "reimbursed", entry.reimbursed)} />
                  </td>
                  {isAdmin && (
                    <td className="border-b border-border px-4 py-3">
                      <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(entry.id)} aria-label="Delete entry">
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
        title="Delete this entry?"
        description="This will move the entry to the Trash Bin, where it can be restored within 120 days before being permanently removed."
        onConfirm={handleDelete}
      />
    </div>
  );
};
