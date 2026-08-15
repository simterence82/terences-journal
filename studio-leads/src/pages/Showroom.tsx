import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, PackageX, Plus, Sparkles, Trash2, Wrench, Pencil, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import {
  useShowroomItemsList,
  useCreateShowroomItem,
  useUpdateShowroomItem,
  useDeleteShowroomItem,
} from "../hooks/useShowroom";
import { useAuth } from "../lib/AuthContext";
import {
  AIRCON_ADD_STATUSES,
  SERVICE_AREAS,
  SHOWROOM_CATEGORIES,
  SHOWROOM_CATEGORY_LABELS,
  SHOWROOM_STATUSES,
  SHOWROOM_STATUS_LABELS,
  OPEN_SHOWROOM_STATUSES,
  isAdminRole,
  type ServiceArea,
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
import { Checkbox } from "../components/Checkbox";
import { Badge } from "../components/Badge";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "../components/Dialog";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { EventCalendar } from "../components/EventCalendar";

const STATUS_VARIANT: Record<ShowroomStatus, "ok" | "warn" | "bad" | "accent" | "outline"> = {
  ok: "ok",
  low_stock: "warn",
  needs_attention: "warn",
  faulty: "bad",
  servicing_needed: "warn",
  servicing_scheduled: "accent",
  resolved: "outline",
};

const EMPTY_FORM = {
  category: SHOWROOM_CATEGORIES[0] as ShowroomCategory,
  status: "ok" as ShowroomStatus,
  notes: "",
  scheduledAt: "",
  areas: [] as ServiceArea[],
};

/** Only aircon_servicing items marked "servicing_scheduled" carry a date/time. */
function needsSchedule(category: ShowroomCategory, status: ShowroomStatus): boolean {
  return category === "aircon_servicing" && status === "servicing_scheduled";
}

function isAircon(category: ShowroomCategory): boolean {
  return category === "aircon_servicing";
}

// No category collects a title/description anymore -- Notes is the one
// free-text field everywhere, so the card heading is derived from it (or
// from the selected areas for Aircon & Servicing, which has no notes-first
// concept since areas already identify the item).
function deriveTitle(notes: string, fallback: string): string {
  const firstLine = notes.trim().split("\n")[0]?.trim() ?? "";
  if (!firstLine) return fallback;
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
}

function splitScheduledAt(value: string): { date: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { date, time };
}

function isCompleteSchedule(value: string): boolean {
  const { date, time } = splitScheduledAt(value);
  return !!date && !!time;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

function formatScheduled(value: string): string {
  return new Date(value).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

// Segregates every category's items into three simple buckets so each
// category page can be filtered by "what state is this in" -- Scheduled
// only ever has anything in it for Aircon & Servicing (the only category
// with a date/time), so it's hidden elsewhere.
type StatusGroup = "open" | "scheduled" | "resolved";

const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  open: "Needs Action",
  scheduled: "Scheduled",
  resolved: "Resolved",
};

function statusGroup(status: ShowroomStatus): StatusGroup {
  if (status === "servicing_scheduled") return "scheduled";
  if (status === "ok" || status === "resolved") return "resolved";
  return "open";
}

const QUICK_TIME_SLOTS = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];

/** Date + time entry for scheduling a servicing call -- manual keying via
    native date/time inputs (forced 24-hour with lang="en-GB"), plus a row
    of one-click common slots. */
const ScheduleField: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
  const { date, time } = splitScheduledAt(value);
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[0.8125rem] font-medium text-ink">Servicing Date &amp; Time *</label>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={date} onChange={(e) => onChange(`${e.target.value}T${time}`)} required />
        <Input type="time" lang="en-GB" value={time} onChange={(e) => onChange(`${date}T${e.target.value}`)} required />
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_TIME_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => onChange(`${date || todayDateString()}T${slot}`)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              time === slot ? "border-brand bg-[var(--brand-wash)] text-brand" : "border-line text-faint-ink hover:text-ink"
            }`}
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  );
};

/** Areas an Aircon & Servicing call covers -- a checklist, since a single
    visit can cover more than one area. */
const AreaChecklist: React.FC<{ value: ServiceArea[]; onChange: (value: ServiceArea[]) => void }> = ({ value, onChange }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[0.8125rem] font-medium text-ink">Areas to Service</label>
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {SERVICE_AREAS.map((area) => (
        <Checkbox
          key={area}
          checked={value.includes(area)}
          onChange={(checked) => onChange(checked ? [...value, area] : value.filter((a) => a !== area))}
        >
          <span className="text-sm text-ink">{area}</span>
        </Checkbox>
      ))}
    </div>
  </div>
);

export const ShowroomPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = !!currentUser && isAdminRole(currentUser.role);

  const listQuery = useShowroomItemsList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const items = listQuery.data ?? [];

  return <ShowroomView items={items} isLoading={listQuery.isLoading} isAdmin={isAdmin} />;
};

type AdminTab = "overview" | ShowroomCategory;

/**
 * Every category is visible studio-wide (enforced in firestore.rules, not
 * just here). Everyone can browse and add items; only either admin tier
 * can edit fields, change to any status, or delete -- a designer's only
 * action on an existing item is marking it resolved once it's done.
 */
const ShowroomView: React.FC<{ items: ShowroomItem[]; isLoading: boolean; isAdmin: boolean }> = ({ items, isLoading, isAdmin }) => {
  const createMutation = useCreateShowroomItem();
  const updateMutation = useUpdateShowroomItem();
  const deleteMutation = useDeleteShowroomItem();
  const deleteTarget = useConfirmDialog<ShowroomItem>();

  const [tab, setTab] = useState<AdminTab>("overview");
  const [statusFilter, setStatusFilter] = useState<StatusGroup>("open");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<ShowroomItem | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const handleTabChange = (v: string) => {
    setTab(v as AdminTab);
    setStatusFilter("open");
  };

  const counts = useMemo(
    () => ({
      lowStock: items.filter((i) => i.status === "low_stock").length,
      needsAttention: items.filter((i) => i.status === "needs_attention").length,
      faulty: items.filter((i) => i.status === "faulty").length,
      servicing: items.filter((i) => i.status === "servicing_needed" || i.status === "servicing_scheduled").length,
    }),
    [items]
  );
  const openItems = useMemo(
    () => items.filter((i) => OPEN_SHOWROOM_STATUSES.includes(i.status)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [items]
  );

  const resetForm = () => setForm(EMPTY_FORM);

  const openAddDialog = (category?: ShowroomCategory) => {
    const nextCategory = category ?? EMPTY_FORM.category;
    setForm({ ...EMPTY_FORM, category: nextCategory, status: nextCategory === "aircon_servicing" ? AIRCON_ADD_STATUSES[0] : EMPTY_FORM.status });
    setIsAddOpen(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.notes.trim()) {
      toast.error("Notes are required");
      return;
    }
    if (needsSchedule(form.category, form.status) && !isCompleteSchedule(form.scheduledAt)) {
      toast.error("Enter the servicing date and time");
      return;
    }
    const aircon = isAircon(form.category);
    createMutation.mutate(
      {
        category: form.category,
        title: aircon ? (form.areas.length ? form.areas.join(", ") : "Aircon & Servicing") : deriveTitle(form.notes, SHOWROOM_CATEGORY_LABELS[form.category]),
        description: null,
        status: form.status,
        notes: form.notes,
        scheduledAt: needsSchedule(form.category, form.status) ? form.scheduledAt : null,
        areas: aircon ? form.areas : [],
      },
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
    setEditForm({
      category: item.category,
      status: item.status,
      notes: item.notes ?? "",
      scheduledAt: item.scheduledAt ?? "",
      areas: item.areas,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.notes.trim()) {
      toast.error("Notes are required");
      return;
    }
    if (needsSchedule(editForm.category, editForm.status) && !isCompleteSchedule(editForm.scheduledAt)) {
      toast.error("Enter the servicing date and time");
      return;
    }
    const aircon = isAircon(editForm.category);
    updateMutation.mutate(
      {
        id: editing.id,
        category: editForm.category,
        title: aircon ? (editForm.areas.length ? editForm.areas.join(", ") : "Aircon & Servicing") : deriveTitle(editForm.notes, SHOWROOM_CATEGORY_LABELS[editForm.category]),
        status: editForm.status,
        notes: editForm.notes,
        scheduledAt: needsSchedule(editForm.category, editForm.status) ? editForm.scheduledAt : null,
        areas: aircon ? editForm.areas : [],
      },
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
    // Scheduling needs a date/time, which the quick-select on the card can't
    // capture -- send the admin to the full edit dialog for that instead.
    if (needsSchedule(item.category, status) && !item.scheduledAt) {
      setEditing(item);
      setEditForm({ category: item.category, status, notes: item.notes ?? "", scheduledAt: "", areas: item.areas });
      toast("Enter the servicing date and time to schedule this");
      return;
    }
    updateMutation.mutate({ id: item.id, status }, { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update item") });
  };

  const handleResolve = (item: ShowroomItem) => {
    updateMutation.mutate(
      { id: item.id, status: "resolved" },
      {
        onSuccess: () => toast.success("Marked resolved"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update item"),
      }
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget.target) return;
    await deleteMutation.mutateAsync(deleteTarget.target.id, {
      onSuccess: () => toast.success("Removed"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove item"),
    });
  };

  const activeCategory = tab === "overview" ? null : tab;
  const categoryItems = activeCategory ? items.filter((i) => i.category === activeCategory) : [];
  const visibleCategoryItems = categoryItems.filter((i) => statusGroup(i.status) === statusFilter);
  const statusGroupOptions: StatusGroup[] = activeCategory === "aircon_servicing" ? ["open", "scheduled", "resolved"] : ["open", "resolved"];
  const addLabel = activeCategory === "new_materials" ? "Request for New Materials" : `Add to ${SHOWROOM_CATEGORY_LABELS[activeCategory ?? "other"]}`;

  // Every aircon_servicing item shows on the calendar, not just scheduled
  // ones -- unscheduled items (servicing_needed/faulty/needs_attention)
  // anchor on their reported date so admins see the whole backlog at a
  // glance, alongside actually-booked servicing dates.
  const servicingEvents = useMemo(
    () =>
      activeCategory === "aircon_servicing"
        ? categoryItems.map((i) => ({
            id: i.id,
            date: (i.scheduledAt ?? i.createdAt).slice(0, 10),
            title: `${i.title} — ${SHOWROOM_STATUS_LABELS[i.status]}`,
            time: i.scheduledAt ? new Date(i.scheduledAt).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false }) : null,
          }))
        : [],
    [activeCategory, categoryItems]
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Showroom</h1>
        <p className="mt-1 text-[0.9375rem] text-faint-ink">Stock, equipment, and issues at the showroom</p>
      </div>

      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        options={[
          { value: "overview", label: "Overview" },
          ...SHOWROOM_CATEGORIES.map((c) => ({ value: c, label: SHOWROOM_CATEGORY_LABELS[c], count: items.filter((i) => i.category === c).length })),
        ]}
        className="flex-wrap"
      />

      {tab === "overview" ? (
        <div className="flex flex-col gap-6">
          {isLoading ? (
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
              <SummaryCard label="Aircon Servicing" value={counts.servicing} icon={<Sparkles size={16} />} tone="accent" />
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold text-ink">Needs Attention</h2>
            {isLoading ? (
              <Skeleton style={{ height: 160 }} />
            ) : openItems.length === 0 ? (
              <EmptyState icon={<Sparkles size={26} />} message="Nothing open right now. Showroom's all clear." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
                <table className="w-full text-[0.8125rem]">
                  <thead className="bg-surface">
                    <tr>
                      {["Item", "Category", "Status", "Reported"].map((h) => (
                        <th key={h} className="border-b border-line px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openItems.map((item) => (
                      <tr key={item.id} className="cursor-pointer hover:bg-surface" onClick={() => handleTabChange(item.category)}>
                        <td className="border-b border-line px-4 py-3 font-medium text-ink">{item.title}</td>
                        <td className="border-b border-line px-4 py-3 text-faint-ink">{SHOWROOM_CATEGORY_LABELS[item.category]}</td>
                        <td className="border-b border-line px-4 py-3">
                          <Badge variant={STATUS_VARIANT[item.status]}>{SHOWROOM_STATUS_LABELS[item.status]}</Badge>
                        </td>
                        <td className="border-b border-line px-4 py-3 text-faint-ink">{formatDate(item.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">{SHOWROOM_CATEGORY_LABELS[activeCategory!]}</h2>
            <Button onClick={() => openAddDialog(activeCategory!)}>
              <Plus size={16} /> {addLabel}
            </Button>
          </div>

          {activeCategory === "aircon_servicing" && (
            <EventCalendar events={servicingEvents} emptyHint="Nothing reported or scheduled yet." />
          )}

          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusGroup)}
            options={statusGroupOptions.map((g) => ({
              value: g,
              label: STATUS_GROUP_LABELS[g],
              count: categoryItems.filter((i) => statusGroup(i.status) === g).length,
            }))}
          />

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} style={{ height: 150 }} />
              ))}
            </div>
          ) : visibleCategoryItems.length === 0 ? (
            <EmptyState icon={<LayoutGrid size={28} />} message={`Nothing in ${STATUS_GROUP_LABELS[statusFilter].toLowerCase()} for ${SHOWROOM_CATEGORY_LABELS[activeCategory!]} yet.`} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCategoryItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[0.9375rem] font-semibold text-ink">{item.title}</span>
                    {isAdmin && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label="Edit item">
                          <Pencil size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(item)} aria-label="Delete item">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                  {item.description && <p className="text-[0.8125rem] leading-relaxed text-faint-ink">{item.description}</p>}
                  {item.areas.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.areas.map((a) => (
                        <Badge key={a} variant="outline">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {isAdmin && (
                    <Select
                      value={item.status}
                      onValueChange={(v) => quickSetStatus(item, v as ShowroomStatus)}
                      options={SHOWROOM_STATUSES.map((s) => ({ value: s, label: SHOWROOM_STATUS_LABELS[s] }))}
                    />
                  )}
                  <div className="flex items-center justify-between border-t border-line pt-2 text-xs text-faint-ink">
                    <Badge variant={STATUS_VARIANT[item.status]}>{SHOWROOM_STATUS_LABELS[item.status]}</Badge>
                    <span>
                      {item.reportedByName ?? "Studio"} · {formatDate(item.createdAt)}
                    </span>
                  </div>
                  {item.scheduledAt && (
                    <p className="rounded-lg bg-[var(--accent-wash)] px-3 py-2 text-xs font-medium text-accent">Scheduled: {formatScheduled(item.scheduledAt)}</p>
                  )}
                  {item.notes && <p className="rounded-lg bg-surface px-3 py-2 text-xs text-faint-ink">{item.notes}</p>}
                  {!isAdmin && statusGroup(item.status) !== "resolved" && (
                    <Button variant="soft" size="sm" onClick={() => handleResolve(item)} disabled={updateMutation.isPending}>
                      <CheckCircle2 size={14} /> Mark Resolved
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
        <DialogHeader>
          <DialogTitle>{activeCategory ? addLabel : "Add Showroom Item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!activeCategory && (
              <div className="flex flex-col gap-2">
                <label className="text-[0.8125rem] font-medium text-ink">Category</label>
                <Select
                  value={form.category}
                  onValueChange={(v) => {
                    const nextCategory = v as ShowroomCategory;
                    setForm((p) => ({
                      ...p,
                      category: nextCategory,
                      status: nextCategory === "aircon_servicing" ? AIRCON_ADD_STATUSES[0] : "ok",
                    }));
                  }}
                  options={SHOWROOM_CATEGORIES.map((c) => ({ value: c, label: SHOWROOM_CATEGORY_LABELS[c] }))}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Status *</label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((p) => ({ ...p, status: v as ShowroomStatus }))}
                options={(form.category === "aircon_servicing" ? AIRCON_ADD_STATUSES : SHOWROOM_STATUSES).map((s) => ({ value: s, label: SHOWROOM_STATUS_LABELS[s] }))}
              />
            </div>
          </div>
          {isAircon(form.category) && <AreaChecklist value={form.areas} onChange={(areas) => setForm((p) => ({ ...p, areas }))} />}
          {needsSchedule(form.category, form.status) && (
            <ScheduleField value={form.scheduledAt} onChange={(v) => setForm((p) => ({ ...p, scheduledAt: v }))} />
          )}
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Notes *</label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="What's going on, any detail worth knowing" required />
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
              <label className="text-[0.8125rem] font-medium text-ink">Status *</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => ({ ...p, status: v as ShowroomStatus }))} options={SHOWROOM_STATUSES.map((s) => ({ value: s, label: SHOWROOM_STATUS_LABELS[s] }))} />
            </div>
          </div>
          {isAircon(editForm.category) && <AreaChecklist value={editForm.areas} onChange={(areas) => setEditForm((p) => ({ ...p, areas }))} />}
          {needsSchedule(editForm.category, editForm.status) && (
            <ScheduleField value={editForm.scheduledAt} onChange={(v) => setEditForm((p) => ({ ...p, scheduledAt: v }))} />
          )}
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Notes *</label>
            <Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} required />
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
