import React, { useMemo, useState } from "react";
import { Archive, ExternalLink, File as FileIcon, FileText, Image as ImageIcon } from "lucide-react";
import { useFilesList } from "../hooks/useFiles";
import { useAuth } from "../lib/AuthContext";
import { FILE_CATEGORIES, FILE_CATEGORY_LABELS, type ArchivedFile, type FileCategory } from "../lib/types";
import { Badge } from "../components/Badge";
import { Tabs } from "../components/Tabs";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

type Tab = "all" | FileCategory;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function iconFor(contentType: string) {
  if (contentType === "application/pdf") return <FileText size={18} />;
  if (contentType.startsWith("image/")) return <ImageIcon size={18} />;
  return <FileIcon size={18} />;
}

export const FilesArchivePage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;

  const filesQuery = useFilesList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const files = filesQuery.data ?? [];

  const [tab, setTab] = useState<Tab>("all");
  const visibleFiles = useMemo(() => (tab === "all" ? files : files.filter((f) => f.category === tab)), [files, tab]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Files Archive</h1>
        <p className="mt-1 text-[0.9375rem] text-faint-ink">
          Scanned files and photos uploaded through Attendance -- MCs today, more document types as they come up.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        options={[
          { value: "all", label: "All", count: files.length },
          ...FILE_CATEGORIES.map((c) => ({ value: c, label: FILE_CATEGORY_LABELS[c], count: files.filter((f) => f.category === c).length })),
        ]}
        className="flex-wrap"
      />

      {filesQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 76 }} />
          ))}
        </div>
      ) : visibleFiles.length === 0 ? (
        <EmptyState icon={<Archive size={28} />} message="Nothing here yet." />
      ) : (
        <div className="flex flex-col gap-3">
          {visibleFiles.map((f) => (
            <FileRow key={f.id} file={f} />
          ))}
        </div>
      )}
    </div>
  );
};

const FileRow: React.FC<{ file: ArchivedFile }> = ({ file }) => (
  <a
    href={file.downloadURL}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-4 rounded-xl border border-line bg-panel p-4 shadow-sm transition-shadow hover:shadow-md"
  >
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-wash)] text-brand">
      {iconFor(file.contentType)}
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="truncate text-[0.9375rem] font-semibold text-ink">{file.fileName}</span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint-ink">
        <Badge variant="outline">{FILE_CATEGORY_LABELS[file.category]}</Badge>
        <span>{file.uploadedByName ?? "Studio"}</span>
        <span>{formatDate(file.createdAt)}</span>
        <span>{formatSize(file.sizeBytes)}</span>
      </div>
    </div>
    <ExternalLink size={16} className="shrink-0 text-faint-ink" />
  </a>
);
