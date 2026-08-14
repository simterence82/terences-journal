import React from "react";
import { Download, FolderArchive, FileText } from "lucide-react";
import { useFilesArchiveList } from "../hooks/useFilesArchive";
import { downloadTaskFile } from "../hooks/useTasks";
import { downloadIssueFile } from "../hooks/useIssues";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";

export const FilesArchivePage: React.FC = () => {
  const listQuery = useFilesArchiveList();
  const files = listQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Files Archive</h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">Every file uploaded via Outstanding Tasks and Outstanding Issues, in one place</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow">
        {listQuery.isLoading ? (
          <div className="p-6">
            <Skeleton style={{ height: 200 }} />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <FolderArchive size={32} />
            <p>No files uploaded yet.</p>
          </div>
        ) : (
          <table className="w-full whitespace-nowrap text-[0.8125rem]">
            <thead>
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
        )}
      </div>
    </div>
  );
};
