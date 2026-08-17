import { useMutation } from "@tanstack/react-query";
import { collection, deleteDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { useCollectionQuery } from "../lib/useFirestoreQuery";
import type { PendingUser, User, UserRole } from "../lib/types";

function toUser(id: string, data: Record<string, any>): User {
  return { id, email: data.email, displayName: data.displayName, role: data.role, createdAt: toIso(data.createdAt) };
}

function toPendingUser(id: string, data: Record<string, any>): PendingUser {
  return { id, email: data.email, displayName: data.displayName, requestedAt: toIso(data.requestedAt) };
}

export const useUsersList = () =>
  useCollectionQuery(
    () => collection(db, "users"),
    toUser,
    (a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? -1 : (a.createdAt ?? "") > (b.createdAt ?? "") ? 1 : 0)
  );

export const usePendingUsersList = () =>
  useCollectionQuery(
    () => collection(db, "pendingUsers"),
    toPendingUser,
    (a, b) => (a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0)
  );

export interface ApproveUserInput {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export const useApproveUser = () =>
  useMutation({
    mutationFn: async ({ id, email, displayName, role }: ApproveUserInput) => {
      const batch = writeBatch(db);
      batch.set(doc(db, "users", id), {
        email,
        displayName,
        role,
        createdAt: serverTimestamp(),
      });
      batch.delete(doc(db, "pendingUsers", id));
      await batch.commit();
    },
  });

export const useDenyUser = () =>
  useMutation({
    mutationFn: (id: string) => deleteDoc(doc(db, "pendingUsers", id)),
  });

export interface DeleteUserInput {
  id: string;
  email: string;
}

export const useDeleteUser = () =>
  useMutation({
    // Deleting the users/{uid} doc revokes app access immediately. The
    // browser can't delete the underlying Firebase Auth account (that needs
    // Admin SDK privileges), so it queues a pendingAuthDeletions doc instead
    // -- a scheduled GitHub Actions job picks this up every few minutes and
    // deletes the Auth account, freeing the email for someone else to sign
    // up with.
    mutationFn: async ({ id, email }: DeleteUserInput) => {
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", id));
      batch.set(doc(db, "pendingAuthDeletions", id), { email, requestedAt: serverTimestamp() });
      await batch.commit();
    },
  });
