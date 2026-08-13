import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/apiClient";
import type { ScheduleEvent } from "../lib/types";

const KEY = ["schedule"] as const;

export const useScheduleList = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<ScheduleEvent[]>("/schedule") });

export interface ScheduleCreateInput {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
}

export const useCreateSchedule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleCreateInput) => apiPost<ScheduleEvent>("/schedule", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useUpdateSchedule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: number } & Partial<ScheduleCreateInput>) =>
      apiPatch<ScheduleEvent>(`/schedule/${id}`, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteSchedule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<{ success: true }>(`/schedule/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
