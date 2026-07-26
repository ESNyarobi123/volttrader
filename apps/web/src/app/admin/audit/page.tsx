"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollText,
  Search,
  Eye,
  Shield,
  CalendarDays,
  Users,
  Activity,
  Globe,
  Fingerprint,
  type LucideIcon,
} from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { humanize } from "@/lib/status";
import { cn } from "@/lib/utils";
import { StatChip } from "@/components/ui/stat-chip";
import { formatDateTime, formatTimeOfDay, initials } from "@/lib/format";

interface AuditActor {
  id: string;
  fullName: string;
  email: string | null;
  role: string;
}

interface AuditRow {
  id: string;
  createdAt: string;
  actorId: string | null;
  actor: AuditActor | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  metadata: unknown;
}

interface AuditStats {
  total: number;
  today: number;
  week: number;
  uniqueActors: number;
}

type DomainFilter =
  | "ALL"
  | "auth"
  | "user"
  | "payment"
  | "withdrawal"
  | "investment"
  | "kyc"
  | "support"
  | "community"
  | "coupon"
  | "course"
  | "opportunity"
  | "project";

const DOMAINS: DomainFilter[] = [
  "ALL",
  "auth",
  "user",
  "payment",
  "withdrawal",
  "investment",
  "kyc",
  "support",
  "community",
  "coupon",
  "course",
  "opportunity",
  "project",
];

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function domainOf(action: string) {
  return action.split(".")[0] ?? action;
}

function verbOf(action: string) {
  const parts = action.split(".");
  return parts.slice(1).join(".") || action;
}

function actionTone(action: string): "gold" | "green" | "blue" | "amber" | "danger" | "ink" {
  const d = domainOf(action);
  if (d === "auth") return "blue";
  if (d === "payment" || d === "withdrawal" || d === "investment") return "gold";
  if (d === "kyc" || d === "user") return "amber";
  if (action.includes("deleted") || action.includes("failed") || action.includes("rejected"))
    return "danger";
  if (action.includes("created") || action.includes("confirmed") || action.includes("approved"))
    return "green";
  return "ink";
}

function actionBadgeVariant(action: string) {
  const tone = actionTone(action);
  if (tone === "green") return "success" as const;
  if (tone === "danger") return "danger" as const;
  if (tone === "amber") return "warning" as const;
  if (tone === "blue") return "info" as const;
  if (tone === "gold") return "volt" as const;
  return "default" as const;
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminAuditPage() {
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<DomainFilter>("ALL");
  const [entityFilter, setEntityFilter] = useState<string>("ALL");
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["admin-audit-stats"],
    queryFn: () => api.get<AuditStats>("/admin/audit-logs/stats"),
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-audit", domainFilter],
    queryFn: () => {
      const qs = new URLSearchParams({ page: "1", pageSize: "100" });
      if (domainFilter !== "ALL") qs.set("domain", domainFilter);
      return api.get<AuditRow[]>(`/admin/audit-logs?${qs.toString()}`);
    },
  });

  const rows = data ?? [];

  const entityTypes = useMemo(() => {
    const set = new Set(rows.map((r) => r.entityType));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (entityFilter !== "ALL" && r.entityType !== entityFilter) return false;
      if (!term) return true;
      const hay = [
        r.action,
        r.entityType,
        r.entityId ?? "",
        r.ip ?? "",
        r.actor?.fullName ?? "",
        r.actor?.email ?? "",
        r.actor?.role ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rows, search, entityFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, AuditRow[]>();
    for (const row of filtered) {
      const key = dayKey(row.createdAt);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const openDetail = async (row: AuditRow) => {
    setDetail(row);
    try {
      const full = await api.get<AuditRow>(`/admin/audit-logs/${row.id}`);
      setDetail(full);
    } catch {
      /* keep list row */
    }
  };

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.2),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(349_74%_36%/0.12),transparent_55%)]"
      />

      <div className="relative">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
          System · Security trail
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Audit logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only history of admin, auth, and financial actions.
        </p>
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip icon={ScrollText} label="Total events" value={stats?.total ?? rows.length} tone="gold" />
        <StatChip icon={CalendarDays} label="Today" value={stats?.today ?? 0} tone="amber" />
        <StatChip icon={Activity} label="Last 7 days" value={stats?.week ?? 0} tone="blue" />
        <StatChip icon={Users} label="Actors" value={stats?.uniqueActors ?? 0} tone="green" />
      </div>

      <Card className="relative overflow-hidden border-volt/20 bg-gradient-to-br from-volt/10 via-surface to-[hsl(349_74%_36%/0.08)] shadow-card">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(349_74%_36%)]"
        />
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3">
            <Search className="h-4 w-4 text-volt-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, actor, IP, entity…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="md:w-44">
            <Select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value as DomainFilter)}
            >
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d === "ALL" ? "All domains" : humanize(d)}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:w-44">
            <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
              <option value="ALL">All entities</option>
              {entityTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="danger">
          {apiErrorMessage(error, "Could not load audit logs.")}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={rows.length === 0 ? "No audit events" : "No matches"}
          description={
            rows.length === 0
              ? "Sensitive actions will appear here as they happen."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="relative space-y-8">
          {grouped.map(([day, events]) => (
            <section key={day} className="space-y-3">
              <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/80 py-1 backdrop-blur">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {day}
                </h2>
                <div className="h-px flex-1 bg-border/70" />
                <span className="text-[11px] text-muted-foreground">
                  {events.length} event{events.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="relative space-y-3 pl-3 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border/80">
                {events.map((row) => {
                  const tone = actionTone(row.action);
                  return (
                    <article
                      key={row.id}
                      className="group relative ml-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-surface-2 shadow-card transition-shadow hover:shadow-lift"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute -left-[23px] top-6 h-3 w-3 rounded-full border-2 border-surface ring-2",
                          tone === "gold" && "bg-volt ring-volt/30",
                          tone === "green" && "bg-success ring-success/30",
                          tone === "blue" && "bg-[hsl(var(--accent-blue))] ring-[hsl(var(--accent-blue)/0.3)]",
                          tone === "amber" && "bg-warning ring-warning/30",
                          tone === "danger" && "bg-danger ring-danger/30",
                          tone === "ink" && "bg-muted-foreground ring-border",
                        )}
                      />
                      <div
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(349_74%_36%)] opacity-70"
                      />
                      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={actionBadgeVariant(row.action)}>
                              {humanize(verbOf(row.action))}
                            </Badge>
                            <Badge variant="default">{humanize(domainOf(row.action))}</Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {formatTimeOfDay(row.createdAt)}
                            </span>
                          </div>
                          <p className="font-mono text-sm font-semibold tracking-tight">
                            {row.action}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="grid h-6 w-6 place-items-center rounded-full bg-volt/15 text-[10px] font-bold text-volt-dim">
                                {row.actor ? initials(row.actor.fullName) : "SY"}
                              </span>
                              {row.actor?.fullName ?? "System"}
                              {row.actor?.role ? (
                                <span className="text-[10px] uppercase tracking-wide opacity-70">
                                  · {humanize(row.actor.role)}
                                </span>
                              ) : null}
                            </span>
                            <span>
                              {row.entityType}
                              {row.entityId ? (
                                <span className="ml-1 font-mono text-[10px] opacity-70">
                                  {row.entityId.slice(0, 10)}…
                                </span>
                              ) : null}
                            </span>
                            {row.ip ? (
                              <span className="inline-flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {row.ip}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="shrink-0"
                          onClick={() => void openDetail(row)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent
          className="max-w-2xl overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setDetail(null)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(349_74%_36%/0.15)] px-6 pb-5 pt-6">
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  <Shield className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Audit event
                  </p>
                  <DialogTitle className="font-display font-mono text-xl">
                    {detail?.action ?? "Event"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {detail ? formatDateTime(detail.createdAt, { seconds: true }) : ""}
                  </DialogDescription>
                </div>
              </div>
              {detail ? (
                <div className="relative mt-4 flex flex-wrap gap-2">
                  <Badge variant={actionBadgeVariant(detail.action)}>
                    {humanize(verbOf(detail.action))}
                  </Badge>
                  <Badge variant="volt">{humanize(domainOf(detail.action))}</Badge>
                  <Badge variant="default">{detail.entityType}</Badge>
                </div>
              ) : null}
            </div>

            {detail ? (
              <div className="max-h-[min(70vh,640px)] space-y-4 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetaTile
                    icon={Users}
                    label="Actor"
                    value={detail.actor?.fullName ?? "System"}
                    hint={
                      detail.actor
                        ? `${detail.actor.email ?? "—"} · ${humanize(detail.actor.role)}`
                        : "Automated / unknown"
                    }
                  />
                  <MetaTile
                    icon={Globe}
                    label="IP address"
                    value={detail.ip ?? "—"}
                    hint="Source of the request"
                  />
                  <MetaTile
                    icon={Fingerprint}
                    label="Entity"
                    value={detail.entityType}
                    hint={detail.entityId ?? "No entity id"}
                    monoHint
                  />
                  <MetaTile
                    icon={Activity}
                    label="Event id"
                    value={detail.id.slice(0, 14) + "…"}
                    hint={detail.id}
                    monoHint
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Metadata
                  </p>
                  {detail.metadata == null ? (
                    <p className="rounded-xl border border-border/70 bg-surface-2/40 px-4 py-3 text-sm text-muted-foreground">
                      No extra metadata for this event.
                    </p>
                  ) : (
                    <pre className="overflow-x-auto rounded-xl border border-border/70 bg-ink/95 p-4 font-mono text-[12px] leading-relaxed text-[hsl(351_77%_75%)]">
                      {prettyJson(detail.metadata)}
                    </pre>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <Button variant="outline" onClick={() => setDetail(null)}>
                    Close
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetaTile({
  icon: Icon,
  label,
  value,
  hint,
  monoHint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  monoHint?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface-2/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-volt-dim" />
        {label}
      </div>
      <p className="truncate text-sm font-semibold">{value}</p>
      {hint ? (
        <p
          className={cn(
            "mt-0.5 truncate text-[11px] text-muted-foreground",
            monoHint && "font-mono",
          )}
          title={hint}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
