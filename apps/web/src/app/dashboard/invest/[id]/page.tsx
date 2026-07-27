"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  MessageSquareText,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { InvestmentView, Money } from "@volt/types";
import { api, apiErrorMessage } from "@/lib/api";
import { formatMoney, formatDate, formatDateTime } from "@/lib/format";
import { statusVariant, humanize, PROJECTION_LABELS } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { ProjectionDisclaimer } from "@/components/shared/compliance-note";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function daysBetween(fromIso: string, toIso: string | null): number | null {
  if (!toIso) return null;
  return Math.ceil((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

function daysLeft(maturesAt: string | null): number | null {
  if (!maturesAt) return null;
  return Math.ceil((new Date(maturesAt).getTime() - Date.now()) / 86_400_000);
}

/** Clean broker-style outlook — cycle time + principal/target, no fake P&L chart. */
function PositionOutlook({
  principal,
  projected,
  projectionLabel,
  progress,
  daysRemaining,
  openedLabel,
  maturesLabel,
}: {
  principal: Money;
  projected: Money;
  projectionLabel: string;
  progress: number;
  daysRemaining: number | null;
  openedLabel: string;
  maturesLabel: string;
}) {
  const pct = Math.max(0, Math.min(100, progress));

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-card">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_80%_at_0%_0%,hsl(var(--volt)/0.14),transparent_55%),radial-gradient(70%_60%_at_100%_100%,hsl(220_18%_10%/0.06),transparent_50%)]"
      />

      <div className="relative space-y-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
              Position outlook
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Your capital in this cycle, with the plan’s {projectionLabel.toLowerCase()}.
            </p>
          </div>
          <div className="rounded-2xl bg-surface-2/80 px-3.5 py-2 text-right ring-1 ring-border/70">
            <p className="font-display text-2xl font-bold tracking-tight tabular-nums">
              {pct}%
            </p>
            <p className="text-[11px] font-medium text-muted-foreground">of cycle</p>
          </div>
        </div>

        {/* Principal → target */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-4 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Principal
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {formatMoney(principal)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Allocated · {openedLabel}</p>
          </div>

          <div className="hidden sm:flex flex-col items-center gap-1 px-1">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-volt/12 text-volt-dim ring-1 ring-volt/20">
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>

          <div className="rounded-2xl border border-volt/25 bg-gradient-to-br from-volt/10 via-background/80 to-background/80 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-volt-dim">
              {projectionLabel}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-volt-dim sm:text-3xl">
              {formatMoney(projected)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">At maturity · {maturesLabel}</p>
          </div>
        </div>

        {/* Cycle track */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Start
            </span>
            {daysRemaining !== null ? (
              daysRemaining >= 0 ? (
                <span className="inline-flex items-center gap-1.5 text-volt-dim">
                  <Clock3 className="h-3.5 w-3.5" />
                  {daysRemaining}d remaining
                </span>
              ) : (
                <span>Past maturity</span>
              )
            ) : null}
            <span>Maturity</span>
          </div>

          <div className="relative h-3 rounded-full bg-surface-2 ring-1 ring-border/60">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-volt/80 to-[hsl(349_74%_40%)] transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
            <span
              className="absolute top-1/2 z-10 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-md ring-2 ring-volt"
              style={{ left: `${pct}%` }}
              title="Today in cycle"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-volt" />
            </span>
          </div>

          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{formatMoney(principal)}</span>
            <span className="font-medium text-volt-dim">{formatMoney(projected)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvestmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const query = useQuery({
    queryKey: ["investments", id],
    queryFn: () => api.get<InvestmentView>(`/investments/${id}`),
    enabled: Boolean(id),
  });

  const investment = query.data;
  const left = daysLeft(investment?.maturesAt ?? null);
  const totalDays = investment
    ? daysBetween(investment.createdAt, investment.maturesAt) ??
      investment.opportunity.durationDays
    : 0;

  const timeline = useMemo(() => {
    if (!investment) return [];
    const steps = [
      {
        id: "opened",
        label: "Opened",
        done: true,
        detail: formatDate(investment.createdAt),
      },
      {
        id: "active",
        label: "In cycle",
        done: investment.status === "ACTIVE" || investment.status === "MATURED" || investment.status === "SETTLED",
        detail:
          investment.status === "PENDING"
            ? "Waiting for payment confirmation"
            : "Management cycle running",
      },
      {
        id: "mature",
        label: investment.awaitingSettlement ? "Awaiting settlement" : "Maturity",
        done:
          investment.awaitingSettlement ||
          investment.status === "MATURED" ||
          investment.status === "SETTLED",
        detail: investment.maturesAt ? formatDate(investment.maturesAt) : "—",
      },
      {
        id: "settled",
        label: "Settled",
        done: investment.status === "SETTLED",
        detail: investment.settledAt
          ? formatDate(investment.settledAt)
          : investment.settledValue
            ? formatMoney(investment.settledValue)
            : "After finance settlement",
      },
    ];
    return steps;
  }, [investment]);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError || !investment) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/invest" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Alert variant="danger">
          {apiErrorMessage(query.error, "Investment not found.")}
        </Alert>
      </div>
    );
  }

  const projectionLabel =
    PROJECTION_LABELS[investment.opportunity.projectionLabel] ?? "Projected outcome";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/dashboard/invest"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-2")}
          >
            <ArrowLeft className="h-4 w-4" /> Portfolio
          </Link>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            Position
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {investment.opportunity.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {humanize(investment.opportunity.riskCategory)} risk · {totalDays}-day cycle ·{" "}
            <span className="font-mono text-xs">{investment.reference}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <Badge variant={statusVariant(investment.status)}>{humanize(investment.status)}</Badge>
          {investment.awaitingSettlement ? (
            <Badge variant="info">Awaiting settlement</Badge>
          ) : null}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <PositionOutlook
          principal={investment.principal}
          projected={investment.projectedValue}
          projectionLabel={projectionLabel}
          progress={investment.cycleProgressPercent}
          daysRemaining={left}
          openedLabel={formatDate(investment.createdAt)}
          maturesLabel={formatDate(investment.maturesAt)}
        />

        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(349_74%_36%)] opacity-80"
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Opened</p>
                <p className="mt-1 text-sm font-semibold">{formatDate(investment.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Matures</p>
                <p className="mt-1 text-sm font-semibold">{formatDate(investment.maturesAt)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reference</p>
                <p className="mt-1 font-mono text-xs font-semibold">{investment.reference}</p>
              </div>
              {investment.settledValue ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Settled value
                  </p>
                  <p className="mt-1 text-xl font-bold">{formatMoney(investment.settledValue)}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
              Status timeline
            </p>
            <ol className="space-y-3">
              {timeline.map((step, i) => (
                <li key={step.id} className="flex gap-3">
                  <span className="flex flex-col items-center">
                    <span
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-full",
                        step.done ? "bg-volt/15 text-volt-dim" : "bg-surface-2 text-muted-foreground",
                      )}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Circle className="h-3.5 w-3.5" />
                      )}
                    </span>
                    {i < timeline.length - 1 ? (
                      <span className="my-1 w-px flex-1 bg-border" aria-hidden />
                    ) : null}
                  </span>
                  <div className="min-w-0 pb-2">
                    <p className="text-sm font-semibold">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface shadow-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <MessageSquareText className="h-4 w-4 text-volt-dim" />
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Cycle updates</h2>
            <p className="text-xs text-muted-foreground">
              Notes from finance — operational commentary, not market prices
            </p>
          </div>
        </div>
        {investment.updates.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Target className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-semibold">No updates yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When the team posts a cycle note, it will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {investment.updates.map((u) => (
              <li key={u.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{u.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDateTime(u.createdAt)} · {u.authorName}
                  </p>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{u.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProjectionDisclaimer />

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/dashboard/invest/explore/${investment.opportunity.slug}`}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-full")}
        >
          <TrendingUp className="h-4 w-4" />
          View opportunity
        </Link>
        <Link
          href="/dashboard/wallet"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full")}
        >
          <Wallet className="h-4 w-4" />
          Wallet
        </Link>
      </div>
    </div>
  );
}
