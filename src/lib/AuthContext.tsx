import React, { createContext, useCallback, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./apiClient";
import type { User } from "./types";

export const AUTH_QUERY_KEY = ["auth", "session"] as const;

type AuthState =
  | { type: "loading" }
  | { type: "authenticated"; user: User }
  | { type: "unauthenticated" };

interface AuthContextType {
  authState: AuthState;
  onLogin: (user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();

  const { data, status } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        const result = await apiGet<{ user: User }>("/auth/session");
        return result.user;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  const authState: AuthState =
    status === "pending" ? { type: "loading" } : data ? { type: "authenticated", user: data } : { type: "unauthenticated" };

  const onLogin = useCallback(
    (user: User) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
    await apiPost("/auth/logout");
    queryClient.resetQueries();
  }, [queryClient]);

  return <AuthContext.Provider value={{ authState, onLogin, logout }}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
