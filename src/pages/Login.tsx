import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { Input } from "../components/Input";
import { Button } from "../components/Button";

type Mode = "login" | "signup";

export const LoginPage: React.FC = () => {
  const { authState, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);
  const [setupCheckError, setSetupCheckError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("login");

  useEffect(() => {
    getDoc(doc(db, "meta", "setup"))
      .then((snap) => setIsFirstRun(!snap.exists()))
      .catch((err) => setSetupCheckError(err instanceof Error ? err.message : "Could not reach the server"));
  }, []);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // A "pending" user is signed in but not yet approved -- send them to "/"
  // too, where ProtectedRoute shows a single shared "awaiting approval"
  // screen regardless of which page they land on.
  if (authState.type === "authenticated" || authState.type === "pending") {
    return <Navigate to="/" replace />;
  }

  const isSignup = isFirstRun || mode === "signup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (isFirstRun) {
        // Bootstrapping the first admin: create the Firebase Auth account,
        // then atomically create their users/{uid} doc (role: admin) and the
        // meta/setup sentinel that marks bootstrap as done. No Admin SDK
        // involved -- Firestore security rules allow exactly this one
        // self-created admin doc, and only while meta/setup doesn't exist.
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
        const batch = writeBatch(db);
        batch.set(doc(db, "users", cred.user.uid), { email, displayName, role: "admin", createdAt: serverTimestamp() });
        batch.set(doc(db, "meta", "setup"), { initializedBy: cred.user.uid, initializedAt: serverTimestamp() });
        await batch.commit();
      } else if (mode === "signup") {
        // Anyone can create a Firebase Auth account (the web apiKey isn't
        // secret) -- what actually grants access is an admin approving the
        // request, which creates users/{uid}. Until then this account can
        // sign in but has no role doc, so it stays stuck on the "pending"
        // screen.
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
        await setDoc(doc(db, "pendingUsers", cred.user.uid), { email, displayName, requestedAt: serverTimestamp() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      await refreshUser();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-lg">
        <div className="mb-2 flex items-center gap-3 text-primary">
          <BookOpen size={28} />
          <h1 className="font-display text-2xl font-semibold text-foreground">Terence's Journal</h1>
        </div>

        {setupCheckError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-error">Couldn't reach Firebase: {setupCheckError}</p>
            <Button type="button" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : isFirstRun === null ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {isFirstRun
                ? "No admin account exists yet. Create the first admin account to get started."
                : mode === "signup"
                  ? "Request access — an admin will need to approve your account before you can sign in."
                  : "Sign in to continue to your journal."}
            </p>

            {error && (
              <div className="mb-4 rounded border border-error bg-[var(--error-tint)] px-3 py-2 text-sm text-error">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {isSignup && (
                <div className="flex flex-col gap-2">
                  <label className="text-[0.8125rem] font-medium text-foreground">Display Name</label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="Your Name" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-[0.8125rem] font-medium text-foreground">Username / Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.8125rem] font-medium text-foreground">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="********"
                  minLength={isSignup ? 8 : undefined}
                />
              </div>
              <Button type="submit" disabled={isLoading} className="mt-2 justify-center">
                {isLoading ? "Please wait..." : isFirstRun ? "Create Admin Account" : mode === "signup" ? "Request Access" : "Log In"}
              </Button>
            </form>

            {!isFirstRun && (
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError(null);
                }}
                className="mt-4 w-full text-center text-[0.8125rem] text-primary hover:underline"
              >
                {mode === "login" ? "Don't have an account? Request access" : "Already have an account? Log in"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
