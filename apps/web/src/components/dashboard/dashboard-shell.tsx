"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  TrendingUp,
  Wallet,
  LogOut,
  Search,
  ChevronDown,
  UserRound,
  Users,
  Menu,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardNotifications } from "@/components/dashboard/dashboard-notifications";
import { DropdownPortal } from "@/components/shared/dropdown-portal";
import { LordIconScript } from "@/components/shared/lord-icon";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

/** Horizontal hub nav — LMS-inspired, Volt product modules only. */
const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/learn", label: "Learn", icon: GraduationCap },
  { href: "/dashboard/invest", label: "Invest", icon: TrendingUp },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/society", label: "Community", icon: Users },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarBtnRef = useRef<HTMLButtonElement>(null);
  const avatarPanelRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const [chromeH, setChromeH] = useState(60);

  useEffect(() => {
    for (const item of NAV) router.prefetch(item.href);
  }, [router]);

  useEffect(() => {
    setPendingHref(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!pendingHref) return;
    const t = window.setTimeout(() => setPendingHref(null), 8_000);
    return () => window.clearTimeout(t);
  }, [pendingHref]);

  // Keep main content offset exact to fixed chrome height (incl. mobile menu open)
  useEffect(() => {
    const el = chromeRef.current;
    if (!el) return;
    const sync = () => setChromeH(el.getBoundingClientRect().height);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || avatarPanelRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.replace("/");
  };

  const onNavClick = (href: string) => {
    if (!isActive(pathname, href)) setPendingHref(href);
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/learn?q=${encodeURIComponent(q)}` : "/learn");
  };

  const activePath = pendingHref ?? pathname;
  const navigating = Boolean(pendingHref);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <LordIconScript />
      {/* Fixed chrome: brand header + horizontal menu together */}
      <div
        ref={chromeRef}
        className="fixed inset-x-0 top-0 z-40 overflow-visible shadow-[0_10px_32px_-14px_rgba(0,0,0,0.3)]"
      >
        <header className="relative z-50 overflow-visible bg-gradient-to-r from-[hsl(349_74%_32%)] via-volt to-[hsl(351_70%_48%)] text-volt-foreground">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(90%_120%_at_12%_-20%,rgba(255,255,255,0.22),transparent_55%),radial-gradient(70%_80%_at_92%_0%,rgba(255,255,255,0.12),transparent_50%)]"
          />
          <div className="relative mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-3 sm:h-16 sm:gap-5 sm:px-6 lg:px-10">
            <Link
              href="/dashboard"
              onClick={() => onNavClick("/dashboard")}
              className="group flex shrink-0 items-center gap-2.5 font-bold tracking-tight"
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-volt shadow-[0_8px_20px_-8px_rgba(0,0,0,0.45)] ring-1 ring-white/40 transition group-hover:scale-[1.03]">
                <Zap className="h-5 w-5" aria-hidden />
              </span>
              <span className="hidden text-lg tracking-tight sm:inline">
                Volt<span className="font-semibold text-white/85">Trades</span>
              </span>
            </Link>

            <form
              onSubmit={onSearch}
              className="relative mx-auto hidden min-w-0 max-w-2xl flex-1 md:block"
            >
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your course here…"
                className="h-11 w-full rounded-full border-0 bg-white/95 py-2 pl-11 pr-4 text-sm text-foreground shadow-[0_10px_28px_-14px_rgba(0,0,0,0.45)] outline-none ring-1 ring-white/50 placeholder:text-muted-foreground transition focus:bg-white focus-visible:ring-2 focus-visible:ring-white"
              />
            </form>

            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20 md:hidden"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              <div className="[&_button]:h-10 [&_button]:w-10 [&_button]:rounded-xl [&_button]:border-white/25 [&_button]:bg-white/10 [&_button]:text-white [&_button]:shadow-none [&_button]:hover:border-white/40 [&_button]:hover:bg-white/20">
                <DashboardNotifications />
              </div>

              <div className="relative" ref={menuRef}>
                <button
                  ref={avatarBtnRef}
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl bg-white/12 py-1 pl-1 pr-1.5 ring-1 ring-white/25 transition hover:bg-white/20 sm:pr-2.5",
                    menuOpen && "bg-white/22",
                  )}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-xs font-bold text-volt shadow-sm">
                    {initials(user?.fullName)}
                  </span>
                  <span className="hidden min-w-0 text-left lg:block">
                    <span className="block max-w-[140px] truncate text-sm font-semibold leading-tight">
                      {user?.fullName ?? "Member"}
                    </span>
                    <span className="block max-w-[140px] truncate text-[11px] text-white/75">
                      {user?.email ?? user?.phone}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "hidden h-4 w-4 text-white/85 transition-transform lg:block",
                      menuOpen && "rotate-180",
                    )}
                  />
                </button>

                <DropdownPortal open={menuOpen} anchorRef={avatarBtnRef} align="right" width={224}>
                  <div
                    ref={avatarPanelRef}
                    role="menu"
                    className="w-[min(14rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-surface text-foreground shadow-lift"
                  >
                    <div className="border-b border-border bg-gradient-to-r from-volt/15 via-surface to-surface px-3 py-3">
                      <p className="truncate text-sm font-semibold">
                        {user?.fullName ?? "Member"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user?.email ?? user?.phone}
                      </p>
                    </div>
                    <div className="p-1.5">
                      <Link
                        href="/dashboard/profile"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onNavClick("/dashboard/profile");
                        }}
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-surface-2"
                      >
                        <UserRound className="h-4 w-4 text-volt-dim" />
                        Profile
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Log out
                      </button>
                    </div>
                  </div>
                </DropdownPortal>
              </div>
            </div>
          </div>

          {navigating ? (
            <div aria-hidden className="relative h-0.5 overflow-hidden bg-white/20">
              <div className="h-full w-1/3 animate-[volt-nav-progress_0.9s_ease-in-out_infinite] bg-white" />
            </div>
          ) : null}
        </header>

        {/* Desktop menu — compact, smart underline (LMS-style); below header z so dropdowns win */}
        <nav className="relative z-30 hidden border-b border-border bg-surface/95 backdrop-blur-md md:block">
          <div className="mx-auto flex max-w-[1400px] items-center gap-1 px-4 py-1.5 sm:px-6 lg:gap-2 lg:px-10">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(activePath, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onClick={() => onNavClick(item.href)}
                  className={cn(
                    "group relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-150",
                    active
                      ? "text-volt-dim"
                      : "text-muted-foreground hover:bg-volt/[0.06] hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-colors",
                      active
                        ? "text-volt-dim"
                        : "text-muted-foreground group-hover:text-volt-dim",
                    )}
                    aria-hidden
                  />
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      "absolute inset-x-3 -bottom-[0.35rem] h-[2.5px] rounded-full transition-opacity duration-150",
                      active
                        ? "bg-volt opacity-100"
                        : "bg-volt/50 opacity-0 group-hover:opacity-100",
                    )}
                  />
                </Link>
              );
            })}
          </div>
        </nav>

        {mobileOpen ? (
          <div className="border-b border-border bg-surface px-3 py-3 md:hidden">
            <form onSubmit={onSearch} className="relative mb-3">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your course here…"
                className="h-11 w-full rounded-full border border-border bg-background py-2 pl-10 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-volt/40"
              />
            </form>
            <div className="grid gap-1.5">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = isActive(activePath, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onNavClick(item.href)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition",
                      active
                        ? "bg-volt/12 text-volt-dim shadow-[inset_0_0_0_1px_hsl(var(--volt)/0.2)]"
                        : "text-foreground hover:bg-surface-2",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Offset for fixed chrome */}
      <div aria-hidden style={{ height: chromeH }} />

      <main
        className={cn(
          "mx-auto w-full max-w-[1400px] px-3 py-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 md:px-8 md:pb-10 lg:px-10",
          navigating && "opacity-80 transition-opacity duration-150",
        )}
      >
        {children}
      </main>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border bg-surface/95 backdrop-blur md:hidden",
          "pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)]",
        )}
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(activePath, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onClick={() => onNavClick(item.href)}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-1.5 text-[10px] font-semibold transition-colors",
                active ? "text-volt-dim" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-xl transition",
                  active && "bg-volt/12",
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", active && navigating && "animate-pulse")} />
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
