import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { User } from "./types";

type AuthState =
  | { type: "loading" }
  | { type: "authenticated"; user: User }
  // Signed in to Firebase Auth, but no users/{uid} doc yet -- either their
  // sign-up request is still awaiting admin approval, or they were denied.
  | { type: "pending" }
  | { type: "unauthenticated" };

interface AuthContextType {
  authState: AuthState;
  logout: () => Promise<void>;
  /** Call after writing users/{uid} yourself (bootstrap/approval) to re-check it. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function resolveAuthState(firebaseUser: FirebaseUser): Promise<AuthState> {
  const snap = await getDoc(doc(db, "users", firebaseUser.uid));
  if (!snap.exists()) {
    return { type: "pending" };
  }
  const data = snap.data();
  return {
    type: "authenticated",
    user: {
      id: firebaseUser.uid,
      email: data.email ?? firebaseUser.email ?? "",
      displayName: data.displayName || firebaseUser.email || "",
      role: data.role,
      createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
    },
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({ type: "loading" });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setAuthState({ type: "unauthenticated" });
        return;
      }
      setAuthState(await resolveAuthState(firebaseUser));
    });
    return unsubscribe;
  }, []);

  const logout = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const refreshUser = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    setAuthState(await resolveAuthState(firebaseUser));
  }, []);

  return <AuthContext.Provider value={{ authState, logout, refreshUser }}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
