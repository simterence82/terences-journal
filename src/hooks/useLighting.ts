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
import { CLAIMED_KEYS, isBoth, readDual } from "../lib/dualConfirm";
import { LIGHTING_SCOPES, type LightingScope } from "../lib/lightingScope";
import type { LightingCostItem, LightingFinancials, LightingPurchase } from "../lib/types";


function toLightingPurchase(id: string, data: Record<string, any>): LightingPurchase {
  const claimed = readDual(data, CLAIMED_KEYS);
  return {
    id,
    brand: data.brand,
    clientName: data.clientName,
    address: data.address,
    date: data.date,
    paidToSeller: data.paidToSeller,
    reimbursed: isBoth(claimed),
    reimbursedAdmin: claimed.admin,
    reimbursedSuper: claimed.superadmin,
    selling: data.selling ?? 0,
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
    commissionPaid: data.commissionPaid ?? false,
  };
}

// Every hook below takes a scope: "lighting" (Smart Lighting, the default) or
// "misc" (Miscellaneous Claims) -- the same shape of record kept in its own
// pair of collections.
export const useLightingList = (scope: LightingScope = "lighting") =>
  useCollectionQuery(
    () => query(collection(db, LIGHTING_SCOPES[scope].purchases), where("isDeleted", "==", false)),
    toLightingPurchase,
    (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)
  );

// Super Admin only -- the caller must pass whether the current user is
// actually allowed to read this before enabling it, so Admin never even
// attempts (and fails) the subscription.
export const useLightingFinancialsList = (enabled: boolean, scope: LightingScope = "lighting") =>
  useCollectionQuery(
    () => collection(db, LIGHTING_SCOPES[scope].financials),
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
export const useCreateLighting = (scope: LightingScope = "lighting") =>
  useMutation({
    mutationFn: async (input: LightingCreateInput) => {
      const opRef = doc(collection(db, LIGHTING_SCOPES[scope].purchases));
      const finRef = doc(db, LIGHTING_SCOPES[scope].financials, opRef.id);
      const batch = writeBatch(db);
      batch.set(opRef, {
        brand: input.brand,
        clientName: input.clientName,
        address: input.address,
        date: input.date,
        notes: input.notes,
        selling: input.selling,
        paidToSeller: false,
        reimbursed: false,
        reimbursedAdmin: false,
        reimbursedSuper: false,
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
        commissionPaid: false,
      });
      await batch.commit();
      const snap = await getDoc(opRef);
      return toLightingPurchase(snap.id, snap.data()!);
    },
  });

export type LightingUpdateInput = Partial<LightingCreateInput> & {
  paidToSeller?: boolean;
  reimbursed?: boolean;
  reimbursedAdmin?: boolean;
  reimbursedSuper?: boolean;
  commissionPaid?: boolean;
};

const FINANCIAL_KEYS = new Set(["commissionGiven", "commissionRecipient", "commissionPaid", "costs", "selling"]);

// Splits the update across the two documents by field name -- a plain
// checkbox toggle (paidToSeller/reimbursed) only ever touches
// lightingPurchases; a Super Admin's full edit also touches
// lightingFinancials. Admin-submitted updates never include a financial key
// in the first place (the Edit dialog doesn't offer those fields to her),
// so this never attempts a write she lacks permission for.
export const useUpdateLighting = (scope: LightingScope = "lighting") =>
  useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & LightingUpdateInput) => {
      const operational: Record<string, unknown> = {};
      const financial: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) continue;
        if (FINANCIAL_KEYS.has(key)) financial[key] = value;
        else operational[key] = value;
      }
      // Keep the readable copy of the selling price in step with the Super Admin one.
      if (typeof financial.selling === "number") operational.selling = financial.selling;
      if (Array.isArray(financial.costs)) {
        financial.cost = (financial.costs as LightingCostItem[]).reduce((sum, c) => sum + c.amount, 0);
      }

      const writes: Promise<unknown>[] = [];
      if (Object.keys(operational).length > 0) writes.push(updateDoc(doc(db, LIGHTING_SCOPES[scope].purchases, id), operational));
      if (Object.keys(financial).length > 0) writes.push(updateDoc(doc(db, LIGHTING_SCOPES[scope].financials, id), financial));
      await Promise.all(writes);
      return { success: true as const };
    },
  });

export const useDeleteLighting = (scope: LightingScope = "lighting") =>
  useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, LIGHTING_SCOPES[scope].purchases, id), { isDeleted: true, deletedAt: serverTimestamp() });
      return { success: true as const };
    },
  });
