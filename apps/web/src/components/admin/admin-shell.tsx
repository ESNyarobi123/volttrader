"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  GraduationCap,
  TrendingUp,
  LineChart,
  CreditCard,
  Banknote,
  Ticket,
  FolderKanban,
  Sparkles,
  LifeBuoy,
  Settings,
  ScrollText,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  Zap,
  UserRound,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { AdminGlobalSearch } from "@/components/admin/admin-global-search";
import { AdminNotifications } from "@/components/admin/admin-notifications";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { humanize } from "@/lib/status";
import { initials } from "@/lib/format";

const STORAGE_KEY = "volt-admin-sidebar-expanded";

const NAV: { href: string; label: string; icon: LucideIcon; group: string }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, group: "General" },
  { href: "/admin/courses", label: "Courses", icon: GraduationCap, group: "Catalogue" },
  { href: "/admin/course-plans", label: "Course plans", icon: Sparkles, group: "Catalogue" },
  { href: "/admin/investment-plans", label: "Invest plans", icon: TrendingUp, group: "Catalogue" },
  { href: "/admin/opportunities", label: "Opportunities", icon: LineChart, group: "Catalogue" },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban, group: "Catalogue" },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket, group: "Catalogue" },
  { href: "/admin/investments", label: "Investments", icon: TrendingUp, group: "Finance" },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, group: "Finance" },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote, group: "Finance" },
  { href: "/admin/users", label: "Users", icon: Users, group: "People" },
  { href: "/admin/kyc", label: "KYC", icon: ShieldCheck, group: "People" },
  { href: "/admin/community", label: "Volt Society", icon: Sparkles, group: "People" },
  { href: "/admin/support", label: "Support", icon: LifeBuoy, group: "People" },
  { href: "/admin/audit", label: "Audit logs", icon: ScrollText, group: "System" },
  { href: "/admin/settings", label: "Settings", icon: Settings, group: "System" },
];

const NAV_GROUPS = ["General", "Catalogue", "Finance", "People", "System"] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "0") setExpanded(false);
      if (saved === "1") setExpanded(true);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Warm admin route chunks so sidebar clicks feel snappy.
  useEffect(() => {
    for (const item of NAV) {
      router.prefetch(item.href);
    }
  }, [router]);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (!pendingHref) return;
    const t = window.setTimeout(() => setPendingHref(null), 8_000);
    return () => window.clearTimeout(t);
  }, [pendingHref]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
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

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.replace("/");
  };

  const onNavClick = (href: string) => {
    if (!isActive(pathname, href)) setPendingHref(href);
    setMobileOpen(false);
  };

  const activePath = pendingHref ?? pathname;
  const navigating = Boolean(pendingHref);

  const AvatarMenu = () => (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-2 shadow-sm transition-colors",
          "hover:border-volt/40 hover:bg-volt/5",
          menuOpen && "border-volt/40 bg-volt/5",
        )}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-volt to-[hsl(351_77%_61%)] text-xs font-bold text-volt-foreground shadow-volt">
          {initials(user?.fullName)}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[140px] truncate text-sm font-semibold leading-tight">
            {user?.fullName ?? "Admin"}
          </span>
          <span className="block max-w-[140px] truncate text-[11px] text-muted-foreground">
            {user?.role ? humanize(user.role) : "Staff"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "hidden h-4 w-4 text-muted-foreground transition-transform sm:block",
            menuOpen && "rotate-180",
          )}
        />
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-2xl border border-border bg-surface shadow-lift"
        >
          <div className="border-b border-border bg-gradient-to-r from-volt/15 via-surface to-[hsl(0_0%_10%/0.1)] px-3 py-3">
            <p className="truncate text-sm font-semibold">{user?.fullName ?? "Admin"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email ?? user?.role}</p>
          </div>
          <div className="p-1.5">
            <Link
              href="/dashboard/profile"
              prefetch
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              <UserRound className="h-4 w-4 text-volt-dim" />
              Update profile
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  const Sidebar = ({ mode }: { mode: "desktop" | "mobile" }) => {
    const showLabels = mode === "mobile" || expanded;

    return (
      <>
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-border",
            showLabels ? "justify-between px-4" : "justify-center px-2",
          )}
        >
          {showLabels ? (
            <Logo href="/admin" />
          ) : (
            <Link
              href="/admin"
              prefetch
              onClick={() => onNavClick("/admin")}
              className="grid h-9 w-9 place-items-center rounded-xl bg-volt text-volt-foreground shadow-volt"
              title="Volt Trades"
            >
              <Zap className="h-5 w-5" aria-hidden />
            </Link>
          )}

          {mode === "mobile" ? (
            <button
              className="rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <button
              className={cn(
                "rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
                !showLabels &&
                  "absolute right-[-14px] top-5 z-20 border border-border bg-surface shadow-card",
              )}
              onClick={toggleExpanded}
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        <nav
          className={cn(
            "flex-1 space-y-4 overflow-y-auto py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            showLabels ? "px-3" : "px-2",
          )}
        >
          {NAV_GROUPS.map((group) => {
            const items = NAV.filter((item) => item.group === group);
            return (
              <div key={group} className="space-y-1">
                {showLabels ? (
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    {group}
                  </p>
                ) : (
                  <div className="mx-auto mb-1 h-px w-6 bg-border" />
                )}
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(activePath, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch
                      onClick={() => onNavClick(item.href)}
                      title={item.label}
                      className={cn(
                        "group relative flex items-center rounded-xl text-sm font-medium transition-all",
                        showLabels ? "gap-3 px-3 py-2" : "mx-auto h-10 w-10 justify-center",
                        active
                          ? "bg-gradient-to-r from-volt/20 to-[hsl(0_0%_10%/0.12)] text-volt-dim shadow-[inset_0_0_0_1px_hsl(var(--volt)/0.25)]"
                          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active && "text-volt-dim",
                          active && navigating && "animate-pulse",
                        )}
                        aria-hidden
                      />
                      {showLabels ? (
                        <span className="truncate">{item.label}</span>
                      ) : (
                        <span className="pointer-events-none absolute left-full z-30 ml-3 hidden whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground shadow-lift group-hover:block">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </>
    );
  };

  const desktopWidth = !hydrated || expanded ? 260 : 72;

  return (
    <div className="min-h-screen">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden h-screen flex-col border-r border-border bg-surface md:flex",
          "transition-[width] duration-200 ease-out",
        )}
        style={{ width: desktopWidth }}
      >
        <Sidebar mode="desktop" />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex h-full w-[280px] flex-col bg-surface shadow-lift">
            <Sidebar mode="mobile" />
          </aside>
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200 ease-out",
          desktopWidth === 260 ? "md:pl-[260px]" : "md:pl-[72px]",
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur sm:gap-3 sm:px-4 md:h-16 md:px-6">
          {navigating ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-volt/15"
            >
              <div className="h-full w-1/3 animate-[volt-nav-progress_0.9s_ease-in-out_infinite] bg-gradient-to-r from-volt via-[hsl(351_77%_61%)] to-volt" />
            </div>
          ) : null}

          <button
            className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <AdminGlobalSearch />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <AdminNotifications />
            <AvatarMenu />
          </div>
        </header>

        <main
          className={cn(
            "flex-1 px-4 py-6 sm:px-6 md:px-8",
            navigating && "opacity-80 transition-opacity duration-150",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
