"use client";

import type { LoginInput, PublicUser, RegisterInput, UserAvatar } from "@tower/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, type AuthResult } from "@/lib/api";
import { loadProgress } from "@/lib/progress";

export type AuthStatus = "loading" | "ready";

export interface AuthState {
  /** The signed-in account, or null for a guest (also null while loading, and whenever the API is unreachable). */
  user: PublicUser | null;
  status: AuthStatus;
  /** Resolve with the new user or the reason it failed; they never throw. This browser's anonymous id is sent along so its attempts move to the account. */
  register: (input: Omit<RegisterInput, "anonId">) => Promise<AuthResult>;
  login: (input: Omit<LoginInput, "anonId">) => Promise<AuthResult>;
  logout: () => Promise<void>;
  /** Resolves true when the server accepted the new look. */
  setAvatar: (avatar: UserAvatar) => Promise<boolean>;
}

const AuthContext = createContext<AuthState | null>(null);

/** The anonymous id of this browser, or undefined where storage is blocked. */
function browserAnonId(): string | undefined {
  try {
    return loadProgress(window.localStorage).anonId;
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void api.me().then((me) => {
      if (!alive.current) return;
      setUser(me?.user ?? null);
      setStatus("ready");
    });
    return () => {
      alive.current = false;
    };
  }, []);

  const finish = useCallback((r: AuthResult) => {
    if (r.ok && alive.current) setUser(r.user);
    return r;
  }, []);

  const register = useCallback(async (input: Omit<RegisterInput, "anonId">) => finish(await api.register({ ...input, anonId: browserAnonId() })), [finish]);
  const login = useCallback(async (input: Omit<LoginInput, "anonId">) => finish(await api.login({ ...input, anonId: browserAnonId() })), [finish]);

  const logout = useCallback(async () => {
    // The page signs out even if the server cannot be reached; the cookie then simply expires on its own.
    setUser(null);
    await api.logout();
  }, []);

  const setAvatar = useCallback(async (avatar: UserAvatar) => {
    const next = await api.setAvatar(avatar);
    if (next && alive.current) setUser(next);
    return next !== null;
  }, []);

  const value = useMemo<AuthState>(() => ({ user, status, register, login, logout, setAvatar }), [user, status, register, login, logout, setAvatar]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
