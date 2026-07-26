"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  PlusCircle,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { InvestmentView, OpportunitySummary, PortfolioSummary } from "@volt/types";
import { api, apiErrorMessage } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { humanize, statusVariant } from "@/lib/status";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type FilterId = "all" | "ACTIVE" | "PENDING" | "SETTLED";

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function DashboardInvestPage() {
  const [filter, setFilter] = useState<FilterId>("all");

  const portfolioQuery = useQuery({
    queryKey: ["investments", "portfolio"],
    queryFn: () => api.get<PortfolioSummary>("/investments/portfolio"),
  });

  const investmentsQuery = useQuery({
    queryKey: ["investments", "me"],
    queryFn: () => api.get<InvestmentView[]>("/investments/me"),
  });

  const openOppsQuery = useQuery({
    queryKey: ["opportunities", "open"],
    queryFn: () => api.get<OpportunitySummary[]>("/opportunities"),
  });

  const investments = investmentsQuery.data ?? [];
  const portfolio = portfolioQuery.data;
  const openOpps = (openOppsQuery.data ?? []).slice(0, 4);

  const activeCount = investments.filter((i) => i.status === "ACTIVE").length;
  const pendingCount = investments.filter((i) => i.status === "PENDING").length;

  const focus = useMemo(() => {
    return (
      investments.find((i) => i.status === "ACTIVE") ??
      investments.find((i) => i.status === "PENDING") ??
      investments[0] ??
      null
    );
  }, [investments]);

  const filtered = useMemo(() => {
    if (filter === "all") return investments;
    if (filter === "SETTLED") {
      return investments.filter((i) => i.status === "SETTLED" || i.status === "MATURED");
    }
    return investments.filter((i) => i.status === filter);
  }, [investments, filter]);

  const loading = portfolioQuery.isLoading || investmentsQuery.isLoading;

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Invest</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your portfolio.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Link
            href="/dashboard/wallet"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "justify-center rounded-full",
            )}
          >
            <Wallet className="h-4 w-4" />
            Wallet
          </Link>
          <Link
            href="/trading-floor"
            className={cn(
              buttonVariants({ size: "sm" }),
              "justify-center rounded-full shadow-volt",
            )}
          >
            <PlusCircle className="h-4 w-4" />
            Explore
          </Link>
        </div>
      </header>

      {investmentsQuery.isError ? (
        <Alert variant="danger">
          {apiErrorMessage(investmentsQuery.error, "Could not load investments.")}
        </Alert>
      ) : null}

      {/* Stats — accent bars + icons */}
      <section className="grid grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))
        ) : (
          <>
            <Stat
              accent="volt"
              icon={TrendingUp}
              label="Active"
              value={String(portfolio?.activeInvestments ?? activeCount)}
            />
            <Stat
              accent="ink"
              icon={CalendarDays}
              label="Allocated"
              value={portfolio ? formatMoney(portfolio.totalInvested) : "—"}
            />
            <Stat
              accent="soft"
              icon={Wallet}
              label="Wallet"
              value={portfolio ? formatMoney(portfolio.walletBalance) : "—"}
            />
          </>
        )}
      </section>

      {/* Focus — Learn-style continue band */}
      {loading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : focus ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-volt/25 bg-gradient-to-br from-volt/12 via-surface to-surface p-4 shadow-card sm:flex-row sm:items-center sm:gap-5 sm:p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-ink/90 text-white shadow-sm">
            <TrendingUp className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-volt-dim">
                Focus
              </p>
              <Badge variant={statusVariant(focus.status)}>{humanize(focus.status)}</Badge>
            </div>
            <h2 className="mt-1 truncate font-display text-lg font-bold tracking-tight">
              {focus.opportunity.name}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <MetricChip label="Principal" value={formatMoney(focus.principal)} />
              <MetricChip label="Target" value={formatMoney(focus.projectedValue)} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {focus.maturesAt ? `Matures ${formatDate(focus.maturesAt)}` : "Schedule pending"} ·
              Targets are not guarantees
            </p>
          </div>
          <Link
            href={`/dashboard/invest/${focus.id}`}
            className={cn(
              buttonVariants({ size: "md" }),
              "w-full shrink-0 rounded-full shadow-volt sm:w-auto",
            )}
          >
            View
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : null}

      {/* My investments — horizontal rows like Learn */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold tracking-tight">My investments</h2>
          {investments.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "All"],
                  ["ACTIVE", "Active"],
                  ["PENDING", "Pending"],
                  ["SETTLED", "Done"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    filter === id
                      ? "bg-volt text-volt-foreground"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {label}
                  {id === "PENDING" && pendingCount > 0 ? ` · ${pendingCount}` : ""}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {investmentsQuery.isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : investments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center shadow-card">
            <TrendingUp className="mx-auto h-8 w-8 text-volt-dim" />
            <p className="mt-3 font-semibold">No investments yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Start with Account Management.</p>
            <Link
              href="/trading-floor"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-4 rounded-full",
              )}
            >
              Explore
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Nothing here.</p>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="mt-2 text-sm font-semibold text-volt-dim hover:underline"
            >
              Show all
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((inv) => (
              <InvestmentRow key={inv.id} investment={inv} />
            ))}
          </div>
        )}
      </section>

      {/* Open now — compact strip after portfolio */}
      {!openOppsQuery.isLoading && openOpps.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight">Open now</h2>
            <Link
              href="/trading-floor"
              className="inline-flex items-center gap-1 text-xs font-semibold text-volt-dim hover:text-foreground"
            >
              All
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {openOpps.map((opp) => (
              <Link
                key={opp.id}
                href={`/trading-floor/${opp.slug}`}
                className="group flex w-[220px] shrink-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition hover:border-volt/35 hover:shadow-lift"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-volt/12 text-volt-dim">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold group-hover:text-volt-dim">
                    {opp.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {humanize(opp.riskCategory)} · {opp.durationDays}d
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  accent,
  icon: Icon,
  label,
  value,
}: {
  accent: "volt" | "ink" | "soft";
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  const bar =
    accent === "volt" ? "bg-volt" : accent === "ink" ? "bg-ink" : "bg-[hsl(351_77%_61%)]";

  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-surface p-3 shadow-card sm:p-4">
      <span className={cn("absolute inset-y-0 left-0 w-1", bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">
            {value}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-volt/12 text-volt-dim">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-surface/80 px-3 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function InvestmentRow({ investment }: { investment: InvestmentView }) {
  const days = daysUntil(investment.maturesAt);

  return (
    <Link
      href={`/dashboard/invest/${investment.id}`}
      className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition hover:border-volt/35 hover:shadow-lift sm:gap-4 sm:p-4"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink/90 text-white sm:h-16 sm:w-16 sm:rounded-2xl">
        <TrendingUp className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={statusVariant(investment.status)} className="text-[10px]">
            {humanize(investment.status)}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {humanize(investment.opportunity.riskCategory)} · {investment.opportunity.durationDays}
            d
          </span>
        </div>
        <p className="mt-1 truncate font-semibold group-hover:text-volt-dim">
          {investment.opportunity.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatMoney(investment.principal)}
          <span className="mx-1.5 text-border">→</span>
          <span className="font-medium text-foreground">
            {formatMoney(investment.projectedValue)}
          </span>
          <span className="ml-1 text-[10px]">target</span>
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-lg bg-surface-2 px-2 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {investment.maturesAt
            ? days !== null && days >= 0
              ? `${days}d`
              : formatDate(investment.maturesAt)
            : "—"}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-volt-dim">
          Open
          <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
