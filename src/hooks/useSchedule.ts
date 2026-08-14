import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { compareNullableAsc, toIso } from "../lib/firestoreUtil";
import type { ScheduleEvent } from "../lib/types";

const KEY = ["schedule"] as const;
const COLLECTION = "scheduleEvents";

function toScheduleEvent(id: string, data: Record<string, any>): ScheduleEvent {
  return {
    id,
    title: data.title,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    notes: data.notes,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
  };
}

export const useScheduleList = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, COLLECTION), where("isDeleted", "==", false)));
      const items = snap.docs.map((d) => toScheduleEvent(d.id, d.data()));
      items.sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return compareNullableAsc(a.startTime, b.startTime);
      });
      return items;
    },
  });

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
    mutationFn: async (input: ScheduleCreateInput) => {
      const ref = await addDoc(collection(db, COLLECTION), {
        ...input,
        createdBy: auth.currentUser?.uid ?? null,
        createdAt: serverTimestamp(),
        isDeleted: false,
      });
      const snap = await getDoc(ref);
      return toScheduleEvent(snap.id, snap.data()!);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useUpdateSchedule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<ScheduleCreateInput>) => {
      const ref = doc(db, COLLECTION, id);
      await updateDoc(ref, updates);
      const snap = await getDoc(ref);
      return toScheduleEvent(snap.id, snap.data()!);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteSchedule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, COLLECTION, id), { isDeleted: true, deletedAt: serverTimestamp() });
      return { success: true as const };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
