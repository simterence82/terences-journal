import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from "firebase/auth";
import { auth } from "./firebase";
import type { User } from "./types";

type AuthState =
  | { type: "loading" }
  | { type: "authenticated"; user: User }
  | { type: "unauthenticated"; errorMessage?: string };

interface AuthContextType {
  authState: AuthState;
  logout: () => Promise<void>;
  /** Call after first-run registration or a role change to re-read custom claims. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Returns the app user if `firebaseUser` has a role granted by an admin, or
 * null if it's a Firebase account with no admin-set role -- e.g. someone
 * self-signed-up directly against the Firebase Auth SDK, bypassing this
 * app's backend entirely (the web apiKey is not secret, so that's always
 * possible at the Firebase layer; only the role custom claim, set solely by
 * our Admin-SDK-backed endpoints, marks an account as actually approved).
 */
async function toAppUser(firebaseUser: FirebaseUser): Promise<User | null> {
  const tokenResult = await firebaseUser.getIdTokenResult();
  const role = tokenResult.claims.role;
  if (role !== "admin" && role !== "member") return null;
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
      if (!user) {
        await firebaseSignOut(auth);
        setAuthState({ type: "unauthenticated", errorMessage: "This account has not been approved by an admin yet." });
        return;
      }
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
    if (!user) {
      await firebaseSignOut(auth);
      setAuthState({ type: "unauthenticated", errorMessage: "This account has not been approved by an admin yet." });
      return;
    }
    setAuthState({ type: "authenticated", user });
  }, []);

  return <AuthContext.Provider value={{ authState, logout, refreshUser }}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
