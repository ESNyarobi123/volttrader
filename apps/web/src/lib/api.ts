import type { ApiError, AuthResponse } from "@volt/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const ACCESS_KEY = "volt.accessToken";
const REFRESH_KEY = "volt.refreshToken";

export const tokenStore = {
  get access(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_KEY, access);
    window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** Server-provided message for a failed request, or `fallback` for anything else. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string; // explicit token (server components)
  auth?: boolean; // attach stored token (default true)
  /** Internal: skip 401 → refresh → retry (used by the refresh call itself). */
  _skipRefresh?: boolean;
}

/** Single in-flight refresh so parallel 401s don't rotate the refresh token twice. */
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = tokenStore.refresh;
    if (!refreshToken) {
      tokenStore.clear();
      return false;
    }

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });
      const text = await res.text();
      let json: unknown = {};
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          tokenStore.clear();
          return false;
        }
      }
      if (!res.ok) {
        tokenStore.clear();
        return false;
      }
      const data = (json as { data: AuthResponse }).data;
      if (!data?.tokens?.accessToken || !data?.tokens?.refreshToken) {
        tokenStore.clear();
        return false;
      }
      tokenStore.set(data.tokens.accessToken, data.tokens.refreshToken);
      return true;
    } catch {
      tokenStore.clear();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, auth = true, headers, _skipRefresh, ...rest } = options;
  const finalHeaders = new Headers(headers);
  finalHeaders.set("Content-Type", "application/json");

  const bearer = token ?? (auth ? tokenStore.access : null);
  if (bearer) finalHeaders.set("Authorization", `Bearer ${bearer}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiRequestError(
      "NETWORK_ERROR",
      "Cannot reach the server. Make sure the API is running (port 4000) and try again.",
      0,
    );
  }

  // Expired access token → rotate with refresh, then retry once.
  if (
    res.status === 401 &&
    auth &&
    !_skipRefresh &&
    !token &&
    typeof window !== "undefined" &&
    tokenStore.refresh
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, { ...options, _skipRefresh: true });
    }
  }

  let json: unknown = {};
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ApiRequestError(
        "BAD_RESPONSE",
        res.statusText || "Unexpected response from the server.",
        res.status,
      );
    }
  }

  if (!res.ok) {
    const err = (json as ApiError).error;
    throw new ApiRequestError(
      err?.code ?? "ERROR",
      err?.message ?? res.statusText ?? "Request failed",
      res.status,
      err?.details,
    );
  }
  return (json as { data: T }).data;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  del: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
