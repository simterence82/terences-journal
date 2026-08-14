import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { AppShell } from "./AppShell";
import type { UserRole } from "../lib/types";

interface ProtectedRouteProps {
  roles: UserRole[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ roles, children }) => {
  const { authState, logout } = useAuth();

  if (authState.type === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (authState.type === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (authState.type === "pending") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <h1 className="font-display text-xl font-semibold text-foreground">Awaiting approval</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account has been created but an admin still needs to approve it before you can access Studio Leads.
        </p>
        <button onClick={() => logout()} className="mt-2 text-[0.8125rem] text-primary hover:underline">
          Sign out
        </button>
      </div>
    );
  }

  if (!roles.includes(authState.user.role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background text-center">
        <h1 className="font-display text-xl font-semibold text-foreground">Access Denied</h1>
        <p className="text-sm text-muted-foreground">Your role ({authState.user.role}) lacks the required permissions.</p>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
};
