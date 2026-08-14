import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Handshake } from "lucide-react";
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
        // Bootstrapping the first account: create the Firebase Auth
        // account, then atomically create their users/{uid} doc (role:
        // super_admin -- the top tier, since no one else exists yet to
        // grant them access) and the meta/setup sentinel that marks
        // bootstrap as done. firestore.rules allows exactly this one
        // self-created super_admin doc, and only while meta/setup doesn't
        // exist.
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
        const batch = writeBatch(db);
        batch.set(doc(db, "users", cred.user.uid), { email, displayName, role: "super_admin", createdAt: serverTimestamp() });
        batch.set(doc(db, "meta", "setup"), { initializedBy: cred.user.uid, initializedAt: serverTimestamp() });
        await batch.commit();
      } else if (mode === "signup") {
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
    <div
      className="flex min-h-screen items-center justify-center bg-bg p-6"
      style={{ backgroundImage: "radial-gradient(circle at 15% 10%, var(--brand-wash), transparent 55%), radial-gradient(circle at 85% 90%, var(--accent-wash), transparent 50%)" }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-line bg-panel shadow-lg">
        <div className="h-1.5 w-full bg-brand" />
        <div className="p-6 sm:p-8">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-ink">
              <Handshake size={20} />
            </span>
            <h1 className="font-display text-2xl font-semibold text-ink">Studio Leads</h1>
          </div>

          {setupCheckError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-bad">Couldn't reach Firebase: {setupCheckError}</p>
              <Button type="button" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          ) : isFirstRun === null ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" />
            </div>
          ) : (
            <>
              <p className="mb-6 text-sm text-faint-ink">
                {isFirstRun
                  ? "No account exists yet. Create the first super admin account to get started."
                  : mode === "signup"
                    ? "Request access — an admin will need to approve your account before you can sign in."
                    : "Sign in to continue to Studio Leads."}
              </p>

              {error && (
                <div className="mb-4 rounded-lg border border-bad bg-[var(--bad-wash)] px-3 py-2 text-sm text-bad">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {isSignup && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[0.8125rem] font-medium text-ink">Display Name</label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="Your Name" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="text-[0.8125rem] font-medium text-ink">Username / Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[0.8125rem] font-medium text-ink">Password</label>
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
                  {isLoading ? "Please wait..." : isFirstRun ? "Create Super Admin Account" : mode === "signup" ? "Request Access" : "Log In"}
                </Button>
              </form>

              {!isFirstRun && (
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "login" ? "signup" : "login");
                    setError(null);
                  }}
                  className="mt-4 w-full text-center text-[0.8125rem] text-brand hover:underline"
                >
                  {mode === "login" ? "Don't have an account? Request access" : "Already have an account? Log in"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
