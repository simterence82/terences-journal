import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiDelete, apiUpload } from "../lib/apiClient";
import type { Issue } from "../lib/types";

const KEY = ["issues"] as const;

export const useIssuesList = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<Issue[]>("/issues") });

export interface IssueCreateInput {
  title: string;
  description: string | null;
  file?: File | null;
}

export const useCreateIssue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IssueCreateInput) => {
      const form = new FormData();
      form.set("title", input.title);
      if (input.description) form.set("description", input.description);
      if (input.file) form.set("file", input.file);
      return apiUpload<Issue>("/issues", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export interface IssueUpdateInput {
  id: number;
  title?: string;
  description?: string | null;
  resolved?: boolean;
}

export const useUpdateIssue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: IssueUpdateInput) => apiPatch<Issue>(`/issues/${id}`, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteIssue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<{ success: true }>(`/issues/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export function downloadIssueFile(id: number) {
  window.open(`/api/issues/${id}/file`, "_blank", "noopener,noreferrer");
}
