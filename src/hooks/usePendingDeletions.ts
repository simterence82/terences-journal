import { useMutation } from "@tanstack/react-query";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { useCollectionQuery } from "../lib/useFirestoreQuery";
import type { PendingDeletion, PendingDeletionAction, PendingDeletionEntityKind } from "../lib/types";

const HARD_DELETE_COLLECTION: Record<PendingDeletionEntityKind, string> = {
  lighting: "lightingPurchases",
  blum: "blumPurchases",
  tasks: "tasks",
  issues: "issues",
  schedule: "scheduleEvents",
};

function toPendingDeletion(id: string, data: Record<string, any>): PendingDeletion {
  return {
    id,
    kind: data.kind,
    entityId: data.entityId,
    action: data.action,
    title: data.title,
    subtitle: data.subtitle,
    requestedBy: data.requestedBy ?? null,
    requestedByName: data.requestedByName ?? null,
    requestedAt: toIso(data.requestedAt),
  };
}

export const usePendingDeletionsList = () =>
  useCollectionQuery(
    () => collection(db, "pendingDeletions"),
    toPendingDeletion,
    (a, b) => (a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0)
  );

export interface RequestDeletionInput {
  kind: PendingDeletionEntityKind;
  entityId: string;
  action: PendingDeletionAction;
  title: string;
  subtitle: string;
  requestedBy: string | null;
  requestedByName: string | null;
}

export const useRequestDeletion = () =>
  useMutation({
    mutationFn: async (input: RequestDeletionInput) => {
      await addDoc(collection(db, "pendingDeletions"), {
        ...input,
        requestedAt: serverTimestamp(),
      });
      return { success: true as const };
    },
  });

export const useApproveDeletion = () =>
  useMutation({
    mutationFn: async (request: PendingDeletion) => {
      const targetCollection = HARD_DELETE_COLLECTION[request.kind];
      if (request.action === "soft") {
        await updateDoc(doc(db, targetCollection, request.entityId), {
          isDeleted: true,
          deletedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(doc(db, targetCollection, request.entityId));
        if (request.kind === "tasks") await deleteDoc(doc(db, "taskFiles", request.entityId));
        if (request.kind === "issues") await deleteDoc(doc(db, "issueFiles", request.entityId));
      }
      await deleteDoc(doc(db, "pendingDeletions", request.id));
      return { success: true as const };
    },
  });

export const useRejectDeletion = () =>
  useMutation({
    mutationFn: (id: string) => deleteDoc(doc(db, "pendingDeletions", id)),
  });
