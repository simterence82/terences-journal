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
  const { authState } = useAuth();

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
