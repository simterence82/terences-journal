import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import type { SalesTarget } from "../lib/types";

const COLLECTION = "salesTargets";
const KEY = ["salesTargets"] as const;

function toSalesTarget(id: string, data: Record<string, any>): SalesTarget {
  return {
    id,
    designerId: data.designerId,
    designerName: data.designerName,
    monthKey: data.monthKey,
    targetAmount: data.targetAmount ?? 0,
    setBy: data.setBy ?? null,
    setByName: data.setByName ?? null,
    updatedAt: toIso(data.updatedAt),
  };
}

/** Admin-only collection (see firestore.rules) -- no viewer scoping needed,
    the KPI page that calls this is itself route-gated to admin/super admin. */
export const useSalesTargetsList = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const snap = await getDocs(collection(db, COLLECTION));
      return snap.docs.map((d) => toSalesTarget(d.id, d.data()));
    },
  });

export interface SetSalesTargetInput {
  designerId: string;
  designerName: string;
  monthKey: string;
  targetAmount: number;
}

/** One doc per designer per month -- setting again for the same month
    overwrites it, same "one doc per key" shape as attendance. */
export const useSetSalesTarget = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetSalesTargetInput) => {
      const id = `${input.designerId}_${input.monthKey}`;
      const currentUser = auth.currentUser;
      await setDoc(doc(db, COLLECTION, id), {
        designerId: input.designerId,
        designerName: input.designerName,
        monthKey: input.monthKey,
        targetAmount: input.targetAmount,
        setBy: currentUser?.uid ?? null,
        setByName: currentUser?.displayName ?? null,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
