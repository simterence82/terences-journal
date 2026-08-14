import React, { useState } from "react";
import { Trash2, RotateCcw, Paperclip, Trash } from "lucide-react";
import { toast } from "sonner";
import { useTrashList, useRestoreTrashItem, usePermanentDeleteTrashItem } from "../hooks/useTrash";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import type { TrashItem } from "../lib/types";

const KIND_LABEL: Record<TrashItem["kind"], string> = {
  lighting: "Lighting",
  blum: "Blum",
  tasks: "Task",
  issues: "Issue",
  schedule: "Schedule",
};

function daysUntil(dateStr: string): number {
  const diffMs = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export const TrashPage: React.FC = () => {
  const listQuery = useTrashList();
  const restoreMutation = useRestoreTrashItem();
  const permanentDeleteMutation = usePermanentDeleteTrashItem();
  const [permanentTarget, setPermanentTarget] = useState<TrashItem | null>(null);

  const items = listQuery.data ?? [];

  const handleRestore = (item: TrashItem) => {
    restoreMutation.mutate(
      { kind: item.kind, id: item.id },
      {
        onSuccess: () => toast.success(`"${item.title}" restored`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to restore item"),
      }
    );
  };

  const handlePermanentDelete = async () => {
    if (!permanentTarget) return;
    await permanentDeleteMutation.mutateAsync(
      { kind: permanentTarget.kind, id: permanentTarget.id },
      {
        onSuccess: () => toast.success(`"${permanentTarget.title}" permanently deleted`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to permanently delete item"),
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Trash Bin</h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
          Deleted entries are kept here for 120 days before being permanently removed automatically.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow">
        {listQuery.isLoading ? (
          <div className="p-6">
            <Skeleton style={{ height: 200 }} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Trash size={28} />} message="Trash Bin is empty." />
        ) : (
          <table className="w-full whitespace-nowrap text-[0.8125rem]">
            <thead className="bg-surface">
              <tr>
                {["Type", "Title", "Deleted", "Auto-delete in", ""].map((h) => (
                  <th key={h} className="border-b border-border px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.kind}-${item.id}`} className="hover:bg-surface">
                  <td className="border-b border-border px-4 py-3">
                    <Badge variant="outline">{KIND_LABEL[item.kind]}</Badge>
                  </td>
                  <td className="border-b border-border px-4 py-3 text-foreground">
                    <div className="flex items-center gap-2">
                      {item.hasFile && <Paperclip size={14} className="text-muted-foreground" />}
                      <div className="flex flex-col">
                        <span className="font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-border px-4 py-3 text-foreground">{new Date(item.deletedAt).toLocaleDateString("en-SG")}</td>
                  <td className="border-b border-border px-4 py-3 text-foreground">{daysUntil(item.purgeAt)} days</td>
                  <td className="border-b border-border px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleRestore(item)} aria-label="Restore">
                        <RotateCcw size={16} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setPermanentTarget(item)} aria-label="Delete permanently">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={permanentTarget !== null}
        onOpenChange={(open) => !open && setPermanentTarget(null)}
        title="Permanently delete this item?"
        description={`"${permanentTarget?.title ?? ""}" will be permanently deleted right now. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        onConfirm={handlePermanentDelete}
      />
    </div>
  );
};
