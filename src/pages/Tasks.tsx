import React, { useState } from "react";
import { Plus, Trash2, Pencil, Paperclip, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useTasksList, useCreateTask, useUpdateTask, useDeleteTask, fetchTaskFileBlob } from "../hooks/useTasks";
import { EmptyState } from "../components/EmptyState";
import { useLookups } from "../hooks/useLookups";
import { useAuth } from "../lib/AuthContext";
import { AutoCompleteField } from "../components/AutoCompleteField";
import { PriorityBadge } from "../components/PriorityBadge";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Checkbox } from "../components/Checkbox";
import { FileDropzone } from "../components/FileDropzone";
import { Select } from "../components/Select";
import { Tabs } from "../components/Tabs";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "../components/Dialog";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { FilePreviewDialog } from "../components/FilePreviewDialog";
import { Skeleton } from "../components/Skeleton";
import type { Task, TaskPriority } from "../lib/types";

const EMPTY_FORM = { title: "", description: "", dueDate: "", priority: "medium" as TaskPriority, assignedTo: "" };
const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const TasksPage: React.FC = () => {
  const { authState } = useAuth();
  const isAdmin = authState.type === "authenticated" && authState.user.role === "admin";

  const listQuery = useTasksList();
  const lookupsQuery = useLookups();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const deleteTarget = useConfirmDialog<string>();

  const [statusTab, setStatusTab] = useState<"open" | "done">("open");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [previewTask, setPreviewTask] = useState<Task | null>(null);

  const tasks = listQuery.data ?? [];
  const openTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);
  const visibleTasks = statusTab === "open" ? openTasks : doneTasks;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFile(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) {
      toast.error("Title is required");
      return;
    }
    createMutation.mutate(
      { title: form.title, description: form.description || null, dueDate: form.dueDate || null, priority: form.priority, assignedTo: form.assignedTo || null, file },
      {
        onSuccess: () => {
          toast.success("Task added");
          resetForm();
          setIsAddOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add task"),
      }
    );
  };

  const toggleDone = (id: string, done: boolean) => {
    updateMutation.mutate({ id, done: !done }, { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update task") });
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      dueDate: task.dueDate ?? "",
      priority: task.priority,
      assignedTo: task.assignedTo ?? "",
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    updateMutation.mutate(
      {
        id: editingTask.id,
        title: editForm.title,
        description: editForm.description || null,
        dueDate: editForm.dueDate || null,
        priority: editForm.priority,
        assignedTo: editForm.assignedTo || null,
      },
      {
        onSuccess: () => {
          toast.success("Task updated");
          setEditingTask(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update task"),
      }
    );
  };

  const handleDelete = async () => {
    if (deleteTarget.target === null) return;
    await deleteMutation.mutateAsync(deleteTarget.target, {
      onSuccess: () => toast.success("Task moved to Trash Bin"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete task"),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Outstanding Tasks</h1>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">{openTasks.length} open of {tasks.length} total</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus size={16} /> Add Task
        </Button>
      </div>

      <Tabs
        value={statusTab}
        onValueChange={(v) => setStatusTab(v as "open" | "done")}
        options={[
          { value: "open", label: "Open", count: openTasks.length },
          { value: "done", label: "Done", count: doneTasks.length },
        ]}
      />

      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Title *</label>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Description</label>
            <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Due Date</label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Priority</label>
              <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v as TaskPriority }))} options={PRIORITY_OPTIONS} />
            </div>
          </div>
          <AutoCompleteField label="Assigned To" options={lookupsQuery.data?.taskAssignees ?? []} value={form.assignedTo} onChange={(v) => setForm((p) => ({ ...p, assignedTo: v }))} />
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Attachment</label>
            {file ? (
              <div className="flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground">
                <Paperclip size={14} /> <span>{file.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>
              </div>
            ) : (
              <FileDropzone onFileSelected={setFile} />
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save Task"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={editingTask !== null} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Title *</label>
            <Input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Description</label>
            <Textarea value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} rows={3} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Due Date</label>
              <Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-foreground">Priority</label>
              <Select value={editForm.priority} onValueChange={(v) => setEditForm((p) => ({ ...p, priority: v as TaskPriority }))} options={PRIORITY_OPTIONS} />
            </div>
          </div>
          <AutoCompleteField label="Assigned To" options={lookupsQuery.data?.taskAssignees ?? []} value={editForm.assignedTo} onChange={(v) => setEditForm((p) => ({ ...p, assignedTo: v }))} />
          <DialogFooter>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 140 }} />)}
        </div>
      ) : visibleTasks.length === 0 ? (
        <EmptyState icon={<ListChecks size={28} />} message={`No ${statusTab === "open" ? "outstanding" : "completed"} tasks.`} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTasks.map((task) => (
            <div key={task.id} className={`flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow transition-shadow hover:shadow-md ${task.done ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3">
                <Checkbox checked={task.done} onChange={() => toggleDone(task.id, task.done)} aria-label="Mark done" />
                <span className={`flex-1 text-[0.9375rem] font-semibold text-foreground ${task.done ? "line-through" : ""}`}>{task.title}</span>
                <PriorityBadge priority={task.priority} />
              </div>
              {task.description && <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">{task.description}</p>}
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                {task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}</span>}
                {task.assignedTo && <span>Assigned to {task.assignedTo}</span>}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                {task.fileName ? (
                  <button type="button" onClick={() => setPreviewTask(task)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Paperclip size={14} /> {task.fileName}
                  </button>
                ) : <span />}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(task)} aria-label="Edit task">
                    <Pencil size={16} />
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(task.id)} aria-label="Delete task">
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget.isOpen}
        onOpenChange={(open) => !open && deleteTarget.close()}
        title="Delete this task?"
        description="This will move the task to the Trash Bin, where it can be restored within 120 days before being permanently removed."
        onConfirm={handleDelete}
      />

      {previewTask && (
        <FilePreviewDialog
          open={previewTask !== null}
          onOpenChange={(open) => !open && setPreviewTask(null)}
          fileName={previewTask.fileName!}
          fileType={previewTask.fileType}
          fileUrl={previewTask.fileUrl}
          loadBlob={previewTask.fileUrl ? undefined : () => fetchTaskFileBlob(previewTask.id, previewTask.fileType)}
        />
      )}
    </div>
  );
};
