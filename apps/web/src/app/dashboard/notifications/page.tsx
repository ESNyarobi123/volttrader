"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  CheckCheck,
  GraduationCap,
  Info,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { formatDate, formatDayTime } from "@/lib/format";
import { humanize } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

type FilterId = "all" | "unread" | "money" | "learning" | "system";

type Kind = "money" | "learning" | "invest" | "system";

function kindOf(type: string): Kind {
  const t = type.toUpperCase();
  if (
    t.includes("PAYMENT") ||
    t.includes("WALLET") ||
    t.includes("DEPOSIT") ||
    t.includes("WITHDRAW")
  ) {
    return "money";
  }
  if (t.includes("INVEST")) return "invest";
  if (t.includes("COURSE") || t.includes("LEARN")) return "learning";
  return "system";
}

function matchesFilter(n: NotificationItem, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "unread") return !n.readAt;
  const kind = kindOf(n.type);
  if (filter === "money") return kind === "money" || kind === "invest";
  if (filter === "learning") return kind === "learning";
  return kind === "system";
}

const KIND_META: Record<
  Kind,
  { icon: LucideIcon; label: string; wrap: string; iconWrap: string }
> = {
  money: {
    icon: Wallet,
    label: "Money",
    wrap: "from-success/15 via-surface to-surface border-success/25",
    iconWrap: "bg-success/15 text-success",
  },
  invest: {
    icon: TrendingUp,
    label: "Invest",
    wrap: "from-[hsl(var(--accent-blue)/0.16)] via-surface to-surface border-[hsl(var(--accent-blue)/0.3)]",
    iconWrap: "bg-[hsl(var(--accent-blue)/0.15)] text-[hsl(var(--accent-blue))]",
  },
  learning: {
    icon: GraduationCap,
    label: "Learn",
    wrap: "from-volt/18 via-surface to-surface border-volt/30",
    iconWrap: "bg-volt/15 text-volt-dim",
  },
  system: {
    icon: Info,
    label: "System",
    wrap: "from-surface-2/80 via-surface to-surface border-border",
    iconWrap: "bg-surface-2 text-muted-foreground",
  },
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday.getTime() - startMsg.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  return "Earlier";
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["notifications", "me"],
    queryFn: () => api.get<NotificationItem[]>("/notifications/me"),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post<NotificationItem>(`/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const items = listQuery.data ?? [];
  const unread = items.filter((n) => !n.readAt).length;
  const moneyCount = items.filter((n) => {
    const k = kindOf(n.type);
    return k === "money" || k === "invest";
  }).length;
  const learningCount = items.filter((n) => kindOf(n.type) === "learning").length;

  const visible = useMemo(
    () => items.filter((n) => matchesFilter(n, filter)),
    [items, filter],
  );

  const grouped = useMemo(() => {
    const order = ["Today", "Yesterday", "This week", "Earlier"];
    const map = new Map<string, NotificationItem[]>();
    for (const n of visible) {
      const key = dayKey(n.createdAt);
      const list = map.get(key) ?? [];
      list.push(n);
      map.set(key, list);
    }
    return order
      .filter((k) => map.has(k))
      .map((k) => ({ label: k, items: map.get(k)! }));
  }, [visible]);

  const selected = useMemo(
    () => (selectedId ? items.find((n) => n.id === selectedId) ?? null : null),
    [items, selectedId],
  );

  // Keep selection valid when filters change / item disappears
  useEffect(() => {
    if (!selectedId) return;
    if (!visible.some((n) => n.id === selectedId)) {
      setSelectedId(null);
    }
  }, [visible, selectedId]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const markAll = () => {
    items.filter((n) => !n.readAt).forEach((n) => markRead.mutate(n.id));
  };

  const openNotification = (item: NotificationItem) => {
    setSelectedId(item.id);
    if (!item.readAt) markRead.mutate(item.id);
  };

  const selectedKind = selected ? kindOf(selected.type) : null;
  const selectedMeta = selectedKind ? KIND_META[selectedKind] : null;
  const SelectedIcon = selectedMeta?.icon;

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-52 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.22),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(349_74%_36%/0.14),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            <Bell className="h-3.5 w-3.5" />
            Inbox
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap a notification to read the full details on the right.
          </p>
        </div>
        {unread > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            disabled={markRead.isPending}
            onClick={markAll}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        ) : null}
      </div>

      <section className="relative overflow-hidden rounded-[1.75rem] border border-volt/30 bg-gradient-to-br from-volt/20 via-surface to-[hsl(0_0%_10%/0.12)] p-5 shadow-card sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-volt/30 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-volt/20 text-volt-dim shadow-volt">
              <Bell className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                Status
              </p>
              <p className="font-display text-2xl font-bold tracking-tight">
                {unread > 0 ? `${unread} unread` : "You're all caught up"}
              </p>
              <p className="text-sm text-muted-foreground">
                {items.length} total · filter to focus on what matters
              </p>
            </div>
          </div>
          {unread === 0 && items.length > 0 ? (
            <Badge variant="success" className="w-fit gap-1.5 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" />
              Inbox clear
            </Badge>
          ) : null}
        </div>
      </section>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total" value={items.length} icon={Bell} tone="gold" />
        <StatTile label="Unread" value={unread} icon={Sparkles} tone="amber" />
        <StatTile label="Money" value={moneyCount} icon={Wallet} tone="green" />
        <StatTile label="Learning" value={learningCount} icon={GraduationCap} tone="blue" />
      </div>

      {listQuery.isError ? (
        <Alert variant="danger">
          {apiErrorMessage(listQuery.error, "Could not load notifications.")}
        </Alert>
      ) : null}

      <div className="relative flex flex-wrap gap-1.5">
        {(
          [
            ["all", "All"],
            ["unread", "Unread"],
            ["money", "Money"],
            ["learning", "Learning"],
            ["system", "System"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              filter === id
                ? "bg-foreground text-background shadow-sm"
                : "border border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {id === "unread" && unread > 0 ? (
              <span className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-volt px-1 text-[10px] font-bold text-volt-foreground">
                {unread}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Payment confirmations, KYC updates and system messages will show up here."
        />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-2/40 px-6 py-12 text-center">
          <p className="text-sm font-medium">Nothing in this filter</p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-2 text-sm font-semibold text-volt-dim hover:underline"
          >
            Show all notifications
          </button>
        </div>
      ) : (
        <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-start">
          {/* List */}
          <div className="space-y-6">
            {grouped.map((group) => (
              <section key={group.label} className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold tracking-tight">{group.label}</h2>
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {group.items.length}
                  </span>
                </div>
                <ul className="space-y-2">
                  {group.items.map((item) => {
                    const kind = kindOf(item.type);
                    const meta = KIND_META[kind];
                    const Icon = meta.icon;
                    const unreadItem = !item.readAt;
                    const active = selectedId === item.id;

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => openNotification(item)}
                          className={cn(
                            "relative w-full overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left shadow-card transition-all",
                            meta.wrap,
                            unreadItem && "ring-1 ring-volt/20",
                            active && "border-volt/50 shadow-lift ring-2 ring-volt/30",
                          )}
                        >
                          {unreadItem ? (
                            <span
                              aria-hidden
                              className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-volt to-[hsl(351_77%_61%)]"
                            />
                          ) : null}
                          <div className="flex items-start gap-3 pl-1">
                            <span
                              className={cn(
                                "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                                meta.iconWrap,
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold tracking-tight">{item.title}</h3>
                                {unreadItem ? (
                                  <span className="rounded-full bg-volt/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-volt-dim">
                                    New
                                  </span>
                                ) : null}
                                <Badge variant="default">{meta.label}</Badge>
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                                {item.body}
                              </p>
                              <p className="mt-1.5 text-xs text-muted-foreground">
                                {formatDayTime(item.createdAt)}
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {/* Desktop sticky detail card (right) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-card">
              {selected && selectedMeta && SelectedIcon ? (
                <>
                  <div
                    className={cn(
                      "relative border-b border-border bg-gradient-to-br px-5 py-5",
                      selectedMeta.wrap,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          "grid h-12 w-12 place-items-center rounded-2xl",
                          selectedMeta.iconWrap,
                        )}
                      >
                        <SelectedIcon className="h-5 w-5" />
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface/90 text-muted-foreground hover:text-foreground"
                        aria-label="Close details"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {selectedMeta.label} · {humanize(selected.type)}
                    </p>
                    <h2 className="mt-1 font-display text-xl font-bold tracking-tight">
                      {selected.title}
                    </h2>
                  </div>
                  <div className="space-y-4 px-5 py-5">
                    <p className="text-sm leading-relaxed text-foreground/90">{selected.body}</p>
                    <dl className="space-y-2 rounded-xl border border-border bg-surface-2/50 p-3 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Received</dt>
                        <dd className="font-medium">{formatDayTime(selected.createdAt)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Date</dt>
                        <dd className="font-medium">{formatDate(selected.createdAt)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Status</dt>
                        <dd className="font-medium">
                          {selected.readAt ? "Read" : "Unread"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Type</dt>
                        <dd className="font-medium">{humanize(selected.type)}</dd>
                      </div>
                    </dl>
                    {!selected.readAt ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full rounded-full"
                        disabled={markRead.isPending}
                        onClick={() => markRead.mutate(selected.id)}
                      >
                        <Check className="h-4 w-4" />
                        Mark as read
                      </Button>
                    ) : (
                      <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Marked as read
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-volt/15 text-volt-dim">
                    <Bell className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-semibold">Select a notification</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click any item on the left to see full details here.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Mobile detail sheet (right drawer) */}
      {selected && selectedMeta && SelectedIcon ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Close details"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setSelectedId(null)}
          />
          <aside
            className="volt-slide-in-right absolute inset-y-0 right-0 flex w-full max-w-[400px] flex-col border-l border-border bg-surface shadow-lift"
            role="dialog"
            aria-modal="true"
            aria-label="Notification details"
          >
            <div
              className={cn(
                "relative shrink-0 border-b border-border bg-gradient-to-br px-5 py-5",
                selectedMeta.wrap,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-2xl",
                    selectedMeta.iconWrap,
                  )}
                >
                  <SelectedIcon className="h-5 w-5" />
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface/90 text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {selectedMeta.label} · {humanize(selected.type)}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold tracking-tight">
                {selected.title}
              </h2>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <p className="text-sm leading-relaxed text-foreground/90">{selected.body}</p>
              <dl className="space-y-2 rounded-xl border border-border bg-surface-2/50 p-3 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Received</dt>
                  <dd className="font-medium">{formatDayTime(selected.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="font-medium">{formatDate(selected.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium">{selected.readAt ? "Read" : "Unread"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">{humanize(selected.type)}</dd>
                </div>
              </dl>
            </div>
            <div className="shrink-0 border-t border-border p-4">
              {!selected.readAt ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full rounded-full"
                  disabled={markRead.isPending}
                  onClick={() => markRead.mutate(selected.id)}
                >
                  <Check className="h-4 w-4" />
                  Mark as read
                </Button>
              ) : (
                <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Marked as read
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
