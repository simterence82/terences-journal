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
import { toIso } from "../lib/firestoreUtil";
import { useCollectionQuery } from "../lib/useFirestoreQuery";
import type { LightingPurchase } from "../lib/types";

const COLLECTION = "lightingPurchases";

function toLightingPurchase(id: string, data: Record<string, any>): LightingPurchase {
  return {
    id,
    brand: data.brand,
    clientName: data.clientName,
    address: data.address,
    date: data.date,
    commissionGiven: data.commissionGiven,
    commissionRecipient: data.commissionRecipient,
    cost: data.cost,
    selling: data.selling,
    paidToSeller: data.paidToSeller,
    reimbursed: data.reimbursed,
    notes: data.notes,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
  };
}

export const useLightingList = () =>
  useCollectionQuery(
    () => query(collection(db, COLLECTION), where("isDeleted", "==", false)),
    toLightingPurchase,
    (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)
  );

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

export const useCreateLighting = () =>
  useMutation({
    mutationFn: async (input: LightingCreateInput) => {
      const ref = await addDoc(collection(db, COLLECTION), {
        ...input,
        paidToSeller: false,
        reimbursed: false,
        createdBy: auth.currentUser?.uid ?? null,
        createdAt: serverTimestamp(),
        isDeleted: false,
      });
      const snap = await getDoc(ref);
      return toLightingPurchase(snap.id, snap.data()!);
    },
  });

export const useUpdateLighting = () =>
  useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<LightingCreateInput> & { paidToSeller?: boolean; reimbursed?: boolean }) => {
      const ref = doc(db, COLLECTION, id);
      await updateDoc(ref, updates);
      const snap = await getDoc(ref);
      return toLightingPurchase(snap.id, snap.data()!);
    },
  });

export const useDeleteLighting = () =>
  useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, COLLECTION, id), { isDeleted: true, deletedAt: serverTimestamp() });
      return { success: true as const };
    },
  });
