import React, { useState } from "react";
import { Plus, Trash2, Pencil, Package, DollarSign, Clock, RotateCcw } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { toast } from "sonner";
import { useBlumList, useCreateBlum, useUpdateBlum, useDeleteBlum } from "../hooks/useBlum";
import { useRequestDeletion } from "../hooks/usePendingDeletions";
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
import { Tabs } from "../components/Tabs";
import { SummaryReportDialog, StatRow } from "../components/SummaryReportDialog";
import { PendingListDialog } from "../components/PendingListDialog";
import { DualConfirmCheckbox } from "../components/DualConfirmCheckbox";
import { CLAIMED_KEYS, announceDualToggle, dualUpdate, partyFor, type Party } from "../lib/dualConfirm";
import type { BlumPurchase } from "../lib/types";

const EMPTY_FORM = { orderName: "", amount: "", date: todayISODate(), notes: "" };
const CHECKBOX_COLUMNS = ["Paid", "Invoice Requested", "Claimed"];

export const BlumPage: React.FC = () => {
  const { authState, realAuthState } = useAuth();
  const canDelete = authState.type === "authenticated";
  const isSuperAdmin = authState.type === "authenticated" && authState.user.role === "superadmin";
  const viewerParty = partyFor(authState.type === "authenticated" ? authState.user.role : undefined);
  const isAdmin = authState.type === "authenticated" && (authState.user.role === "admin" || authState.user.role === "superadmin");
  // The real signed-in account, not the previewed one -- Firestore rules
  // check who is REALLY making the write, so attribution fields like
  // requestedBy must never claim to be the user being previewed.
  const currentUser = realAuthState.type === "authenticated" ? realAuthState.user : null;

  const listQuery = useBlumList();
  const lookupsQuery = useLookups();
  const createMutation = useCreateBlum();
  const updateMutation = useUpdateBlum();
  const deleteMutation = useDeleteBlum();
  const requestDeletionMutation = useRequestDeletion();
  const deleteTarget = useConfirmDialog<BlumPurchase>();

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingEntry, setEditingEntry] = useState<BlumPurchase | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [statusTab, setStatusTab] = useState<"outstanding" | "completed">("outstanding");
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [pendingDialog, setPendingDialog] = useState<"payment" | "claims" | null>(null);

  const entries = listQuery.data ?? [];
  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const pendingPayment = entries.filter((e) => !e.paidToSeller).length;
  const pendingClaims = entries.filter((e) => !e.reimbursed).length;
  const toPendingRows = (list: BlumPurchase[]) =>
    list.map((e) => ({ id: e.id, title: e.orderName, subtitle: new Date(e.date).toLocaleDateString("en-SG"), amount: e.amount }));
  const isFullyDone = (e: BlumPurchase) => e.paidToSeller && !!e.invoiceRequested && e.reimbursed;
  const outstandingEntries = entries.filter((e) => !isFullyDone(e));
  const completedEntries = entries.filter(isFullyDone);
  const visibleEntries = statusTab === "outstanding" ? outstandingEntries : completedEntries;

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

  const toggleField = (id: string, field: "paidToSeller" | "invoiceRequested", current: boolean) => {
    updateMutation.mutate({ id, [field]: !current }, { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update") });
  };

  // Claimed only counts once both the Admin and the Super Admin have ticked it.
  const toggleClaimed = (entry: BlumPurchase, party: Party, checked: boolean) => {
    const current = { admin: entry.reimbursedAdmin, superadmin: entry.reimbursedSuper };
    updateMutation.mutate(
      { id: entry.id, ...dualUpdate(CLAIMED_KEYS, current, party, checked) },
      {
        onSuccess: () => announceDualToggle("Claim", party, checked, current),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update"),
      }
    );
  };

  const openEdit = (entry: BlumPurchase) => {
    setEditingEntry(entry);
    setEditForm({ orderName: entry.orderName, amount: entry.amount.toFixed(2), date: entry.date.slice(0, 10), notes: entry.notes ?? "" });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    if (!editForm.orderName || !editForm.date) {
      toast.error("Order name and date are required");
      return;
    }
    updateMutation.mutate(
      {
        id: editingEntry.id,
        orderName: editForm.orderName,
        amount: Number(editForm.amount) || 0,
        date: editForm.date,
        notes: editForm.notes || null,
      },
      {
        onSuccess: () => {
          toast.success("Order updated");
          setEditingEntry(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update order"),
      }
    );
  };

  const handleDelete = async () => {
    const entry = deleteTarget.target;
    if (entry === null) return;
    if (isSuperAdmin) {
      await deleteMutation.mutateAsync(entry.id, {
        onSuccess: () => toast.success("Order moved to Trash Bin"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete order"),
      });
    } else {
      await requestDeletionMutation.mutateAsync(
        {
          kind: "blum",
          entityId: entry.id,
          action: "soft",
          title: entry.orderName,
          subtitle: "Blum Purchase",
          requestedBy: currentUser?.id ?? null,
          requestedByName: currentUser?.displayName ?? null,
        },
        {
          onSuccess: () => toast.success("Deletion request sent to Super Admin for approval"),
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to request deletion"),
        }
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Blum Purchases</h1>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">Track Blum hardware orders and claims</p>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <Dialog open={editingEntry !== null} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogHeader>
          <DialogTitle>Edit Blum Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <AutoCompleteField label="Order Name" required options={lookupsQuery.data?.blumOrderNames ?? []} value={editForm.orderName} onChange={(v) => setEditForm((p) => ({ ...p, orderName: v }))} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Amount (S$)</label>
              <Input type="number" min="0" step="0.01" value={editForm.amount} onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Date *</label>
              <Input type="date" value={editForm.date} onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Notes</label>
            <Textarea value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} rows={3} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Orders" value={entries.length} icon={<Package size={18} />} />
        <button type="button" onClick={() => setIsSummaryOpen(true)} className="block w-full text-left">
          <SummaryCard label="Total Amount" value={formatSGD(totalAmount)} sublabel="View summary report" icon={<DollarSign size={18} />} />
        </button>
        {isSuperAdmin ? (
          <button type="button" onClick={() => setPendingDialog("payment")} className="block w-full text-left">
            <SummaryCard label="Pending Payment" value={pendingPayment} sublabel="View amount owed" icon={<Clock size={18} />} />
          </button>
        ) : (
          <SummaryCard label="Pending Payment" value={pendingPayment} icon={<Clock size={18} />} />
        )}
        {isAdmin ? (
          <button type="button" onClick={() => setPendingDialog("claims")} className="block w-full text-left">
            <SummaryCard label="Pending Claims" value={pendingClaims} sublabel="View amount unclaimed" icon={<RotateCcw size={18} />} />
          </button>
        ) : (
          <SummaryCard label="Pending Claims" value={pendingClaims} icon={<RotateCcw size={18} />} />
        )}
      </div>

      <Tabs
        value={statusTab}
        onValueChange={(v) => setStatusTab(v as "outstanding" | "completed")}
        options={[
          { value: "outstanding", label: "Outstanding", count: outstandingEntries.length },
          { value: "completed", label: "Completed", count: completedEntries.length },
        ]}
      />

      {listQuery.isLoading ? (
        <div className="rounded-lg border border-border bg-card p-6 shadow">
          <Skeleton style={{ height: 200 }} />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-border bg-card shadow">
          <EmptyState icon={<Package size={28} />} message="No Blum orders recorded yet." />
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="rounded-lg border border-border bg-card shadow">
          <EmptyState
            icon={<Package size={28} />}
            message={statusTab === "outstanding" ? "No outstanding orders." : "No completed orders yet."}
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow md:block">
            <table className="w-full whitespace-nowrap text-[0.8125rem]">
              <thead className="bg-surface">
                <tr>
                  {["Date", "Order Name", "Amount", "Notes", "Paid", "Invoice Requested", "Claimed", ""].map((h) => (
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
                {visibleEntries.map((entry) => (
                  <tr key={entry.id} className="cursor-pointer hover:bg-surface" onClick={() => openEdit(entry)}>
                    <td className="border-b border-border px-4 py-3 text-foreground">{new Date(entry.date).toLocaleDateString("en-SG")}</td>
                    <td className="border-b border-border px-4 py-3 text-foreground">{entry.orderName}</td>
                    <td className="border-b border-border px-4 py-3 text-foreground">{formatSGD(entry.amount)}</td>
                    <td className="max-w-[16rem] truncate border-b border-border px-4 py-3 text-foreground">{entry.notes || "-"}</td>
                    <td className="border-b border-border px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={entry.paidToSeller} onChange={() => toggleField(entry.id, "paidToSeller", entry.paidToSeller)} />
                    </td>
                    <td className="border-b border-border px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={!!entry.invoiceRequested} onChange={() => toggleField(entry.id, "invoiceRequested", !!entry.invoiceRequested)} />
                    </td>
                    <td className="border-b border-border px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <DualConfirmCheckbox state={{ admin: entry.reimbursedAdmin, superadmin: entry.reimbursedSuper }} viewerParty={viewerParty} onToggle={(party, checked) => toggleClaimed(entry, party, checked)} />
                    </td>
                    <td className="border-b border-border px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(entry)} aria-label="Edit order">
                          <Pencil size={16} />
                        </Button>
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(entry)} aria-label="Delete order">
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
            {visibleEntries.map((entry) => (
              <div key={entry.id} className="cursor-pointer rounded-lg border border-border bg-card p-4 shadow" onClick={() => openEdit(entry)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">{entry.orderName}</span>
                    <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString("en-SG")}</span>
                  </div>
                  <span className="shrink-0 font-semibold text-foreground">{formatSGD(entry.amount)}</span>
                </div>
                {entry.notes && <p className="mt-2 text-xs text-muted-foreground">{entry.notes}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-foreground" onClick={(e) => e.stopPropagation()}>
                  <label className="flex items-center gap-1.5">
                    <Checkbox checked={entry.paidToSeller} onChange={() => toggleField(entry.id, "paidToSeller", entry.paidToSeller)} /> Paid
                  </label>
                  <label className="flex items-center gap-1.5">
                    <Checkbox checked={!!entry.invoiceRequested} onChange={() => toggleField(entry.id, "invoiceRequested", !!entry.invoiceRequested)} /> Invoice Requested
                  </label>
                  <div className="flex items-center gap-2">
                    <span>Claimed</span>
                    <DualConfirmCheckbox state={{ admin: entry.reimbursedAdmin, superadmin: entry.reimbursedSuper }} viewerParty={viewerParty} onToggle={(party, checked) => toggleClaimed(entry, party, checked)} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(entry)} aria-label="Edit order">
                    <Pencil size={16} />
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(entry)} aria-label="Delete order">
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
        title="Delete this order?"
        description={
          isSuperAdmin
            ? "This will move the order to the Trash Bin, where it can be restored within 60 days before being permanently removed."
            : "This will send a deletion request to a Super Admin. The order stays visible until they approve it."
        }
        onConfirm={handleDelete}
      />

      {isSuperAdmin && (
        <PendingListDialog
          open={pendingDialog === "payment"}
          onOpenChange={(open) => !open && setPendingDialog(null)}
          title="Pending Payment"
          rows={toPendingRows(entries.filter((e) => !e.paidToSeller))}
          showAmounts
          onSelect={(id) => {
            const entry = entries.find((e) => e.id === id);
            if (!entry) return;
            setPendingDialog(null);
            openEdit(entry);
          }}
        />
      )}
      {isAdmin && (
        <PendingListDialog
          open={pendingDialog === "claims"}
          onOpenChange={(open) => !open && setPendingDialog(null)}
          title="Pending Claims"
          rows={toPendingRows(entries.filter((e) => !e.reimbursed))}
          showAmounts
          onSelect={(id) => {
            const entry = entries.find((e) => e.id === id);
            if (!entry) return;
            setPendingDialog(null);
            openEdit(entry);
          }}
        />
      )}

      <SummaryReportDialog
        open={isSummaryOpen}
        onOpenChange={setIsSummaryOpen}
        title="Blum Purchases Summary"
        entries={entries}
        getDate={(e) => e.date}
        renderStats={(filtered) => {
          const amount = filtered.reduce((sum, e) => sum + e.amount, 0);
          const paid = filtered.filter((e) => e.paidToSeller).length;
          const claimed = filtered.filter((e) => e.reimbursed).length;
          return (
            <div className="grid grid-cols-2 gap-2">
              <StatRow label="Total Orders" value={filtered.length} />
              <StatRow label="Total Amount" value={formatSGD(amount)} />
              <StatRow label="Paid" value={`${paid} / ${filtered.length}`} />
              <StatRow label="Pending Payment" value={filtered.length - paid} />
              <StatRow label="Claimed" value={`${claimed} / ${filtered.length}`} />
              <StatRow label="Pending Claims" value={filtered.length - claimed} />
            </div>
          );
        }}
      />
    </div>
  );
};
