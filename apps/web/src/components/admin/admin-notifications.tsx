"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  CircleAlert,
  Info,
  ShieldAlert,
  ServerCrash,
  Sparkles,
  Wallet,
  LifeBuoy,
} from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

interface InboxNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface SystemAlert {
  id: string;
  kind: "finance" | "compliance" | "support" | "system";
  severity: "info" | "warning" | "danger" | "success";
  title: string;
  body: string;
  href: string;
  createdAt: string;
}

interface AlertsResponse {
  items: SystemAlert[];
  checkedAt: string;
}

type FeedItem = {
  id: string;
  source: "inbox" | "system";
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  unread?: boolean;
  severity?: SystemAlert["severity"];
  kind?: SystemAlert["kind"] | string;
};

const SEVERITY_STYLE: Record<
  NonNullable<FeedItem["severity"]>,
  { wrap: string; icon: string }
> = {
  success: {
    wrap: "from-success/15 to-surface border-success/25",
    icon: "bg-success/15 text-success",
  },
  warning: {
    wrap: "from-warning/15 to-surface border-warning/25",
    icon: "bg-warning/15 text-[hsl(var(--warning))]",
  },
  danger: {
    wrap: "from-danger/12 to-surface border-danger/25",
    icon: "bg-danger/15 text-danger",
  },
  info: {
    wrap: "from-[hsl(var(--accent-blue)/0.14)] to-surface border-[hsl(var(--accent-blue)/0.25)]",
    icon: "bg-[hsl(var(--accent-blue)/0.15)] text-[hsl(var(--accent-blue))]",
  },
};

function KindIcon({ kind, severity }: { kind?: string; severity?: FeedItem["severity"] }) {
  if (kind === "finance") return <Wallet className="h-4 w-4" />;
  if (kind === "compliance") return <ShieldAlert className="h-4 w-4" />;
  if (kind === "support") return <LifeBuoy className="h-4 w-4" />;
  if (kind === "system" && severity === "danger") return <ServerCrash className="h-4 w-4" />;
  if (severity === "success") return <Sparkles className="h-4 w-4" />;
  if (severity === "warning") return <CircleAlert className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

export function AdminNotifications() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "system" | "inbox">("all");
  const qc = useQueryClient();

  const inboxQuery = useQuery({
    queryKey: ["notifications", "me"],
    queryFn: () => api.get<InboxNotification[]>("/notifications/me"),
    refetchInterval: (q) => (q.state.error ? false : 30_000),
    retry: (count, err) => {
      if (err instanceof ApiRequestError && err.status === 401) return false;
      return count < 2;
    },
  });

  const alertsQuery = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => api.get<AlertsResponse>("/admin/alerts"),
    refetchInterval: (q) => (q.state.error ? false : 20_000),
    retry: (count, err) => {
      if (err instanceof ApiRequestError && err.status === 401) return false;
      return count < 2;
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications", "me"] }),
  });

  const inbox = inboxQuery.data ?? [];
  const alerts = alertsQuery.data?.items ?? [];

  const feed: FeedItem[] = useMemo(() => {
    const systemItems: FeedItem[] = alerts.map((a) => ({
      id: a.id,
      source: "system",
      title: a.title,
      body: a.body,
      href: a.href,
      createdAt: a.createdAt,
      severity: a.severity,
      kind: a.kind,
      unread: a.severity === "danger" || a.severity === "warning",
    }));
    const inboxItems: FeedItem[] = inbox.map((n) => ({
      id: n.id,
      source: "inbox",
      title: n.title,
      body: n.body,
      createdAt: n.createdAt,
      unread: !n.readAt,
      severity: "info",
      kind: n.type,
    }));
    return [...systemItems, ...inboxItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [alerts, inbox]);

  const visible = feed.filter((f) => {
    if (tab === "system") return f.source === "system";
    if (tab === "inbox") return f.source === "inbox";
    return true;
  });

  const unreadCount =
    inbox.filter((n) => !n.readAt).length +
    alerts.filter((a) => a.severity === "danger" || a.severity === "warning").length;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative grid h-10 w-10 place-items-center rounded-full border border-border bg-surface shadow-sm transition-colors",
          "hover:border-volt/40 hover:bg-volt/5",
          open && "border-volt/40 bg-volt/5",
        )}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4 text-foreground" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-r from-danger to-[hsl(18_85%_52%)] px-1 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-success ring-2 ring-surface" />
        )}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(100vw-2rem,380px)] overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
          <div className="relative border-b border-border bg-gradient-to-r from-volt/20 via-surface to-[hsl(0_0%_10%/0.16)] px-4 py-3">
            <div aria-hidden className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-volt/30 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold tracking-tight">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  System alerts, finance updates & inbox
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/80 px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                onClick={() => {
                  inbox
                    .filter((n) => !n.readAt)
                    .forEach((n) => markRead.mutate(n.id));
                }}
                title="Mark inbox as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Read all
              </button>
            </div>

            <div className="relative mt-3 flex gap-1">
              {(
                [
                  ["all", "All"],
                  ["system", "System"],
                  ["inbox", "Inbox"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    tab === id
                      ? "bg-foreground text-background"
                      : "bg-surface/80 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[420px] space-y-1.5 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {inboxQuery.isLoading || alertsQuery.isLoading ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading updates…</p>
            ) : visible.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-volt-dim" />
                <p className="mt-2 text-sm font-medium">You&apos;re all caught up</p>
                <p className="text-xs text-muted-foreground">No new system or inbox updates.</p>
              </div>
            ) : (
              visible.map((item) => {
                const style = SEVERITY_STYLE[item.severity ?? "info"];
                const content = (
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 transition-colors",
                      style.wrap,
                      item.unread && "shadow-sm",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl", style.icon)}>
                        <KindIcon kind={item.kind} severity={item.severity} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug">{item.title}</p>
                          {item.unread ? (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-volt" />
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.body}</p>
                        <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                          {item.source === "system" ? "System" : "Inbox"} · {formatDate(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );

                if (item.href) {
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        if (item.source === "inbox" && item.unread) markRead.mutate(item.id);
                        setOpen(false);
                      }}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      if (item.source === "inbox" && item.unread) markRead.mutate(item.id);
                    }}
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
