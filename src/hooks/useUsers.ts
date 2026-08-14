import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import type { PendingUser, User, UserRole } from "../lib/types";

const USERS_KEY = ["users"] as const;
const PENDING_USERS_KEY = ["pendingUsers"] as const;

export const useUsersList = () =>
  useQuery({
    queryKey: USERS_KEY,
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, "users"));
      return snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          createdAt: toIso(data.createdAt),
        } as User;
      });
    },
  });

export const usePendingUsersList = () =>
  useQuery({
    queryKey: PENDING_USERS_KEY,
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, "pendingUsers"));
      return snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          email: data.email,
          displayName: data.displayName,
          requestedAt: toIso(data.requestedAt),
        } as PendingUser;
      });
    },
  });

export interface ApproveUserInput {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export const useApproveUser = () => {
  const qc = useQueryClient();
  return useMutation({
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_KEY });
      qc.invalidateQueries({ queryKey: PENDING_USERS_KEY });
    },
  });
};

export const useDenyUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDoc(doc(db, "pendingUsers", id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: PENDING_USERS_KEY }),
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDoc(doc(db, "users", id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
};
