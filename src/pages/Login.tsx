import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { signInWithEmailAndPassword, signInWithCustomToken } from "firebase/auth";
import { auth } from "../lib/firebase";
import { apiGet, apiPost } from "../lib/apiClient";
import { useAuth } from "../lib/AuthContext";
import { Input } from "../components/Input";
import { Button } from "../components/Button";

export const LoginPage: React.FC = () => {
  const { authState, refreshUser } = useAuth();
  const navigate = useNavigate();

  const { data: setupStatus, isFetching } = useQuery({
    queryKey: ["auth", "setupStatus"],
    queryFn: () => apiGet<{ hasUsers: boolean }>("/auth/setup-status"),
  });

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (authState.type === "authenticated") {
    return <Navigate to="/" replace />;
  }

  const isFirstRun = setupStatus?.hasUsers === false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (isFirstRun) {
        // Creating the first admin requires the Admin SDK (to set the
        // "admin" custom claim), so this one step goes through our backend,
        // which mints a custom token we exchange for a real session here.
        const result = await apiPost<{ customToken: string }>("/auth/register", { displayName, email, password });
        await signInWithCustomToken(auth, result.customToken);
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

        {isFetching ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {isFirstRun
                ? "No admin account exists yet. Create the first admin account to get started."
                : "Sign in to continue to your journal."}
            </p>

            {error && <div className="mb-4 rounded border border-error bg-[var(--error-tint)] px-3 py-2 text-sm text-error">{error}</div>}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {isFirstRun && (
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
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="********" />
              </div>
              <Button type="submit" disabled={isLoading} className="mt-2 justify-center">
                {isLoading ? "Please wait..." : isFirstRun ? "Create Admin Account" : "Log In"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
