import React, { useState } from "react";
import { Plus, Trash2, Pencil, Paperclip, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useIssuesList, useCreateIssue, useUpdateIssue, useDeleteIssue, downloadIssueFile } from "../hooks/useIssues";
import { useAuth } from "../lib/AuthContext";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Checkbox } from "../components/Checkbox";
import { FileDropzone } from "../components/FileDropzone";
import { Tabs } from "../components/Tabs";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "../components/Dialog";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/Skeleton";
import type { Issue } from "../lib/types";

const EMPTY_FORM = { title: "", description: "" };
const ACCEPTED_TYPES = "application/pdf,image/jpeg,image/png";

export const IssuesPage: React.FC = () => {
  const { authState } = useAuth();
  const isAdmin = authState.type === "authenticated" && authState.user.role === "admin";

  const listQuery = useIssuesList();
  const createMutation = useCreateIssue();
  const updateMutation = useUpdateIssue();
  const deleteMutation = useDeleteIssue();
  const deleteTarget = useConfirmDialog<string>();

  const [statusTab, setStatusTab] = useState<"unresolved" | "resolved">("unresolved");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const issues = listQuery.data ?? [];
  const unresolvedIssues = issues.filter((i) => !i.resolved);
  const resolvedIssues = issues.filter((i) => i.resolved);
  const visibleIssues = statusTab === "unresolved" ? unresolvedIssues : resolvedIssues;

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
      { title: form.title, description: form.description || null, file },
      {
        onSuccess: () => {
          toast.success("Issue logged");
          resetForm();
          setIsAddOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log issue"),
      }
    );
  };

  const toggleResolved = (id: string, resolved: boolean) => {
    updateMutation.mutate({ id, resolved: !resolved }, { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update issue") });
  };

  const openEdit = (issue: Issue) => {
    setEditingIssue(issue);
    setEditForm({ title: issue.title, description: issue.description ?? "" });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIssue) return;
    updateMutation.mutate(
      { id: editingIssue.id, title: editForm.title, description: editForm.description || null },
      {
        onSuccess: () => {
          toast.success("Issue updated");
          setEditingIssue(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update issue"),
      }
    );
  };

  const handleDelete = async () => {
    if (deleteTarget.target === null) return;
    await deleteMutation.mutateAsync(deleteTarget.target, {
      onSuccess: () => toast.success("Issue moved to Trash Bin"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete issue"),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Outstanding Issues</h1>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">{unresolvedIssues.length} unresolved of {issues.length} total</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus size={16} /> Log Issue
        </Button>
      </div>

      <Tabs
        value={statusTab}
        onValueChange={(v) => setStatusTab(v as "unresolved" | "resolved")}
        options={[
          { value: "unresolved", label: "Unresolved", count: unresolvedIssues.length },
          { value: "resolved", label: "Resolved", count: resolvedIssues.length },
        ]}
      />

      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
        <DialogHeader>
          <DialogTitle>Log Issue</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Title *</label>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Description</label>
            <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={4} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Attachment (PDF, JPEG, PNG)</label>
            {file ? (
              <div className="flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground">
                <Paperclip size={14} /> <span>{file.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>
              </div>
            ) : (
              <FileDropzone accept={ACCEPTED_TYPES} onFileSelected={setFile} />
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save Issue"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={editingIssue !== null} onOpenChange={(open) => !open && setEditingIssue(null)}>
        <DialogHeader>
          <DialogTitle>Edit Issue</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Title *</label>
            <Input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Description</label>
            <Textarea value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} rows={4} />
          </div>
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
      ) : visibleIssues.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <AlertTriangle size={32} />
          <p>No {statusTab} issues.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleIssues.map((issue) => (
            <div key={issue.id} className={`flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow ${issue.resolved ? "opacity-65" : ""}`}>
              <div className="flex items-center gap-3">
                <Checkbox checked={issue.resolved} onChange={() => toggleResolved(issue.id, issue.resolved)} aria-label="Mark resolved" />
                <span className={`flex-1 text-[0.9375rem] font-semibold text-foreground ${issue.resolved ? "line-through" : ""}`}>{issue.title}</span>
                <Badge variant={issue.resolved ? "success" : "destructive"}>{issue.resolved ? "Resolved" : "Unresolved"}</Badge>
              </div>
              {issue.description && <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">{issue.description}</p>}
              <div className="flex items-center justify-between border-t border-border pt-2">
                {issue.fileName ? (
                  <button type="button" onClick={() => void downloadIssueFile(issue.id, issue.fileName!, issue.fileType)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Download size={14} /> {issue.fileName}
                  </button>
                ) : <span />}
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(issue)} aria-label="Edit issue">
                      <Pencil size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(issue.id)} aria-label="Delete issue">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget.isOpen}
        onOpenChange={(open) => !open && deleteTarget.close()}
        title="Delete this issue?"
        description="This will move the issue to the Trash Bin, where it can be restored within 120 days before being permanently removed."
        onConfirm={handleDelete}
      />
    </div>
  );
};
