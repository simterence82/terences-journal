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
  /**
   * What the rest of the app should render. Identical to realAuthState,
   * except while a Super Admin is previewing another user -- then this
   * reports that user instead, so every existing role check throughout the
   * app (isAdmin, isSuperAdmin, route guards, ...) renders exactly what
   * that user would see. No real sign-in happens: Firestore rules still
   * check the Super Admin's actual auth token, so this can't grant any
   * access it doesn't already have -- it can only make their own screen
   * show less.
   */
  authState: AuthState;
  /** The real signed-in account, ignoring any active preview. */
  realAuthState: AuthState;
  previewUser: User | null;
  /** Only takes effect when the real signed-in account is a Super Admin. */
  startPreview: (user: User) => void;
  stopPreview: () => void;
  logout: () => Promise<void>;
  /** Call after writing users/{uid} yourself (bootstrap/approval) to re-check it. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Resolves what the app should show for a signed-in Firebase user: an
 * approved app user (role read from their users/{uid} Firestore doc) or
 * "pending" if that doc doesn't exist yet. There's no backend anymore, so
 * this Firestore doc -- not a Firebase Auth custom claim -- is the sole
 * source of truth for "has an admin approved this account."
 */
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
    },
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [realAuthState, setRealAuthState] = useState<AuthState>({ type: "loading" });
  const [previewUser, setPreviewUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setRealAuthState({ type: "unauthenticated" });
        setPreviewUser(null);
        return;
      }
      setRealAuthState(await resolveAuthState(firebaseUser));
    });
    return unsubscribe;
  }, []);

  const logout = useCallback(async () => {
    setPreviewUser(null);
    await firebaseSignOut(auth);
  }, []);

  const refreshUser = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    setRealAuthState(await resolveAuthState(firebaseUser));
  }, []);

  const startPreview = useCallback((user: User) => setPreviewUser(user), []);
  const stopPreview = useCallback(() => setPreviewUser(null), []);

  const isRealSuperAdmin = realAuthState.type === "authenticated" && realAuthState.user.role === "superadmin";
  const authState: AuthState = previewUser && isRealSuperAdmin ? { type: "authenticated", user: previewUser } : realAuthState;

  return (
    <AuthContext.Provider value={{ authState, realAuthState, previewUser: isRealSuperAdmin ? previewUser : null, startPreview, stopPreview, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
