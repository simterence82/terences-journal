import React, { useMemo, useState } from "react";
import { AlertTriangle, PackageX, Plus, Sparkles, Store, Trash2, Wrench, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  useShowroomItemsList,
  useCreateShowroomItem,
  useUpdateShowroomItem,
  useDeleteShowroomItem,
} from "../hooks/useShowroom";
import {
  SHOWROOM_CATEGORIES,
  SHOWROOM_CATEGORY_LABELS,
  SHOWROOM_STATUSES,
  SHOWROOM_STATUS_LABELS,
  type ShowroomCategory,
  type ShowroomItem,
  type ShowroomStatus,
} from "../lib/types";
import { SummaryCard } from "../components/SummaryCard";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Select } from "../components/Select";
import { Tabs } from "../components/Tabs";
import { Badge } from "../components/Badge";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "../components/Dialog";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

const STATUS_VARIANT: Record<ShowroomStatus, "ok" | "warn" | "bad" | "accent" | "outline"> = {
  ok: "ok",
  low_stock: "warn",
  needs_attention: "warn",
  faulty: "bad",
  servicing_scheduled: "accent",
  resolved: "outline",
};

const EMPTY_FORM = { category: SHOWROOM_CATEGORIES[0] as ShowroomCategory, title: "", description: "", status: "ok" as ShowroomStatus, notes: "" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

export const ShowroomPage: React.FC = () => {
  const listQuery = useShowroomItemsList();
  const createMutation = useCreateShowroomItem();
  const updateMutation = useUpdateShowroomItem();
  const deleteMutation = useDeleteShowroomItem();
  const deleteTarget = useConfirmDialog<ShowroomItem>();

  const [categoryFilter, setCategoryFilter] = useState<"all" | ShowroomCategory>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<ShowroomItem | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const items = listQuery.data ?? [];
  const visibleItems = categoryFilter === "all" ? items : items.filter((i) => i.category === categoryFilter);

  const counts = useMemo(
    () => ({
      lowStock: items.filter((i) => i.status === "low_stock").length,
      needsAttention: items.filter((i) => i.status === "needs_attention").length,
      faulty: items.filter((i) => i.status === "faulty").length,
      servicing: items.filter((i) => i.status === "servicing_scheduled").length,
    }),
    [items]
  );

  const resetForm = () => setForm(EMPTY_FORM);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    createMutation.mutate(
      { category: form.category, title: form.title, description: form.description || null, status: form.status, notes: form.notes || null },
      {
        onSuccess: () => {
          toast.success("Added to showroom tracker");
          resetForm();
          setIsAddOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add item"),
      }
    );
  };

  const openEdit = (item: ShowroomItem) => {
    setEditing(item);
    setEditForm({ category: item.category, title: item.title, description: item.description ?? "", status: item.status, notes: item.notes ?? "" });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    updateMutation.mutate(
      { id: editing.id, category: editForm.category, title: editForm.title, description: editForm.description || null, status: editForm.status, notes: editForm.notes || null },
      {
        onSuccess: () => {
          toast.success("Updated");
          setEditing(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update item"),
      }
    );
  };

  const quickSetStatus = (item: ShowroomItem, status: ShowroomStatus) => {
    updateMutation.mutate({ id: item.id, status }, { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update item") });
  };

  const handleDelete = async () => {
    if (!deleteTarget.target) return;
    await deleteMutation.mutateAsync(deleteTarget.target.id, {
      onSuccess: () => toast.success("Removed"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove item"),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Showroom</h1>
          <p className="mt-1 text-[0.9375rem] text-faint-ink">Stock, equipment, and issues at the showroom</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus size={16} /> Add Item
        </Button>
      </div>

      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: 96 }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Low Stock" value={counts.lowStock} icon={<PackageX size={16} />} tone={counts.lowStock > 0 ? "warn" : "ok"} />
          <SummaryCard label="Needs Attention" value={counts.needsAttention} icon={<AlertTriangle size={16} />} tone={counts.needsAttention > 0 ? "warn" : "ok"} />
          <SummaryCard label="Faulty" value={counts.faulty} icon={<Wrench size={16} />} tone={counts.faulty > 0 ? "bad" : "ok"} />
          <SummaryCard label="Servicing Scheduled" value={counts.servicing} icon={<Sparkles size={16} />} tone="accent" />
        </div>
      )}

      <Tabs
        value={categoryFilter}
        onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}
        options={[
          { value: "all", label: "All", count: items.length },
          ...SHOWROOM_CATEGORIES.map((c) => ({ value: c, label: SHOWROOM_CATEGORY_LABELS[c], count: items.filter((i) => i.category === c).length })),
        ]}
        className="flex-wrap"
      />

      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 150 }} />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState icon={<Store size={28} />} message="Nothing tracked here yet." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className="w-fit">{SHOWROOM_CATEGORY_LABELS[item.category]}</Badge>
                  <span className="text-[0.9375rem] font-semibold text-ink">{item.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label="Edit item">
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(item)} aria-label="Delete item">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              {item.description && <p className="text-[0.8125rem] leading-relaxed text-faint-ink">{item.description}</p>}
              <Select
                value={item.status}
                onValueChange={(v) => quickSetStatus(item, v as ShowroomStatus)}
                options={SHOWROOM_STATUSES.map((s) => ({ value: s, label: SHOWROOM_STATUS_LABELS[s] }))}
              />
              <div className="flex items-center justify-between border-t border-line pt-2 text-xs text-faint-ink">
                <Badge variant={STATUS_VARIANT[item.status]}>{SHOWROOM_STATUS_LABELS[item.status]}</Badge>
                <span>
                  {item.reportedByName ?? "Studio"} · {formatDate(item.createdAt)}
                </span>
              </div>
              {item.notes && <p className="rounded-lg bg-surface px-3 py-2 text-xs text-faint-ink">{item.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
        <DialogHeader>
          <DialogTitle>Add Showroom Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v as ShowroomCategory }))} options={SHOWROOM_CATEGORIES.map((c) => ({ value: c, label: SHOWROOM_CATEGORY_LABELS[c] }))} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as ShowroomStatus }))} options={SHOWROOM_STATUSES.map((s) => ({ value: s, label: SHOWROOM_STATUS_LABELS[s] }))} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Title *</label>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Mineral water running low" required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Description</label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Notes</label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Any extra detail, vendor contacted, etc." />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogHeader>
          <DialogTitle>Edit Showroom Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Category</label>
              <Select value={editForm.category} onValueChange={(v) => setEditForm((p) => ({ ...p, category: v as ShowroomCategory }))} options={SHOWROOM_CATEGORIES.map((c) => ({ value: c, label: SHOWROOM_CATEGORY_LABELS[c] }))} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Status</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => ({ ...p, status: v as ShowroomStatus }))} options={SHOWROOM_STATUSES.map((s) => ({ value: s, label: SHOWROOM_STATUS_LABELS[s] }))} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Title *</label>
            <Input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Description</label>
            <Textarea rows={2} value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Notes</label>
            <Textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget.isOpen}
        onOpenChange={(open) => !open && deleteTarget.close()}
        title="Remove this item?"
        description={`"${deleteTarget.target?.title ?? ""}" will be removed from the showroom tracker.`}
        onConfirm={handleDelete}
      />
    </div>
  );
};
