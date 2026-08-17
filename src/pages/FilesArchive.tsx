import React from "react";
import { Download, FolderArchive, FileText } from "lucide-react";
import { useFilesArchiveList } from "../hooks/useFilesArchive";
import { downloadTaskFile } from "../hooks/useTasks";
import { downloadIssueFile } from "../hooks/useIssues";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";

export const FilesArchivePage: React.FC = () => {
  const listQuery = useFilesArchiveList();
  const files = listQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Files Archive</h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">Every file uploaded via Outstanding Tasks and Outstanding Issues, in one place</p>
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
                  {["File", "Source", "From", "Uploaded", ""].map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={`${file.kind}-${file.id}`} className="hover:bg-surface">
                    <td className="border-b border-border px-4 py-3 text-foreground">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-muted-foreground" />
                        {file.fileName}
                      </div>
                    </td>
                    <td className="border-b border-border px-4 py-3">
                      <Badge variant={file.kind === "tasks" ? "primary" : "secondary"}>{file.kind === "tasks" ? "Task" : "Issue"}</Badge>
                    </td>
                    <td className="max-w-[16rem] truncate border-b border-border px-4 py-3 text-foreground">{file.sourceTitle}</td>
                    <td className="border-b border-border px-4 py-3 text-foreground">{new Date(file.createdAt).toLocaleDateString("en-SG")}</td>
                    <td className="border-b border-border px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          file.kind === "tasks"
                            ? downloadTaskFile(file.id, file.fileName, file.fileType)
                            : downloadIssueFile(file.id, file.fileName, file.fileType)
                        }
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Download size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {files.map((file) => (
              <div key={`${file.kind}-${file.id}`} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow">
                <FileText size={18} className="shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-foreground">{file.fileName}</span>
                  <span className="truncate text-xs text-muted-foreground">{file.sourceTitle}</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={file.kind === "tasks" ? "primary" : "secondary"}>{file.kind === "tasks" ? "Task" : "Issue"}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(file.createdAt).toLocaleDateString("en-SG")}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    file.kind === "tasks"
                      ? downloadTaskFile(file.id, file.fileName, file.fileType)
                      : downloadIssueFile(file.id, file.fileName, file.fileType)
                  }
                  className="shrink-0 text-primary"
                  aria-label={`Download ${file.fileName}`}
                >
                  <Download size={18} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
