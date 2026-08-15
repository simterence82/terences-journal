import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { isAdminRole, type AttendanceReason, type AttendanceRecord, type AttendanceStatus, type LeaveApprovalStatus, type Viewer } from "../lib/types";

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
    leaveApproval: data.leaveApproval ?? null,
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

/**
 * Every approved user (any role) can see who's on leave company-wide, even
 * though they still can't see anyone else's present/late/absent records --
 * see firestore.rules. Only *approved* leave shows here -- a designer's
 * pending or rejected application stays invisible to everyone but
 * themselves and admins until an admin acts on it. The query itself must
 * filter on both fields for the list rule to be provable (Firestore may
 * prompt to create a composite index for this pair on first deploy).
 */
export const useLeaveCalendarList = () =>
  useQuery({
    queryKey: ["attendance", "leaveCalendar"],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, COLLECTION), where("status", "==", "leave"), where("leaveApproval", "==", "approved"))
      );
      return snap.docs.map((d) => toAttendance(d.id, d.data()));
    },
  });

export interface MarkAttendanceInput {
  designerId: string;
  designerName: string;
  date: string;
  status: AttendanceStatus;
  reason: AttendanceReason | null;
  notes: string | null;
  /** "approved" when an admin marks directly; "pending" when a designer
      self-applies (see Attendance.tsx) -- null for non-"leave" statuses. */
  leaveApproval: LeaveApprovalStatus | null;
}

/**
 * One doc per designer per day -- marking again for the same day overwrites
 * it. Also doubles as a designer's "apply for leave" write: firestore.rules
 * lets a designer create (not overwrite) their own doc when status ==
 * "leave", which setDoc naturally routes to since the doc doesn't exist yet
 * for a day nobody has recorded. Applying for an already-recorded day fails
 * -- surfaced to the caller as a rejected promise.
 */
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
        leaveApproval: input.leaveApproval,
        markedBy: auth.currentUser?.uid ?? null,
        markedAt: serverTimestamp(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
};

/** Admin/super admin approving or rejecting a designer's pending leave application. */
export const useSetLeaveApproval = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approval }: { id: string; approval: "approved" | "rejected" }) => {
      await updateDoc(doc(db, COLLECTION, id), { leaveApproval: approval });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
};
