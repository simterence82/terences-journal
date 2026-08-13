import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "../lib/apiClient";
import type { User } from "../lib/types";

const KEY = ["users"] as const;

export const useUsersList = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<User[]>("/users") });

export interface UserCreateInput {
  displayName: string;
  email: string;
  password: string;
  role: "admin" | "member";
}

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UserCreateInput) => apiPost<User>("/users", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: true }>(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
