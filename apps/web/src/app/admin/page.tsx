"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  CreditCard,
  Banknote,
  TrendingUp,
  GraduationCap,
  ShieldCheck,
  LifeBuoy,
  Sparkles,
  Activity,
  Server,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type { Money } from "@volt/types";
import type { Currency } from "@volt/config";
import { api, ApiRequestError } from "@/lib/api";
import { StatTile, type StatTone } from "@/components/ui/stat-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CHART_COLORS, MIX_PAIRS } from "@/components/charts/chart-theme";
import { BarGroup, Donut, TrendArea } from "@/components/charts/lazy";
import { formatDate, formatMoney } from "@/lib/format";
import { humanize, statusVariant } from "@/lib/status";
import { cn } from "@/lib/utils";

interface AdminStats {
  currency: string;
  totals: {
    users: number;
    courses: number;
    publishedCourses: number;
    opportunities: number;
    openOpportunities: number;
    activeInvestments: number;
    pendingWithdrawals: number;
    pendingKyc: number;
    openTickets: number;
    communityMembers: number;
    enrollments: number;
  };
  money: {
    grossVolume: number;
    depositsTotal: number;
    withdrawalsPaidTotal: number;
    courseSalesTotal: number;
    investmentFundingTotal: number;
  };
  paymentsByStatus: Record<string, number>;
  investmentsByStatus: Record<string, number>;
  usersByKyc: Record<string, number>;
  timeseries: Array<{ date: string; deposits: number; withdrawals: number; signups: number }>;
  recent: {
    payments: Array<{
      id: string;
      type: string;
      status: string;
      amount: Money;
      gateway: string;
      createdAt: string;
    }>;
    signups: Array<{ id: string; fullName: string; email: string | null; createdAt: string }>;
    withdrawals: Array<{
      id: string;
      amount: Money;
      status: string;
      method: string;
      createdAt: string;
    }>;
  };
}

interface SystemStatus {
  overall: "healthy" | "degraded" | "down";
  checkedAt: string;
  services: Array<{
    id: string;
    name: string;
    container: string;
    status: "up" | "down";
    latencyMs: number | null;
    detail: string;
  }>;
}

type PanelTone = "gold" | "blue" | "green" | "rose" | "amber" | "teal";

const PANEL: Record<
  PanelTone,
  { shell: string; bar: string; glow: string; icon: string; chip: string }
> = {
  gold: {
    shell: "border-volt/30 bg-gradient-to-br from-volt/15 via-surface to-surface",
    bar: "from-volt via-[hsl(349_74%_36%)] to-[hsl(0_0%_10%)]",
    glow: "bg-volt/30",
    icon: "bg-volt/20 text-volt-dim",
    chip: "bg-volt/15 text-volt-dim border-volt/30",
  },
  blue: {
    shell:
      "border-[hsl(var(--accent-blue)/0.3)] bg-gradient-to-br from-[hsl(var(--accent-blue)/0.14)] via-surface to-surface",
    bar: "from-[hsl(0_0%_10%)] via-[hsl(349_74%_36%)] to-[hsl(142_65%_32%)]",
    glow: "bg-[hsl(var(--accent-blue)/0.25)]",
    icon: "bg-[hsl(var(--accent-blue)/0.18)] text-[hsl(var(--accent-blue))]",
    chip: "bg-[hsl(var(--accent-blue)/0.12)] text-[hsl(var(--accent-blue))] border-[hsl(var(--accent-blue)/0.3)]",
  },
  green: {
    shell: "border-success/30 bg-gradient-to-br from-success/12 via-surface to-surface",
    bar: "from-success via-[hsl(142_65%_29%)] to-[hsl(350_73%_44%)]",
    glow: "bg-success/25",
    icon: "bg-success/15 text-success",
    chip: "bg-success/10 text-success border-success/30",
  },
  rose: {
    shell: "border-danger/25 bg-gradient-to-br from-danger/10 via-surface to-surface",
    bar: "from-danger via-[hsl(18_85%_52%)] to-warning",
    glow: "bg-danger/20",
    icon: "bg-danger/12 text-danger",
    chip: "bg-danger/10 text-danger border-danger/25",
  },
  amber: {
    shell: "border-warning/30 bg-gradient-to-br from-warning/14 via-surface to-surface",
    bar: "from-warning via-volt to-[hsl(30_10%_28%)]",
    glow: "bg-warning/25",
    icon: "bg-warning/15 text-[hsl(var(--warning))]",
    chip: "bg-warning/10 text-[hsl(var(--warning))] border-warning/30",
  },
  teal: {
    shell:
      "border-[hsl(142_65%_29%/0.35)] bg-gradient-to-br from-[hsl(142_65%_29%/0.14)] via-surface to-surface",
    bar: "from-[hsl(142_65%_32%)] via-[hsl(351_77%_61%)] to-volt",
    glow: "bg-[hsl(142_65%_32%/0.25)]",
    icon: "bg-[hsl(142_65%_32%/0.15)] text-[hsl(162_55%_36%)]",
    chip: "bg-[hsl(142_65%_32%/0.12)] text-[hsl(162_55%_36%)] border-[hsl(142_65%_29%/0.3)]",
  },
};

function moneyFromMinor(amount: number, currency: string): Money {
  return { amount, currency: currency as Currency };
}

function toDonut(record: Record<string, number>) {
  return Object.entries(record)
    .filter(([, value]) => value > 0)
    .map(([name, value], i) => ({
      name: humanize(name),
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
      colorTo: MIX_PAIRS[i % MIX_PAIRS.length][1],
    }));
}

function shortDay(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function AdminOverviewPage() {
  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminStats>("/admin/stats"),
    refetchInterval: 60_000,
  });

  const systemQuery = useQuery({
    queryKey: ["admin-system"],
    queryFn: () => api.get<SystemStatus>("/admin/system"),
    refetchInterval: 20_000,
  });

  const stats = statsQuery.data;
  const currency = stats?.currency ?? "TZS";

  const flowSeries = useMemo(
    () => [
      {
        key: "deposits",
        label: "Deposits",
        color: "hsl(142 65% 29%)",
        colorTo: "hsl(350 73% 44%)",
      },
      {
        key: "withdrawals",
        label: "Withdrawals",
        color: "hsl(0 100% 45%)",
        colorTo: "hsl(349 74% 36%)",
      },
    ],
    [],
  );

  const signupSeries = useMemo(
    () => [
      {
        key: "signups",
        label: "Signups",
        color: "hsl(350 73% 44%)",
        colorTo: "hsl(351 77% 61%)",
      },
    ],
    [],
  );

  const timeseries = useMemo(
    () =>
      (stats?.timeseries ?? []).map((row) => ({
        ...row,
        label: shortDay(row.date),
      })),
    [stats?.timeseries],
  );

  const paymentsDonut = useMemo(() => toDonut(stats?.paymentsByStatus ?? {}), [stats?.paymentsByStatus]);
  const investmentsDonut = useMemo(
    () => toDonut(stats?.investmentsByStatus ?? {}),
    [stats?.investmentsByStatus],
  );
  const kycDonut = useMemo(() => toDonut(stats?.usersByKyc ?? {}), [stats?.usersByKyc]);

  const loading = statsQuery.isLoading;
  const errorMessage =
    statsQuery.error instanceof ApiRequestError
      ? statsQuery.error.message
      : statsQuery.isError
        ? "Could not load analytics."
        : null;

  const kpi: Array<{
    label: string;
    value: ReactNode;
    icon: LucideIcon;
    tone: StatTone;
    hint?: string;
  }> = [
    { label: "Users", value: loading ? "…" : (stats?.totals.users ?? 0), icon: Users, tone: "blue" },
    {
      label: "Gross volume",
      value: loading ? "…" : formatMoney(moneyFromMinor(stats?.money.grossVolume ?? 0, currency)),
      icon: CreditCard,
      tone: "gold",
    },
    {
      label: "Active investments",
      value: loading ? "…" : (stats?.totals.activeInvestments ?? 0),
      icon: TrendingUp,
      tone: "green",
    },
    {
      label: "Pending withdrawals",
      value: loading ? "…" : (stats?.totals.pendingWithdrawals ?? 0),
      icon: Banknote,
      tone: "rose",
      hint: stats?.totals.pendingWithdrawals ? "Needs review" : undefined,
    },
    {
      label: "Pending KYC",
      value: loading ? "…" : (stats?.totals.pendingKyc ?? 0),
      icon: ShieldCheck,
      tone: "amber",
    },
    {
      label: "Courses",
      value: loading ? "…" : `${stats?.totals.publishedCourses ?? 0}/${stats?.totals.courses ?? 0}`,
      icon: GraduationCap,
      tone: "blue",
      hint: "Published / total",
    },
    {
      label: "Open tickets",
      value: loading ? "…" : (stats?.totals.openTickets ?? 0),
      icon: LifeBuoy,
      tone: "ink",
    },
    {
      label: "Society",
      value: loading ? "…" : (stats?.totals.communityMembers ?? 0),
      icon: Sparkles,
      tone: "gold",
      hint: "Community members",
    },
  ];

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-8 h-48 rounded-[2rem] bg-[radial-gradient(60%_80%_at_10%_0%,hsl(350_73%_44%/0.18),transparent_60%),radial-gradient(50%_70%_at_90%_10%,hsl(0_0%_10%/0.14),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            Analytics studio
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">System overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Color-mixed KPIs, money flow, donut breakdowns, and live Docker health.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-volt/40 bg-volt/10 hover:bg-volt/20"
          onClick={() => {
            void statsQuery.refetch();
            void systemQuery.refetch();
          }}
        >
          <RefreshCw
            className={cn(
              "h-3.5 w-3.5",
              (statsQuery.isFetching || systemQuery.isFetching) && "animate-spin",
            )}
          />
          Refresh
        </Button>
      </div>

      {errorMessage ? (
        <Card className="border-danger/40 bg-danger/5">
          <CardContent className="p-4 text-sm text-danger">{errorMessage}</CardContent>
        </Card>
      ) : null}

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        {kpi.map((item) => (
          <StatTile
            key={item.label}
            label={item.label}
            value={item.value}
            icon={item.icon}
            tone={item.tone}
            hint={item.hint}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AnalyticPanel
          className="lg:col-span-2"
          tone="green"
          icon={Activity}
          title="Money flow · 14 days"
          description="Deposits vs withdrawals — teal/gold × rose/amber mixers."
        >
          {loading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <TrendArea
              data={timeseries}
              xKey="label"
              series={flowSeries}
              height={260}
              format={(v) => formatMoney(moneyFromMinor(v, currency))}
            />
          )}
        </AnalyticPanel>

        <AnalyticPanel
          tone="gold"
          icon={Users}
          title="Signups · 14 days"
          description="Gold → blue histogram bars."
        >
          {loading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            <BarGroup data={timeseries} xKey="label" series={signupSeries} height={240} />
          )}
        </AnalyticPanel>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <BreakdownCard
          title="Payments by status"
          tone="blue"
          loading={loading}
          data={paymentsDonut}
          centerValue={String(Object.values(stats?.paymentsByStatus ?? {}).reduce((a, b) => a + b, 0))}
          centerLabel="Payments"
        />
        <BreakdownCard
          title="Investments by status"
          tone="teal"
          loading={loading}
          data={investmentsDonut}
          centerValue={String(
            Object.values(stats?.investmentsByStatus ?? {}).reduce((a, b) => a + b, 0),
          )}
          centerLabel="Investments"
        />
        <BreakdownCard
          title="Users by KYC"
          tone="amber"
          loading={loading}
          data={kycDonut}
          centerValue={String(stats?.totals.users ?? 0)}
          centerLabel="Users"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <MoneyTile
          label="Deposits"
          value={stats?.money.depositsTotal ?? 0}
          currency={currency}
          loading={loading}
          tone="green"
        />
        <MoneyTile
          label="Course sales"
          value={stats?.money.courseSalesTotal ?? 0}
          currency={currency}
          loading={loading}
          tone="blue"
        />
        <MoneyTile
          label="Investment funding"
          value={stats?.money.investmentFundingTotal ?? 0}
          currency={currency}
          loading={loading}
          tone="gold"
        />
        <MoneyTile
          label="Withdrawals paid"
          value={stats?.money.withdrawalsPaidTotal ?? 0}
          currency={currency}
          loading={loading}
          tone="rose"
        />
      </div>

      <AnalyticPanel
        tone="teal"
        icon={Server}
        title="Container & service status"
        description={
          systemQuery.data
            ? `Live Docker probes · checked ${new Date(systemQuery.data.checkedAt).toLocaleTimeString()}.`
            : "Live Docker probes for Volt infra."
        }
        trailing={
          systemQuery.data ? (
            <Badge
              variant={
                systemQuery.data.overall === "healthy"
                  ? "success"
                  : systemQuery.data.overall === "degraded"
                    ? "warning"
                    : "danger"
              }
            >
              {humanize(systemQuery.data.overall)}
            </Badge>
          ) : null
        }
      >
        {systemQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : systemQuery.isError ? (
          <p className="text-sm text-danger">Could not probe system services.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {systemQuery.data?.services.map((service, idx) => (
              <div
                key={service.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-4",
                  service.status === "up"
                    ? "border-success/35 bg-gradient-to-br from-success/15 via-surface to-[hsl(142_65%_32%/0.08)]"
                    : "border-danger/35 bg-gradient-to-br from-danger/12 via-surface to-warning/10",
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    "absolute -right-4 -top-4 h-16 w-16 rounded-full blur-2xl",
                    service.status === "up" ? "bg-success/30" : "bg-danger/25",
                  )}
                />
                <div className="relative flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{service.name}</p>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full ring-4",
                      service.status === "up"
                        ? "bg-success ring-success/20"
                        : "bg-danger ring-danger/20",
                    )}
                  />
                </div>
                <p className="relative mt-1 font-mono text-[11px] text-muted-foreground">
                  {service.container}
                </p>
                <p className="relative mt-2 text-xs text-muted-foreground">{service.detail}</p>
                <div className="relative mt-3 flex items-center justify-between">
                  <p className="text-xs font-semibold">
                    {service.status === "up" ? (
                      <span className="text-success">
                        Up{service.latencyMs != null ? ` · ${service.latencyMs}ms` : ""}
                      </span>
                    ) : (
                      <span className="text-danger">Down</span>
                    )}
                  </p>
                  <span
                    className="h-1.5 w-10 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${CHART_COLORS[idx % CHART_COLORS.length]}, ${MIX_PAIRS[idx % MIX_PAIRS.length][1]})`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </AnalyticPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <ActivityCard
          title="Recent payments"
          href="/admin/payments"
          tone="blue"
          loading={loading}
          empty="No payments yet"
          count={stats?.recent.payments.length ?? 0}
        >
          {stats?.recent.payments.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{humanize(p.type)}</p>
                <p className="text-xs text-muted-foreground">
                  {p.gateway} · {formatDate(p.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatMoney(p.amount)}</p>
                <Badge variant={statusVariant(p.status)}>{humanize(p.status)}</Badge>
              </div>
            </li>
          ))}
        </ActivityCard>

        <ActivityCard
          title="Recent signups"
          href="/admin/users"
          tone="gold"
          loading={loading}
          empty="No signups yet"
          count={stats?.recent.signups.length ?? 0}
        >
          {stats?.recent.signups.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{u.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email ?? "—"}</p>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">{formatDate(u.createdAt)}</p>
            </li>
          ))}
        </ActivityCard>

        <ActivityCard
          title="Recent withdrawals"
          href="/admin/withdrawals"
          tone="rose"
          loading={loading}
          empty="No withdrawals yet"
          count={stats?.recent.withdrawals.length ?? 0}
        >
          {stats?.recent.withdrawals.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{humanize(w.method)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(w.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatMoney(w.amount)}</p>
                <Badge variant={statusVariant(w.status)}>{humanize(w.status)}</Badge>
              </div>
            </li>
          ))}
        </ActivityCard>
      </div>
    </div>
  );
}

function AnalyticPanel({
  tone,
  icon: Icon,
  title,
  description,
  trailing,
  className,
  children,
}: {
  tone: PanelTone;
  icon: LucideIcon;
  title: string;
  description?: string;
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const t = PANEL[tone];
  return (
    <Card className={cn("relative overflow-hidden shadow-card", t.shell, className)}>
      <div aria-hidden className={cn("absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r", t.bar)} />
      <div aria-hidden className={cn("pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl", t.glow)} />
      <CardHeader className="relative flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-xl", t.icon)}>
              <Icon className="h-4 w-4" />
            </span>
            {title}
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {trailing}
      </CardHeader>
      <CardContent className="relative">{children}</CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  tone,
  loading,
  data,
  centerValue,
  centerLabel,
}: {
  title: string;
  tone: PanelTone;
  loading: boolean;
  data: Array<{ name: string; value: number; color: string; colorTo?: string }>;
  centerValue: string;
  centerLabel: string;
}) {
  const t = PANEL[tone];
  return (
    <AnalyticPanel tone={tone} icon={Activity} title={title}>
      {loading ? (
        <Skeleton className="mx-auto h-[200px] w-full" />
      ) : data.length === 0 ? (
        <EmptyState title="No data yet" description="Breakdowns appear as activity grows." />
      ) : (
        <>
          <Donut data={data} height={210} centerValue={centerValue} centerLabel={centerLabel} />
          <ul className="mt-3 space-y-2">
            {data.map((d) => (
              <li key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${d.color}, ${d.colorTo ?? d.color})`,
                    }}
                  />
                  {d.name}
                </span>
                <span className={cn("rounded-full border px-2 py-0.5 font-semibold", t.chip)}>
                  {d.value}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </AnalyticPanel>
  );
}

function MoneyTile({
  label,
  value,
  currency,
  loading,
  tone,
}: {
  label: string;
  value: number;
  currency: string;
  loading: boolean;
  tone: PanelTone;
}) {
  const t = PANEL[tone];
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border p-4 shadow-card", t.shell)}>
      <div aria-hidden className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", t.bar)} />
      <div aria-hidden className={cn("pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full blur-2xl", t.glow)} />
      <p className="relative text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="relative mt-2 text-xl font-bold tracking-tight">
        {loading ? "…" : formatMoney(moneyFromMinor(value, currency))}
      </p>
      <div className={cn("relative mt-3 h-1.5 w-full rounded-full bg-gradient-to-r opacity-80", t.bar)} />
    </div>
  );
}

function ActivityCard({
  title,
  href,
  tone,
  loading,
  empty,
  count,
  children,
}: {
  title: string;
  href: string;
  tone: PanelTone;
  loading: boolean;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  const t = PANEL[tone];
  return (
    <Card className={cn("relative overflow-hidden shadow-card", t.shell)}>
      <div aria-hidden className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", t.bar)} />
      <CardHeader className="relative flex flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <Link
          href={href}
          className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold hover:opacity-90", t.chip)}
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="relative">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : count === 0 ? (
          <EmptyState title={empty} />
        ) : (
          <ul>{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}
