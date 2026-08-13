import React, { useState } from "react";
import { Plus, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useScheduleList, useCreateSchedule, useDeleteSchedule } from "../hooks/useSchedule";
import { useAuth } from "../lib/AuthContext";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "../components/Dialog";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/Skeleton";

const EMPTY_FORM = { title: "", date: new Date().toISOString().slice(0, 10), startTime: "", endTime: "", location: "", notes: "" };

export const SchedulePage: React.FC = () => {
  const { authState } = useAuth();
  const isAdmin = authState.type === "authenticated" && authState.user.role === "admin";

  const listQuery = useScheduleList();
  const createMutation = useCreateSchedule();
  const deleteMutation = useDeleteSchedule();
  const deleteTarget = useConfirmDialog<number>();

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const entries = listQuery.data ?? [];
  const setField = (key: keyof typeof EMPTY_FORM) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const resetForm = () => setForm(EMPTY_FORM);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date) {
      toast.error("Title and date are required");
      return;
    }
    createMutation.mutate(
      {
        title: form.title,
        date: form.date,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        location: form.location || null,
        notes: form.notes || null,
      },
      {
        onSuccess: () => {
          toast.success("Schedule entry added");
          resetForm();
          setIsOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add entry"),
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
          <h1 className="font-display text-3xl font-semibold text-foreground">Terence Schedule</h1>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">Meetings and appointments logged by your PA</p>
        </div>
        <Button onClick={() => setIsOpen(true)}>
          <Plus size={16} /> Add Entry
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
        <DialogHeader>
          <DialogTitle>Add Schedule Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Title *</label>
            <Input value={form.title} onChange={(e) => setField("title")(e.target.value)} required placeholder="e.g. Client meeting" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Date *</label>
              <Input type="date" value={form.date} onChange={(e) => setField("date")(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Start Time</label>
              <Input type="time" value={form.startTime} onChange={(e) => setField("startTime")(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">End Time</label>
              <Input type="time" value={form.endTime} onChange={(e) => setField("endTime")(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Location</label>
            <Input value={form.location} onChange={(e) => setField("location")(e.target.value)} placeholder="e.g. Level 12 Boardroom" />
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

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow">
        {listQuery.isLoading ? (
          <div className="p-6">
            <Skeleton style={{ height: 200 }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <CalendarClock size={32} />
            <p>No schedule entries yet.</p>
          </div>
        ) : (
          <table className="w-full whitespace-nowrap text-[0.8125rem]">
            <thead>
              <tr>
                {["Date", "Time", "Title", "Location", "Notes", ""].map((h) => (
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
                  <td className="border-b border-border px-4 py-3 text-foreground">
                    {entry.startTime ? `${entry.startTime}${entry.endTime ? ` - ${entry.endTime}` : ""}` : "-"}
                  </td>
                  <td className="border-b border-border px-4 py-3 font-medium text-foreground">{entry.title}</td>
                  <td className="border-b border-border px-4 py-3 text-foreground">{entry.location || "-"}</td>
                  <td className="max-w-[16rem] truncate border-b border-border px-4 py-3 text-foreground">{entry.notes || "-"}</td>
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
        title="Delete this schedule entry?"
        description="This will move the entry to the Trash Bin, where it can be restored within 120 days before being permanently removed."
        onConfirm={handleDelete}
      />
    </div>
  );
};
