import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/apiClient";
import type { BlumPurchase } from "../lib/types";

const KEY = ["blum"] as const;

export const useBlumList = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<BlumPurchase[]>("/blum") });

export interface BlumCreateInput {
  orderName: string;
  amount: number;
  date: string;
  notes: string | null;
}

export const useCreateBlum = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BlumCreateInput) => apiPost<BlumPurchase>("/blum", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useUpdateBlum = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Partial<BlumCreateInput> & { paidToSeller?: boolean; reimbursed?: boolean }) =>
      apiPatch<BlumPurchase>(`/blum/${id}`, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteBlum = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: true }>(`/blum/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
