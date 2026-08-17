import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { isAdminRole, type SalesTarget, type Viewer } from "../lib/types";

const COLLECTION = "salesTargets";

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

/** Either admin tier sees every designer's targets (the KPI page's Sales
    Target panel); a designer only ever sees their own (their read-only
    Personal Sales Figure page) -- see firestore.rules. */
export const useSalesTargetsList = (viewer: Viewer | null) =>
  useQuery({
    queryKey: ["salesTargets", viewer && isAdminRole(viewer.role) ? "all" : viewer?.id],
    enabled: !!viewer,
    queryFn: async () => {
      const snap = isAdminRole(viewer!.role)
        ? await getDocs(collection(db, COLLECTION))
        : await getDocs(query(collection(db, COLLECTION), where("designerId", "==", viewer!.id)));
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salesTargets"] }),
  });
};
