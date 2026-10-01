import { useMutation } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDoc,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { useCollectionQuery } from "../lib/useFirestoreQuery";
import type { LightingCostItem, LightingFinancials, LightingPurchase } from "../lib/types";

const COLLECTION = "lightingPurchases";
const FINANCIALS_COLLECTION = "lightingFinancials";

function toLightingPurchase(id: string, data: Record<string, any>): LightingPurchase {
  return {
    id,
    brand: data.brand,
    clientName: data.clientName,
    address: data.address,
    date: data.date,
    paidToSeller: data.paidToSeller,
    reimbursed: data.reimbursed,
    notes: data.notes,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
  };
}

function toLightingFinancials(id: string, data: Record<string, any>): LightingFinancials {
  // Older docs only ever had a single `cost` number; wrap it as one
  // vendor-less cost line so the multi-vendor cost breakdown always has
  // something to render.
  const costs: LightingCostItem[] =
    Array.isArray(data.costs) && data.costs.length > 0
      ? data.costs.map((c: any) => ({ vendor: c.vendor ?? null, amount: c.amount ?? 0 }))
      : [{ vendor: null, amount: data.cost ?? 0 }];
  return {
    id,
    costs,
    cost: costs.reduce((sum, c) => sum + c.amount, 0),
    selling: data.selling ?? 0,
    commissionGiven: data.commissionGiven ?? 0,
    commissionRecipient: data.commissionRecipient ?? null,
  };
}

export const useLightingList = () =>
  useCollectionQuery(
    () => query(collection(db, COLLECTION), where("isDeleted", "==", false)),
    toLightingPurchase,
    (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)
  );

// Super Admin only -- the caller must pass whether the current user is
// actually allowed to read this before enabling it, so Admin never even
// attempts (and fails) the subscription.
export const useLightingFinancialsList = (enabled: boolean) =>
  useCollectionQuery(
    () => collection(db, FINANCIALS_COLLECTION),
    toLightingFinancials,
    () => 0,
    { enabled }
  );

export interface LightingCreateInput {
  brand: string;
  clientName: string;
  address: string;
  date: string;
  commissionGiven: number;
  commissionRecipient: string | null;
  costs: LightingCostItem[];
  selling: number;
  notes: string | null;
}

// Super Admin only (enforced in firestore.rules: creating lightingPurchases
// requires isSuperAdmin()) -- Admin cannot add Smart Lighting entries at
// all, so there's no "write financials but can't read them back" path to
// support here.
export const useCreateLighting = () =>
  useMutation({
    mutationFn: async (input: LightingCreateInput) => {
      const opRef = doc(collection(db, COLLECTION));
      const finRef = doc(db, FINANCIALS_COLLECTION, opRef.id);
      const batch = writeBatch(db);
      batch.set(opRef, {
        brand: input.brand,
        clientName: input.clientName,
        address: input.address,
        date: input.date,
        notes: input.notes,
        paidToSeller: false,
        reimbursed: false,
        createdBy: auth.currentUser?.uid ?? null,
        createdAt: serverTimestamp(),
        isDeleted: false,
      });
      batch.set(finRef, {
        costs: input.costs,
        cost: input.costs.reduce((sum, c) => sum + c.amount, 0),
        selling: input.selling,
        commissionGiven: input.commissionGiven,
        commissionRecipient: input.commissionRecipient,
      });
      await batch.commit();
      const snap = await getDoc(opRef);
      return toLightingPurchase(snap.id, snap.data()!);
    },
  });

export type LightingUpdateInput = Partial<LightingCreateInput> & { paidToSeller?: boolean; reimbursed?: boolean };

const FINANCIAL_KEYS = new Set(["commissionGiven", "commissionRecipient", "costs", "selling"]);

// Splits the update across the two documents by field name -- a plain
// checkbox toggle (paidToSeller/reimbursed) only ever touches
// lightingPurchases; a Super Admin's full edit also touches
// lightingFinancials. Admin-submitted updates never include a financial key
// in the first place (the Edit dialog doesn't offer those fields to her),
// so this never attempts a write she lacks permission for.
export const useUpdateLighting = () =>
  useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & LightingUpdateInput) => {
      const operational: Record<string, unknown> = {};
      const financial: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) continue;
        if (FINANCIAL_KEYS.has(key)) financial[key] = value;
        else operational[key] = value;
      }
      if (Array.isArray(financial.costs)) {
        financial.cost = (financial.costs as LightingCostItem[]).reduce((sum, c) => sum + c.amount, 0);
      }

      const writes: Promise<unknown>[] = [];
      if (Object.keys(operational).length > 0) writes.push(updateDoc(doc(db, COLLECTION, id), operational));
      if (Object.keys(financial).length > 0) writes.push(updateDoc(doc(db, FINANCIALS_COLLECTION, id), financial));
      await Promise.all(writes);
      return { success: true as const };
    },
  });

export const useDeleteLighting = () =>
  useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, COLLECTION, id), { isDeleted: true, deletedAt: serverTimestamp() });
      return { success: true as const };
    },
  });
