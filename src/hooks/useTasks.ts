import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiDelete, apiUpload } from "../lib/apiClient";
import type { Task, TaskPriority } from "../lib/types";

const KEY = ["tasks"] as const;

export const useTasksList = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<Task[]>("/tasks") });

export interface TaskCreateInput {
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  assignedTo: string | null;
  file?: File | null;
}

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskCreateInput) => {
      const form = new FormData();
      form.set("title", input.title);
      if (input.description) form.set("description", input.description);
      if (input.dueDate) form.set("dueDate", input.dueDate);
      form.set("priority", input.priority);
      if (input.assignedTo) form.set("assignedTo", input.assignedTo);
      if (input.file) form.set("file", input.file);
      return apiUpload<Task>("/tasks", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export interface TaskUpdateInput {
  id: string;
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  assignedTo?: string | null;
  done?: boolean;
}

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: TaskUpdateInput) => apiPatch<Task>(`/tasks/${id}`, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: true }>(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export function downloadTaskFile(id: string) {
  window.open(`/api/tasks/${id}/file`, "_blank", "noopener,noreferrer");
}
