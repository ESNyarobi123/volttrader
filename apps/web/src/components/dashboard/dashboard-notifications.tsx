"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCheck,
  GraduationCap,
  Info,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DropdownPortal } from "@/components/shared/dropdown-portal";
import { LordIcon, LORDICON_BELL } from "@/components/shared/lord-icon";

interface InboxNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

type FilterId = "all" | "unread" | "payment" | "system";

function TypeIcon({ type }: { type: string }) {
  const t = type.toUpperCase();
  if (t.includes("PAYMENT") || t.includes("WALLET") || t.includes("DEPOSIT")) {
    return <Wallet className="h-4 w-4" />;
  }
  if (t.includes("INVEST")) return <TrendingUp className="h-4 w-4" />;
  if (t.includes("COURSE") || t.includes("LEARN")) return <GraduationCap className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

function matchesFilter(n: InboxNotification, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "unread") return !n.readAt;
  const t = n.type.toUpperCase();
  if (filter === "payment") {
    return (
      t.includes("PAYMENT") ||
      t.includes("WALLET") ||
      t.includes("DEPOSIT") ||
      t.includes("WITHDRAW") ||
      t.includes("INVEST")
    );
  }
  // system / everything else
  return !(
    t.includes("PAYMENT") ||
    t.includes("WALLET") ||
    t.includes("DEPOSIT") ||
    t.includes("WITHDRAW") ||
    t.includes("INVEST")
  );
}

export function DashboardNotifications() {
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");
  const qc = useQueryClient();

  const inboxQuery = useQuery({
    queryKey: ["notifications", "me"],
    queryFn: () => api.get<InboxNotification[]>("/notifications/me"),
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications", "me"] }),
  });

  const inbox = inboxQuery.data ?? [];
  const unreadCount = inbox.filter((n) => !n.readAt).length;
  const visible = useMemo(
    () => inbox.filter((n) => matchesFilter(n, filter)),
    [inbox, filter],
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "volt-notif-btn relative grid h-10 w-10 place-items-center rounded-full border border-border bg-surface shadow-sm transition-colors",
          "hover:border-volt/40 hover:bg-volt/5",
          open && "border-volt/40 bg-volt/5",
        )}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <LordIcon
          src={LORDICON_BELL}
          trigger="loop-on-hover"
          target=".volt-notif-btn"
          colors="primary:#ffffff,secondary:#f9f9f9"
          size={26}
        />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-r from-danger to-[hsl(18_85%_52%)] px-1 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-success ring-2 ring-surface" />
        )}
      </button>

      <DropdownPortal open={open} anchorRef={btnRef} align="right" width={380}>
        <div
          ref={panelRef}
          className="w-[min(100vw-2rem,380px)] overflow-hidden rounded-2xl border border-border bg-surface text-foreground shadow-lift"
        >
          <div className="relative border-b border-border bg-gradient-to-r from-volt/20 via-surface to-[hsl(0_0%_10%/0.16)] px-4 py-3">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-volt/30 blur-2xl"
            />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold tracking-tight">Notifications</p>
                <p className="text-xs text-muted-foreground">Payments, learning & account alerts</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/80 px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                onClick={() => {
                  inbox.filter((n) => !n.readAt).forEach((n) => markRead.mutate(n.id));
                }}
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Read all
              </button>
            </div>

            <div className="relative mt-3 flex flex-wrap gap-1">
              {(
                [
                  ["all", "All"],
                  ["unread", "Unread"],
                  ["payment", "Money"],
                  ["system", "System"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    filter === id
                      ? "bg-foreground text-background"
                      : "bg-surface/80 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[min(380px,60vh)] space-y-1.5 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {inboxQuery.isLoading ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : visible.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-volt-dim" />
                <p className="mt-2 text-sm font-medium">You&apos;re all caught up</p>
                <p className="text-xs text-muted-foreground">No notifications in this filter.</p>
              </div>
            ) : (
              visible.map((item) => {
                const unread = !item.readAt;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      if (unread) markRead.mutate(item.id);
                    }}
                  >
                    <div
                      className={cn(
                        "relative overflow-hidden rounded-xl border bg-gradient-to-br from-surface-2/80 via-surface to-surface p-3 transition-colors",
                        unread
                          ? "border-volt/30 from-volt/10 shadow-sm"
                          : "border-border/70",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-volt/15 text-volt-dim">
                          <TypeIcon type={item.type} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-snug">{item.title}</p>
                            {unread ? (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-volt" />
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.body}</p>
                          <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                            {item.type.replace(/_/g, " ")} · {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-border p-2">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-volt-dim hover:bg-volt/10"
            >
              Open notification center
            </Link>
          </div>
        </div>
      </DropdownPortal>
    </div>
  );
}
