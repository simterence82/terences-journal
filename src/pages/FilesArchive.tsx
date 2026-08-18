import React, { useState } from "react";
import { Paperclip, Trash2, FolderArchive, FileText } from "lucide-react";
import { toast } from "sonner";
import { useFilesArchiveList } from "../hooks/useFilesArchive";
import { fetchTaskFileBlob, useRemoveTaskFile } from "../hooks/useTasks";
import { fetchIssueFileBlob, useRemoveIssueFile } from "../hooks/useIssues";
import { useAuth } from "../lib/AuthContext";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Checkbox } from "../components/Checkbox";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { FilePreviewDialog } from "../components/FilePreviewDialog";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import type { FileArchiveItem } from "../lib/types";

const fileKey = (f: Pick<FileArchiveItem, "kind" | "id">) => `${f.kind}-${f.id}`;

export const FilesArchivePage: React.FC = () => {
  const { authState } = useAuth();
  const isAdmin = authState.type === "authenticated" && authState.user.role === "admin";

  const listQuery = useFilesArchiveList();
  const removeTaskFileMutation = useRemoveTaskFile();
  const removeIssueFileMutation = useRemoveIssueFile();
  const deleteTarget = useConfirmDialog<FileArchiveItem>();

  const files = listQuery.data ?? [];
  const [previewFile, setPreviewFile] = useState<FileArchiveItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  const allSelected = files.length > 0 && files.every((f) => selected.has(fileKey(f)));

  const toggleSelected = (f: FileArchiveItem) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = fileKey(f);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) files.forEach((f) => next.delete(fileKey(f)));
      else files.forEach((f) => next.add(fileKey(f)));
      return next;
    });
  };

  const removeFile = (f: FileArchiveItem) =>
    f.kind === "tasks" ? removeTaskFileMutation.mutateAsync(f.id) : removeIssueFileMutation.mutateAsync(f.id);

  const handleDelete = async () => {
    if (!deleteTarget.target) return;
    await removeFile(deleteTarget.target).then(
      () => toast.success("File deleted"),
      (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to delete file");
        throw err;
      }
    );
  };

  const handlePreviewDelete = () => {
    if (!previewFile) return;
    deleteTarget.open(previewFile);
    setPreviewFile(null);
  };

  const handleBulkDelete = async () => {
    const targets = files.filter((f) => selected.has(fileKey(f)));
    try {
      await Promise.all(targets.map(removeFile));
      toast.success(`${targets.length} file(s) deleted`);
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete some files");
      throw err;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Files Archive</h1>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">Every file uploaded via Outstanding Tasks and Outstanding Issues, in one place</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && files.length > 0 && (
            <label className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted-foreground">
              <Checkbox checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
              Select All
            </label>
          )}
          {isAdmin && selected.size > 0 && (
            <Button variant="destructive" onClick={() => setIsBulkDeleteOpen(true)}>
              <Trash2 size={16} /> Delete Selected ({selected.size})
            </Button>
          )}
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="rounded-lg border border-border bg-card p-6 shadow">
          <Skeleton style={{ height: 200 }} />
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-lg border border-border bg-card shadow">
          <EmptyState icon={<FolderArchive size={28} />} message="No files uploaded yet." />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow md:block">
            <table className="w-full whitespace-nowrap text-[0.8125rem]">
              <thead className="bg-surface">
                <tr>
                  {isAdmin && <th className="w-10 border-b border-border px-4 py-3" />}
                  {["File", "Source", "From", "Uploaded"].map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={fileKey(file)} className="hover:bg-surface">
                    {isAdmin && (
                      <td className="border-b border-border px-4 py-3">
                        <Checkbox checked={selected.has(fileKey(file))} onChange={() => toggleSelected(file)} aria-label={`Select ${file.fileName}`} />
                      </td>
                    )}
                    <td className="border-b border-border px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setPreviewFile(file)}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Paperclip size={14} /> {file.fileName}
                      </button>
                    </td>
                    <td className="border-b border-border px-4 py-3">
                      <Badge variant={file.kind === "tasks" ? "primary" : "secondary"}>{file.kind === "tasks" ? "Task" : "Issue"}</Badge>
                    </td>
                    <td className="max-w-[16rem] truncate border-b border-border px-4 py-3 text-foreground">{file.sourceTitle}</td>
                    <td className="border-b border-border px-4 py-3 text-foreground">{new Date(file.createdAt).toLocaleDateString("en-SG")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {files.map((file) => (
              <div key={fileKey(file)} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow">
                {isAdmin && (
                  <Checkbox checked={selected.has(fileKey(file))} onChange={() => toggleSelected(file)} aria-label={`Select ${file.fileName}`} className="mt-1" />
                )}
                <button type="button" onClick={() => setPreviewFile(file)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <FileText size={18} className="shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-primary hover:underline">{file.fileName}</span>
                    <span className="truncate text-xs text-muted-foreground">{file.sourceTitle}</span>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={file.kind === "tasks" ? "primary" : "secondary"}>{file.kind === "tasks" ? "Task" : "Issue"}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(file.createdAt).toLocaleDateString("en-SG")}</span>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {previewFile && (
        <FilePreviewDialog
          open={previewFile !== null}
          onOpenChange={(open) => !open && setPreviewFile(null)}
          fileName={previewFile.fileName}
          fileType={previewFile.fileType}
          fileUrl={previewFile.fileUrl}
          loadBlob={
            previewFile.fileUrl
              ? undefined
              : () =>
                  previewFile.kind === "tasks"
                    ? fetchTaskFileBlob(previewFile.id, previewFile.fileType)
                    : fetchIssueFileBlob(previewFile.id, previewFile.fileType)
          }
          onDelete={isAdmin ? handlePreviewDelete : undefined}
        />
      )}

      <ConfirmDialog
        open={deleteTarget.isOpen}
        onOpenChange={(open) => !open && deleteTarget.close()}
        title="Delete this file?"
        description={`"${deleteTarget.target?.fileName ?? ""}" will be permanently removed from its ${deleteTarget.target?.kind === "tasks" ? "task" : "issue"}. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        title={`Delete ${selected.size} file(s)?`}
        description="These files will be permanently removed from their tasks/issues. This cannot be undone."
        confirmLabel="Delete Permanently"
        onConfirm={handleBulkDelete}
      />
    </div>
  );
};
