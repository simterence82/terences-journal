import React, { useState } from "react";
import { CalendarClock, Megaphone, Pin, PinOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useAnnouncementsList,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from "../hooks/useAnnouncements";
import { useAuth } from "../lib/AuthContext";
import { isAdminRole, type Announcement } from "../lib/types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Badge } from "../components/Badge";
import { Checkbox } from "../components/Checkbox";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "../components/Dialog";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

const EMPTY_FORM = { title: "", body: "", pinned: false, eventDate: "", eventTime: "" };

const QUICK_TIME_SLOTS = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

/** Optional date + time for an announcement to also appear on the
    dashboard calendar -- manual entry (24-hour, forced via lang="en-GB")
    plus a row of one-click common slots. Date left blank keeps the
    announcement Notice-Board-only. */
const EventDateTimeField: React.FC<{
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}> = ({ date, time, onDateChange, onTimeChange }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[0.8125rem] font-medium text-ink">Event Date &amp; Time</label>
    <p className="text-xs text-faint-ink">Set a date to also show this on everyone's dashboard calendar. Leave blank to keep it Notice Board only.</p>
    <div className="grid grid-cols-2 gap-2">
      <Input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
      <Input type="time" lang="en-GB" value={time} onChange={(e) => onTimeChange(e.target.value)} disabled={!date} />
    </div>
    <div className="flex flex-wrap gap-2">
      {QUICK_TIME_SLOTS.map((slot) => (
        <button
          key={slot}
          type="button"
          disabled={!date}
          onClick={() => onTimeChange(slot)}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            time === slot ? "border-brand bg-[var(--brand-wash)] text-brand" : "border-line text-faint-ink hover:text-ink"
          }`}
        >
          {slot}
        </button>
      ))}
    </div>
  </div>
);

export const NoticeBoardPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = !!currentUser && isAdminRole(currentUser.role);

  const listQuery = useAnnouncementsList();
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();
  const deleteTarget = useConfirmDialog<Announcement>();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const announcements = listQuery.data ?? [];

  const resetForm = () => setForm(EMPTY_FORM);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and message are required");
      return;
    }
    createMutation.mutate(
      {
        title: form.title,
        body: form.body,
        pinned: form.pinned,
        eventDate: form.eventDate || null,
        eventTime: form.eventDate && form.eventTime ? form.eventTime : null,
      },
      {
        onSuccess: () => {
          toast.success("Posted to the notice board");
          resetForm();
          setIsAddOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to post announcement"),
      }
    );
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setEditForm({ title: a.title, body: a.body, pinned: a.pinned, eventDate: a.eventDate ?? "", eventTime: a.eventTime ?? "" });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    updateMutation.mutate(
      {
        id: editing.id,
        title: editForm.title,
        body: editForm.body,
        pinned: editForm.pinned,
        eventDate: editForm.eventDate || null,
        eventTime: editForm.eventDate && editForm.eventTime ? editForm.eventTime : null,
      },
      {
        onSuccess: () => {
          toast.success("Announcement updated");
          setEditing(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update announcement"),
      }
    );
  };

  const togglePin = (a: Announcement) => {
    updateMutation.mutate(
      { id: a.id, pinned: !a.pinned },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update announcement") }
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget.target) return;
    await deleteMutation.mutateAsync(deleteTarget.target.id, {
      onSuccess: () => toast.success("Announcement removed"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove announcement"),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Notice Board</h1>
          <p className="mt-1 text-[0.9375rem] text-faint-ink">
            {isAdmin ? "Post news and updates for the whole team" : "News and updates from the studio"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus size={16} /> New Announcement
          </Button>
        )}
      </div>

      {listQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 100 }} />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState icon={<Megaphone size={28} />} message="No announcements yet." />
      ) : (
        <div className="flex flex-col gap-4">
          {announcements.map((a) => (
            <div key={a.id} className={`flex flex-col gap-2 rounded-xl border bg-panel p-5 shadow-sm ${a.pinned ? "border-brand" : "border-line"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {a.pinned && <Badge variant="brand">Pinned</Badge>}
                  <h2 className="font-display text-lg font-semibold text-ink">{a.title}</h2>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => togglePin(a)} aria-label={a.pinned ? "Unpin" : "Pin"}>
                      {a.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)} aria-label="Edit announcement">
                      <Pencil size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(a)} aria-label="Delete announcement">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </div>
              <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink">{a.body}</p>
              {a.eventDate && (
                <Badge variant="accent" className="w-fit gap-1">
                  <CalendarClock size={12} /> {new Date(`${a.eventDate}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                  {a.eventTime ? ` · ${a.eventTime}` : ""} · On dashboard calendar
                </Badge>
              )}
              <p className="text-xs text-faint-ink">
                {a.createdByName ?? "Studio"} · {formatDate(a.createdAt)}
                {a.updatedAt ? ` (edited ${formatDate(a.updatedAt)})` : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
        <DialogHeader>
          <DialogTitle>New Announcement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Title *</label>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Message *</label>
            <Textarea rows={4} value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} required />
          </div>
          <EventDateTimeField
            date={form.eventDate}
            time={form.eventTime}
            onDateChange={(v) => setForm((p) => ({ ...p, eventDate: v }))}
            onTimeChange={(v) => setForm((p) => ({ ...p, eventTime: v }))}
          />
          <Checkbox className="text-[0.8125rem] font-medium text-ink" checked={form.pinned} onChange={(checked) => setForm((p) => ({ ...p, pinned: checked }))}>
            Pin to top
          </Checkbox>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Posting..." : "Post Announcement"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogHeader>
          <DialogTitle>Edit Announcement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Title *</label>
            <Input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Message *</label>
            <Textarea rows={4} value={editForm.body} onChange={(e) => setEditForm((p) => ({ ...p, body: e.target.value }))} required />
          </div>
          <EventDateTimeField
            date={editForm.eventDate}
            time={editForm.eventTime}
            onDateChange={(v) => setEditForm((p) => ({ ...p, eventDate: v }))}
            onTimeChange={(v) => setEditForm((p) => ({ ...p, eventTime: v }))}
          />
          <Checkbox className="text-[0.8125rem] font-medium text-ink" checked={editForm.pinned} onChange={(checked) => setEditForm((p) => ({ ...p, pinned: checked }))}>
            Pin to top
          </Checkbox>
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
        title="Delete this announcement?"
        description={`"${deleteTarget.target?.title ?? ""}" will be permanently removed from the notice board.`}
        onConfirm={handleDelete}
      />
    </div>
  );
};
