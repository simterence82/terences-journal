import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import type { Announcement } from "../lib/types";

const COLLECTION = "announcements";
const KEY = ["announcements"] as const;

function toAnnouncement(id: string, data: Record<string, any>): Announcement {
  return {
    id,
    title: data.title,
    body: data.body,
    pinned: !!data.pinned,
    createdBy: data.createdBy ?? null,
    createdByName: data.createdByName ?? null,
    createdAt: toIso(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(data.updatedAt),
    eventDate: data.eventDate ?? null,
    eventTime: data.eventTime ?? null,
  };
}

/** Everyone (any approved role) can read; pinned first, then newest. */
export const useAnnouncementsList = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const snap = await getDocs(collection(db, COLLECTION));
      const items = snap.docs.map((d) => toAnnouncement(d.id, d.data()));
      items.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
      });
      return items;
    },
  });

export interface AnnouncementCreateInput {
  title: string;
  body: string;
  pinned: boolean;
  eventDate?: string | null;
  eventTime?: string | null;
}

export const useCreateAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AnnouncementCreateInput) => {
      const currentUser = auth.currentUser;
      await addDoc(collection(db, COLLECTION), {
        title: input.title,
        body: input.body,
        pinned: input.pinned,
        eventDate: input.eventDate ?? null,
        eventTime: input.eventTime ?? null,
        createdBy: currentUser?.uid ?? null,
        createdByName: currentUser?.displayName ?? null,
        createdAt: serverTimestamp(),
        updatedAt: null,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export interface AnnouncementUpdateInput {
  id: string;
  title?: string;
  body?: string;
  pinned?: boolean;
  eventDate?: string | null;
  eventTime?: string | null;
}

export const useUpdateAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: AnnouncementUpdateInput) => {
      await updateDoc(doc(db, COLLECTION, id), { ...updates, updatedAt: serverTimestamp() });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, COLLECTION, id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
