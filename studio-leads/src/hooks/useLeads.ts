import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { CLOSED_LEAD_STATUSES, isAdminRole, type Lead, type LeadShare, type LeadStatus, type Viewer } from "../lib/types";

const COLLECTION = "leads";

function toLead(id: string, data: Record<string, any>): Lead {
  return {
    id,
    clientName: data.clientName,
    phone: data.phone ?? null,
    email: data.email ?? null,
    source: data.source,
    projectType: data.projectType,
    address: data.address ?? null,
    budget: data.budget ?? null,
    notes: data.notes ?? null,
    referredBy: data.referredBy ?? null,
    assignedTo: data.assignedTo ?? null,
    assignedToName: data.assignedToName ?? null,
    status: data.status,
    quotationAmount: data.quotationAmount ?? null,
    contractAmount: data.contractAmount ?? null,
    gstApplicable: data.gstApplicable ?? null,
    isShared: data.isShared ?? null,
    sharedWith: data.sharedWith ?? [],
    nextFollowUpDate: data.nextFollowUpDate ?? null,
    firstContactedAt: toIso(data.firstContactedAt),
    closedAt: toIso(data.closedAt),
    createdBy: data.createdBy ?? null,
    createdByName: data.createdByName ?? null,
    createdAt: toIso(data.createdAt) ?? new Date(0).toISOString(),
    assignedAt: toIso(data.assignedAt),
  };
}

/**
 * A designer's leads are three separate queries merged client-side: their
 * own (where assignedTo == uid), the open-to-designers pool (where
 * assignedTo == null), and any lead shared with them (where sharedWithIds
 * array-contains uid) -- required for firestore.rules' list rule (which
 * checks each returned doc) to allow any of these reads at all. Firestore
 * doesn't support "in" with null, so this can't be a single query. Admins
 * get every lead in one query.
 */
export const useLeadsList = (viewer: Viewer | null) =>
  useQuery({
    queryKey: ["leads", viewer && isAdminRole(viewer.role) ? "all" : viewer?.id],
    enabled: !!viewer,
    queryFn: async () => {
      let docs;
      if (isAdminRole(viewer!.role)) {
        docs = (await getDocs(collection(db, COLLECTION))).docs;
      } else {
        const [ownSnap, openSnap, sharedSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTION), where("assignedTo", "==", viewer!.id))),
          getDocs(query(collection(db, COLLECTION), where("assignedTo", "==", null))),
          getDocs(query(collection(db, COLLECTION), where("sharedWithIds", "array-contains", viewer!.id))),
        ]);
        const byId = new Map<string, (typeof ownSnap.docs)[number]>();
        for (const d of [...ownSnap.docs, ...openSnap.docs, ...sharedSnap.docs]) byId.set(d.id, d);
        docs = [...byId.values()];
      }
      const items = docs.map((d) => toLead(d.id, d.data()));
      items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      return items;
    },
  });

export interface LeadCreateInput {
  clientName: string;
  phone: string | null;
  email: string | null;
  source: string;
  projectType: string;
  address: string | null;
  budget: number | null;
  notes: string | null;
  referredBy: string | null;
  /** null = open to designers (unclaimed, any designer can claim it). */
  assignedTo: string | null;
  assignedToName: string | null;
  nextFollowUpDate: string | null;
}

export const useCreateLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadCreateInput) => {
      const currentUser = auth.currentUser;
      await addDoc(collection(db, COLLECTION), {
        clientName: input.clientName,
        phone: input.phone,
        email: input.email,
        source: input.source,
        projectType: input.projectType,
        address: input.address,
        budget: input.budget,
        notes: input.notes,
        referredBy: input.referredBy,
        assignedTo: input.assignedTo,
        assignedToName: input.assignedToName,
        status: "new" as LeadStatus,
        quotationAmount: null,
        contractAmount: null,
        gstApplicable: null,
        isShared: null,
        sharedWith: [],
        sharedWithIds: [],
        nextFollowUpDate: input.nextFollowUpDate,
        firstContactedAt: null,
        closedAt: null,
        createdBy: currentUser?.uid ?? null,
        createdByName: currentUser?.displayName ?? null,
        createdAt: serverTimestamp(),
        assignedAt: serverTimestamp(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
};

export interface LeadUpdateInput {
  id: string;
  clientName?: string;
  phone?: string | null;
  email?: string | null;
  source?: string;
  projectType?: string;
  address?: string | null;
  budget?: number | null;
  notes?: string | null;
  /** null = revert to open-to-designers (admin only, in practice). */
  assignedTo?: string | null;
  assignedToName?: string | null;
  status?: LeadStatus;
  quotationAmount?: number | null;
  contractAmount?: number | null;
  gstApplicable?: boolean | null;
  isShared?: boolean | null;
  sharedWith?: LeadShare[];
  nextFollowUpDate?: string | null;
}

export const useUpdateLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: LeadUpdateInput) => {
      const ref = doc(db, COLLECTION, id);
      const payload: Record<string, unknown> = { ...updates };

      // Keep the flat id array (sharedWithIds) in sync with sharedWith --
      // it's what firestore.rules and this hook's own query actually
      // filter on, since Firestore can't query inside an array of objects.
      if (updates.sharedWith !== undefined) {
        payload.sharedWithIds = updates.sharedWith.map((s) => s.designerId);
      }

      // Reassigning restarts the response-time clock for that designer.
      // (Reverting to open/null doesn't need a clock -- claiming does, see
      // useClaimLead.)
      if (updates.assignedTo) {
        payload.assignedAt = serverTimestamp();
      }

      if (updates.status) {
        if (CLOSED_LEAD_STATUSES.includes(updates.status)) {
          payload.closedAt = serverTimestamp();
        } else {
          payload.closedAt = null;
        }
      }

      await updateDoc(ref, payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
};

/** A designer claims an open-to-designers lead, assigning it to themselves. */
export const useClaimLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Not signed in");
      await updateDoc(doc(db, COLLECTION, leadId), {
        assignedTo: currentUser.uid,
        assignedToName: currentUser.displayName,
        assignedAt: serverTimestamp(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
};

export const useDeleteLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, COLLECTION, id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
};

export async function markFirstContactIfNeeded(leadId: string): Promise<void> {
  const ref = doc(db, COLLECTION, leadId);
  const snap = await getDoc(ref);
  if (snap.exists() && !snap.data().firstContactedAt) {
    await updateDoc(ref, { firstContactedAt: serverTimestamp() });
  }
}
