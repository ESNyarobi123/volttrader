"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Filter,
  Users,
  GraduationCap,
  LineChart,
  CreditCard,
  Banknote,
  TrendingUp,
  LayoutDashboard,
  ArrowRight,
  Command,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { humanize } from "@/lib/status";

type SearchFilter =
  | "all"
  | "pages"
  | "users"
  | "courses"
  | "opportunities"
  | "payments"
  | "withdrawals"
  | "investments";

interface SearchHit {
  id: string;
  type: Exclude<SearchFilter, "all" | "pages"> | "pages";
  title: string;
  subtitle: string;
  href: string;
}

interface SearchResponse {
  q: string;
  filter: string;
  results: Array<{
    id: string;
    type: Exclude<SearchFilter, "all" | "pages">;
    title: string;
    subtitle: string;
    href: string;
  }>;
}

const FILTERS: { id: SearchFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pages", label: "Pages" },
  { id: "users", label: "Users" },
  { id: "courses", label: "Courses" },
  { id: "opportunities", label: "Opportunities" },
  { id: "payments", label: "Payments" },
  { id: "withdrawals", label: "Withdrawals" },
  { id: "investments", label: "Investments" },
];

const PAGES: SearchHit[] = [
  { id: "p-admin", type: "pages", title: "Overview", subtitle: "System analytics dashboard", href: "/admin" },
  { id: "p-courses", type: "pages", title: "Courses", subtitle: "Forex Academy catalogue", href: "/admin/courses" },
  { id: "p-opps", type: "pages", title: "Opportunities", subtitle: "Trading Floor catalogue", href: "/admin/opportunities" },
  { id: "p-projects", type: "pages", title: "Projects", subtitle: "Roadmap & builds", href: "/admin/projects" },
  { id: "p-course-plans", type: "pages", title: "Course plans", subtitle: "Landing Forex pricing cards", href: "/admin/course-plans" },
  { id: "p-investment-plans", type: "pages", title: "Invest plans", subtitle: "Landing investment pricing cards", href: "/admin/investment-plans" },
  { id: "p-coupons", type: "pages", title: "Coupons", subtitle: "Discounts & promos", href: "/admin/coupons" },
  { id: "p-invest", type: "pages", title: "Investments", subtitle: "Portfolio records", href: "/admin/investments" },
  { id: "p-pay", type: "pages", title: "Payments", subtitle: "Gateway activity", href: "/admin/payments" },
  { id: "p-wd", type: "pages", title: "Withdrawals", subtitle: "Payout review queue", href: "/admin/withdrawals" },
  { id: "p-users", type: "pages", title: "Users", subtitle: "Accounts & roles", href: "/admin/users" },
  { id: "p-kyc", type: "pages", title: "KYC", subtitle: "Identity reviews", href: "/admin/kyc" },
  { id: "p-community", type: "pages", title: "Volt Society", subtitle: "Community members", href: "/admin/community" },
  { id: "p-support", type: "pages", title: "Support", subtitle: "Tickets & helpdesk", href: "/admin/support" },
  { id: "p-audit", type: "pages", title: "Audit logs", subtitle: "Security trail", href: "/admin/audit" },
  { id: "p-settings", type: "pages", title: "Settings", subtitle: "Platform configuration", href: "/admin/settings" },
];

const TYPE_ICON = {
  pages: LayoutDashboard,
  users: Users,
  courses: GraduationCap,
  opportunities: LineChart,
  payments: CreditCard,
  withdrawals: Banknote,
  investments: TrendingUp,
} as const;

function useDebounced(value: string, ms = 280) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function AdminGlobalSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const debounced = useDebounced(q.trim());

  const needsApi = filter !== "pages" && debounced.length > 0;

  const searchQuery = useQuery({
    queryKey: ["admin-search", debounced, filter],
    queryFn: () =>
      api.get<SearchResponse>(
        `/admin/search?q=${encodeURIComponent(debounced)}&filter=${filter === "pages" ? "all" : filter}`,
      ),
    enabled: open && needsApi,
    staleTime: 15_000,
  });

  const pageHits = useMemo(() => {
    if (filter !== "all" && filter !== "pages") return [] as SearchHit[];
    const term = debounced.toLowerCase();
    if (!term) return PAGES.slice(0, 6);
    return PAGES.filter(
      (p) => p.title.toLowerCase().includes(term) || p.subtitle.toLowerCase().includes(term),
    ).slice(0, 8);
  }, [debounced, filter]);

  const apiHits: SearchHit[] = useMemo(() => {
    if (filter === "pages") return [];
    return (searchQuery.data?.results ?? []).map((r) => ({ ...r }));
  }, [filter, searchQuery.data?.results]);

  const hits = useMemo(() => {
    if (filter === "pages") return pageHits;
    if (filter === "all") return [...pageHits, ...apiHits].slice(0, 14);
    return apiHits;
  }, [apiHits, filter, pageHits]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <div ref={rootRef} className="relative w-full max-w-xl flex-1">
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border bg-surface/90 px-3 shadow-sm transition-all",
          open
            ? "border-volt/45 ring-2 ring-volt/20"
            : "border-border hover:border-volt/30",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-volt-dim" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search users, payments, courses…"
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <span className="hidden items-center gap-1 rounded-lg border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-flex">
          <Command className="h-3 w-3" />K
        </span>
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
          <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-volt/10 via-surface to-[hsl(0_0%_10%/0.1)] px-3 py-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    filter === f.id
                      ? "bg-volt text-volt-foreground"
                      : "bg-surface-2 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {needsApi && searchQuery.isFetching ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching system…</p>
            ) : hits.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {debounced ? "No matches for this filter." : "Type to search anything in Volt Trades."}
              </p>
            ) : (
              hits.map((hit) => {
                const Icon = TYPE_ICON[hit.type] ?? Search;
                return (
                  <button
                    key={`${hit.type}-${hit.id}`}
                    type="button"
                    onClick={() => go(hit.href)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-volt/20 to-[hsl(0_0%_10%/0.15)] text-volt-dim">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{hit.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{hit.subtitle}</span>
                    </span>
                    <span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
                      {humanize(hit.type)}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span>Filter + search across the whole admin system</span>
            <Link href="/admin" onClick={() => setOpen(false)} className="font-semibold text-volt-dim hover:underline">
              Open overview
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
