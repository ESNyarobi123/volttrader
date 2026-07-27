"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthResponse, SessionUser } from "@volt/types";
import type { LoginInput, RegisterInput } from "@volt/validation";
import { api, tokenStore } from "./api";

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<SessionUser>;
  register: (input: RegisterInput) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!tokenStore.access && !tokenStore.refresh) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<SessionUser>("/auth/me");
      setUser(me);
    } catch {
      // api client already tried refresh on 401; if still failing, session is gone.
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const handleAuth = (res: AuthResponse): SessionUser => {
    tokenStore.set(res.tokens.accessToken, res.tokens.refreshToken);
    setUser(res.user);
    setLoading(false);
    return res.user;
  };

  const login = useCallback(async (input: LoginInput) => {
    const res = await api.post<AuthResponse>("/auth/login", input, { auth: false });
    return handleAuth(res);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await api.post<AuthResponse>("/auth/register", input, { auth: false });
    return handleAuth(res);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh;
    if (refreshToken) await api.post("/auth/logout", { refreshToken }, { auth: false }).catch(() => undefined);
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh: loadMe }),
    [user, loading, login, register, logout, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
