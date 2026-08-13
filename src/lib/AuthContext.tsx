import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from "firebase/auth";
import { auth } from "./firebase";
import type { User } from "./types";

type AuthState = { type: "loading" } | { type: "authenticated"; user: User } | { type: "unauthenticated" };

interface AuthContextType {
  authState: AuthState;
  logout: () => Promise<void>;
  /** Call after first-run registration or a role change to re-read custom claims. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function toAppUser(firebaseUser: FirebaseUser): Promise<User> {
  const tokenResult = await firebaseUser.getIdTokenResult();
  const role = tokenResult.claims.role === "admin" ? "admin" : "member";
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? "",
    displayName: firebaseUser.displayName || firebaseUser.email || "",
    role,
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
      const user = await toAppUser(firebaseUser);
      setAuthState({ type: "authenticated", user });
    });
    return unsubscribe;
  }, []);

  const logout = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const refreshUser = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    await firebaseUser.getIdToken(true);
    const user = await toAppUser(firebaseUser);
    setAuthState({ type: "authenticated", user });
  }, []);

  return <AuthContext.Provider value={{ authState, logout, refreshUser }}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
