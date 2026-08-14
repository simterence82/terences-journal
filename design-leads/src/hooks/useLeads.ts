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
import { CLOSED_LEAD_STATUSES, type Lead, type LeadStatus } from "../lib/types";

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
    assignedTo: data.assignedTo ?? null,
    assignedToName: data.assignedToName ?? null,
    status: data.status,
    quotationAmount: data.quotationAmount ?? null,
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
 * Every designer's own leads query is constrained with where("assignedTo",
 * "==", uid) -- required for firestore.rules' list rule (which checks each
 * returned doc's assignedTo) to allow the read at all. Admins get every
 * lead.
 */
export const useLeadsList = (viewer: { id: string; role: "admin" | "designer" } | null) =>
  useQuery({
    queryKey: ["leads", viewer?.role === "admin" ? "all" : viewer?.id],
    enabled: !!viewer,
    queryFn: async () => {
      const q =
        viewer!.role === "admin"
          ? collection(db, COLLECTION)
          : query(collection(db, COLLECTION), where("assignedTo", "==", viewer!.id));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => toLead(d.id, d.data()));
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
  assignedTo: string;
  assignedToName: string;
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
        assignedTo: input.assignedTo,
        assignedToName: input.assignedToName,
        status: "new" as LeadStatus,
        quotationAmount: null,
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
  assignedTo?: string;
  assignedToName?: string;
  status?: LeadStatus;
  quotationAmount?: number | null;
  nextFollowUpDate?: string | null;
}

export const useUpdateLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: LeadUpdateInput) => {
      const ref = doc(db, COLLECTION, id);
      const payload: Record<string, unknown> = { ...updates };

      // Reassigning restarts the response-time clock for that designer.
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
