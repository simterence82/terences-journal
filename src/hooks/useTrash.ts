import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../lib/apiClient";
import type { TrashItem, TrashKind } from "../lib/types";

const KEY = ["trash"] as const;
// Restoring/permanently deleting a trashed item can bring back (or remove for
// good) a row that other pages list -- invalidate everything so those pages
// reflect it immediately.
const AFFECTED_KEYS = [KEY, ["lighting"], ["blum"], ["tasks"], ["issues"], ["schedule"], ["files-archive"]] as const;

export const useTrashList = () => useQuery({ queryKey: KEY, queryFn: () => apiGet<TrashItem[]>("/trash") });

export const useRestoreTrashItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: TrashKind; id: number }) => apiPost<{ success: true }>("/trash/restore", { kind, id }),
    onSuccess: () => AFFECTED_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key })),
  });
};

export const usePermanentDeleteTrashItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: TrashKind; id: number }) => apiPost<{ success: true }>("/trash/permanent-delete", { kind, id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
