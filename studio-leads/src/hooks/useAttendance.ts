import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { isAdminRole, type AttendanceReason, type AttendanceRecord, type AttendanceStatus, type Viewer } from "../lib/types";

const COLLECTION = "attendance";

function toAttendance(id: string, data: Record<string, any>): AttendanceRecord {
  return {
    id,
    designerId: data.designerId,
    designerName: data.designerName,
    date: data.date,
    status: data.status,
    reason: data.reason ?? null,
    notes: data.notes ?? null,
    markedBy: data.markedBy ?? null,
    markedAt: toIso(data.markedAt),
  };
}

/**
 * Either admin tier sees every record; a designer's own query is
 * constrained with where("designerId", "==", uid), matching
 * firestore.rules' list check.
 */
export const useAttendanceList = (viewer: Viewer | null) =>
  useQuery({
    queryKey: ["attendance", viewer && isAdminRole(viewer.role) ? "all" : viewer?.id],
    enabled: !!viewer,
    queryFn: async () => {
      const q = isAdminRole(viewer!.role)
        ? collection(db, COLLECTION)
        : query(collection(db, COLLECTION), where("designerId", "==", viewer!.id));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => toAttendance(d.id, d.data()));
      items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      return items;
    },
  });

export interface MarkAttendanceInput {
  designerId: string;
  designerName: string;
  date: string;
  status: AttendanceStatus;
  reason: AttendanceReason | null;
  notes: string | null;
}

/** One doc per designer per day -- marking again for the same day overwrites it. */
export const useMarkAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MarkAttendanceInput) => {
      const id = `${input.designerId}_${input.date}`;
      await setDoc(doc(db, COLLECTION, id), {
        designerId: input.designerId,
        designerName: input.designerName,
        date: input.date,
        status: input.status,
        reason: input.status === "present" ? null : input.reason,
        notes: input.notes,
        markedBy: auth.currentUser?.uid ?? null,
        markedAt: serverTimestamp(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
};
