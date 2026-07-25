"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ADMIN_ROLES } from "@volt/config";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/learn", label: "Learn" },
  { href: "/trading-floor", label: "Invest" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  const isStaff = !!user && ADMIN_ROLES.includes(user.role);
  const appHref = isStaff ? "/admin" : "/dashboard";
  const appLabel = isStaff ? "Admin panel" : "Open dashboard";

  return (
    <header className="sticky top-0 z-40">
      <div className="border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="container-page grid h-[4.25rem] grid-cols-[1fr_auto] items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          {/* Brand */}
          <div className="justify-self-start">
            <Logo />
          </div>

          {/* Center nav — desktop */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-surface-2 text-foreground"
                      : "text-muted-foreground hover:bg-surface-2/70 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right CTAs — desktop (like Launch App on the reference) */}
          <div className="hidden items-center justify-end gap-2 md:flex">
            {loading ? (
              <div className="h-10 w-28 animate-pulse rounded-full bg-surface-2" />
            ) : user ? (
              <Link
                href={appHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-10 rounded-full border-foreground/15 px-5",
                )}
              >
                {appLabel}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-10 rounded-full border-foreground/20 bg-background px-5 shadow-sm",
                  )}
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className={cn(
                    buttonVariants({ variant: "primary", size: "sm" }),
                    "h-10 rounded-full px-5 shadow-volt",
                  )}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            className="justify-self-end inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="border-b border-border bg-surface/95 shadow-lift backdrop-blur md:hidden">
          <nav className="container-page flex flex-col gap-1 py-4">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-sm font-medium",
                    active
                      ? "bg-volt/10 text-volt-dim"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="mt-3 grid gap-2 border-t border-border pt-3">
              {user ? (
                <Link
                  href={appHref}
                  onClick={() => setOpen(false)}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full rounded-full")}
                >
                  {appLabel}
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full rounded-full border-foreground/20",
                    )}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className={cn(buttonVariants({ variant: "primary" }), "w-full rounded-full shadow-volt")}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
