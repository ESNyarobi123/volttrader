"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { Role } from "@volt/config";
import { ADMIN_ROLES } from "@volt/config";
import { useAuth } from "@/lib/auth";
import { PageSpinner } from "@/components/ui/spinner";

/**
 * Client-side guard for protected route groups. Redirects unauthenticated users
 * to /login, and users lacking the required role away from the page.
 * (The API is the real authority — this is UX gating only.)
 */
export function AuthGuard({
  children,
  roles,
  redirectTo = "/login",
}: {
  children: ReactNode;
  roles?: Role[];
  redirectTo?: string;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const allowed = user && (!roles || roles.includes(user.role));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next =
        redirectTo === "/login" && typeof window !== "undefined"
          ? `/login?redirect=${encodeURIComponent(window.location.pathname)}`
          : redirectTo;
      router.replace(next);
    } else if (roles && !roles.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [loading, user, roles, router, redirectTo]);

  // If we already have a session user (e.g. just registered/logged in), don't
  // block the shell behind a full-page spinner while auth refreshes.
  if (loading && !user) return <PageSpinner />;
  if (!allowed) return <PageSpinner />;
  return <>{children}</>;
}

/** Convenience guard for the admin area (any staff role). */
export function AdminGuard({ children }: { children: ReactNode }) {
  return (
    <AuthGuard roles={ADMIN_ROLES} redirectTo="/login">
      {children}
    </AuthGuard>
  );
}
