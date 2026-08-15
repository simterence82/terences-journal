import React, { useState } from "react";
import { Megaphone, Pin, PinOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useAnnouncementsList,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from "../hooks/useAnnouncements";
import { useLeaveCalendarList } from "../hooks/useAttendance";
import { useAuth } from "../lib/AuthContext";
import { isAdminRole, type Announcement } from "../lib/types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Badge } from "../components/Badge";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "../components/Dialog";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { LeaveCalendar } from "../components/LeaveCalendar";

const EMPTY_FORM = { title: "", body: "", pinned: false };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

export const NoticeBoardPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = !!currentUser && isAdminRole(currentUser.role);

  const listQuery = useAnnouncementsList();
  const leaveQuery = useLeaveCalendarList();
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
    createMutation.mutate(form, {
      onSuccess: () => {
        toast.success("Posted to the notice board");
        resetForm();
        setIsAddOpen(false);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to post announcement"),
    });
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setEditForm({ title: a.title, body: a.body, pinned: a.pinned });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    updateMutation.mutate(
      { id: editing.id, ...editForm },
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

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Team Leave Calendar</h2>
          <p className="text-[0.8125rem] text-faint-ink">Who's out, at a glance -- for planning cover and client meetings.</p>
        </div>
        {leaveQuery.isLoading ? (
          <Skeleton style={{ height: 220 }} />
        ) : (
          <LeaveCalendar records={leaveQuery.data ?? []} emptyHint="No one on the team is on leave this month." />
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
          <label className="flex items-center gap-2 text-[0.8125rem] font-medium text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line accent-[var(--pop)]"
              checked={form.pinned}
              onChange={(e) => setForm((p) => ({ ...p, pinned: e.target.checked }))}
            />
            Pin to top
          </label>
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
          <label className="flex items-center gap-2 text-[0.8125rem] font-medium text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line accent-[var(--pop)]"
              checked={editForm.pinned}
              onChange={(e) => setEditForm((p) => ({ ...p, pinned: e.target.checked }))}
            />
            Pin to top
          </label>
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
