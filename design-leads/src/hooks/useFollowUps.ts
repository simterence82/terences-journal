import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { markFirstContactIfNeeded, useUpdateLead } from "./useLeads";
import type { FollowUp, FollowUpMethod, LeadStatus } from "../lib/types";

const COLLECTION = "leadFollowUps";

function toFollowUp(id: string, data: Record<string, any>): FollowUp {
  return {
    id,
    leadId: data.leadId,
    method: data.method,
    outcome: data.outcome,
    nextFollowUpDate: data.nextFollowUpDate ?? null,
    loggedBy: data.loggedBy ?? null,
    loggedByName: data.loggedByName ?? "",
    loggedAt: toIso(data.loggedAt) ?? new Date(0).toISOString(),
  };
}

export const useFollowUpsForLead = (leadId: string | null) =>
  useQuery({
    queryKey: ["leadFollowUps", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, COLLECTION), where("leadId", "==", leadId)));
      const items = snap.docs.map((d) => toFollowUp(d.id, d.data()));
      items.sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : a.loggedAt > b.loggedAt ? -1 : 0));
      return items;
    },
  });

export interface FollowUpCreateInput {
  leadId: string;
  method: FollowUpMethod;
  outcome: string;
  nextFollowUpDate: string | null;
  /** Optionally move the lead's status in the same action (e.g. -> "signed"). */
  newStatus?: LeadStatus;
}

/**
 * Logging a follow-up is the core "did they follow up?" action: it records
 * the contact attempt, stamps the lead's firstContactedAt the first time
 * this happens (drives the response-time KPI), and carries the
 * next-follow-up date onto the lead so overdue tracking stays in sync.
 */
export const useCreateFollowUp = () => {
  const qc = useQueryClient();
  const updateLead = useUpdateLead();
  return useMutation({
    mutationFn: async (input: FollowUpCreateInput) => {
      const currentUser = auth.currentUser;
      await addDoc(collection(db, COLLECTION), {
        leadId: input.leadId,
        method: input.method,
        outcome: input.outcome,
        nextFollowUpDate: input.nextFollowUpDate,
        loggedBy: currentUser?.uid ?? null,
        loggedByName: currentUser?.displayName ?? "Unknown",
        loggedAt: serverTimestamp(),
      });
      await markFirstContactIfNeeded(input.leadId);
      await updateLead.mutateAsync({
        id: input.leadId,
        nextFollowUpDate: input.nextFollowUpDate,
        ...(input.newStatus ? { status: input.newStatus } : {}),
      });
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["leadFollowUps", variables.leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};
