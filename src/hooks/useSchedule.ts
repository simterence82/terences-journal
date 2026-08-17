import { useMutation } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { compareNullableAsc, toIso } from "../lib/firestoreUtil";
import { useCollectionQuery } from "../lib/useFirestoreQuery";
import type { ScheduleEvent } from "../lib/types";

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
  useCollectionQuery(
    () => query(collection(db, COLLECTION), where("isDeleted", "==", false)),
    toScheduleEvent,
    (a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return compareNullableAsc(a.startTime, b.startTime);
    }
  );

export interface ScheduleCreateInput {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
}

export const useCreateSchedule = () =>
  useMutation({
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
  });

export const useUpdateSchedule = () =>
  useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<ScheduleCreateInput>) => {
      const ref = doc(db, COLLECTION, id);
      await updateDoc(ref, updates);
      const snap = await getDoc(ref);
      return toScheduleEvent(snap.id, snap.data()!);
    },
  });

export const useDeleteSchedule = () =>
  useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, COLLECTION, id), { isDeleted: true, deletedAt: serverTimestamp() });
      return { success: true as const };
    },
  });
