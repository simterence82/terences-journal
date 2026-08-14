import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/apiClient";
import type { LightingPurchase } from "../lib/types";

const KEY = ["lighting"] as const;

export const useLightingList = () =>
  useQuery({ queryKey: KEY, queryFn: () => apiGet<LightingPurchase[]>("/lighting") });

export interface LightingCreateInput {
  brand: string;
  clientName: string;
  address: string;
  date: string;
  commissionGiven: number;
  commissionRecipient: string | null;
  cost: number;
  selling: number;
  notes: string | null;
}

export const useCreateLighting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LightingCreateInput) => apiPost<LightingPurchase>("/lighting", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useUpdateLighting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Partial<LightingCreateInput> & { paidToSeller?: boolean; reimbursed?: boolean }) =>
      apiPatch<LightingPurchase>(`/lighting/${id}`, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteLighting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: true }>(`/lighting/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
