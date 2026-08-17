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
import type { BlumPurchase } from "../lib/types";

const COLLECTION = "blumPurchases";

function toBlumPurchase(id: string, data: Record<string, any>): BlumPurchase {
  return {
    id,
    orderName: data.orderName,
    amount: data.amount,
    date: data.date,
    paidToSeller: data.paidToSeller,
    invoiceRequested: data.invoiceRequested,
    reimbursed: data.reimbursed,
    notes: data.notes,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
  };
}

export const useBlumList = () =>
  useCollectionQuery(
    () => query(collection(db, COLLECTION), where("isDeleted", "==", false)),
    toBlumPurchase,
    (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)
  );

export interface BlumCreateInput {
  orderName: string;
  amount: number;
  date: string;
  notes: string | null;
}

export const useCreateBlum = () =>
  useMutation({
    mutationFn: async (input: BlumCreateInput) => {
      const ref = await addDoc(collection(db, COLLECTION), {
        ...input,
        paidToSeller: false,
        invoiceRequested: false,
        reimbursed: false,
        createdBy: auth.currentUser?.uid ?? null,
        createdAt: serverTimestamp(),
        isDeleted: false,
      });
      const snap = await getDoc(ref);
      return toBlumPurchase(snap.id, snap.data()!);
    },
  });

export const useUpdateBlum = () =>
  useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<BlumCreateInput> & { paidToSeller?: boolean; invoiceRequested?: boolean; reimbursed?: boolean }) => {
      const ref = doc(db, COLLECTION, id);
      await updateDoc(ref, updates);
      const snap = await getDoc(ref);
      return toBlumPurchase(snap.id, snap.data()!);
    },
  });

export const useDeleteBlum = () =>
  useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, COLLECTION, id), { isDeleted: true, deletedAt: serverTimestamp() });
      return { success: true as const };
    },
  });
