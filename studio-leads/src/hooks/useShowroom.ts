import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { CLOSED_SHOWROOM_STATUSES, isAdminRole, type ShowroomCategory, type ShowroomItem, type ShowroomStatus, type Viewer } from "../lib/types";

const COLLECTION = "showroomItems";
const KEY = ["showroomItems"] as const;

function toShowroomItem(id: string, data: Record<string, any>): ShowroomItem {
  return {
    id,
    category: data.category,
    title: data.title,
    description: data.description ?? null,
    status: data.status,
    notes: data.notes ?? null,
    reportedBy: data.reportedBy ?? null,
    reportedByName: data.reportedByName ?? null,
    createdAt: toIso(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(data.updatedAt),
    resolvedAt: toIso(data.resolvedAt),
    scheduledAt: data.scheduledAt ?? null,
  };
}

/**
 * Either admin tier sees every item. A designer's query is constrained to
 * where("category","==","faulty_report") -- required for firestore.rules'
 * list rule to allow the read at all, and matches the product decision
 * that designers only see/report issues, not the rest of the tracker.
 */
export const useShowroomItemsList = (viewer: Viewer | null) =>
  useQuery({
    queryKey: [...KEY, viewer && isAdminRole(viewer.role) ? "all" : "faulty_report"],
    enabled: !!viewer,
    queryFn: async () => {
      const q = isAdminRole(viewer!.role)
        ? collection(db, COLLECTION)
        : query(collection(db, COLLECTION), where("category", "==", "faulty_report"));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => toShowroomItem(d.id, d.data()));
      items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      return items;
    },
  });

export interface ShowroomItemCreateInput {
  category: ShowroomCategory;
  title: string;
  description: string | null;
  status: ShowroomStatus;
  notes: string | null;
  /** Only meaningful for category "aircon_servicing" + status "servicing_scheduled". */
  scheduledAt?: string | null;
}

export const useCreateShowroomItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ShowroomItemCreateInput) => {
      const currentUser = auth.currentUser;
      await addDoc(collection(db, COLLECTION), {
        ...input,
        reportedBy: currentUser?.uid ?? null,
        reportedByName: currentUser?.displayName ?? null,
        createdAt: serverTimestamp(),
        updatedAt: null,
        resolvedAt: CLOSED_SHOWROOM_STATUSES.includes(input.status) ? serverTimestamp() : null,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export interface ShowroomItemUpdateInput {
  id: string;
  category?: ShowroomCategory;
  title?: string;
  description?: string | null;
  status?: ShowroomStatus;
  notes?: string | null;
  scheduledAt?: string | null;
}

export const useUpdateShowroomItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: ShowroomItemUpdateInput) => {
      const payload: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
      if (updates.status) {
        payload.resolvedAt = CLOSED_SHOWROOM_STATUSES.includes(updates.status) ? serverTimestamp() : null;
      }
      await updateDoc(doc(db, COLLECTION, id), payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteShowroomItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, COLLECTION, id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
