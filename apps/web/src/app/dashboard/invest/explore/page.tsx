"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LineChart, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import type { OpportunitySummary } from "@volt/types";
import { OpportunityCard } from "@/components/trading/opportunity-card";
import { ProjectionDisclaimer } from "@/components/shared/compliance-note";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function DashboardExploreFloorPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["opportunities"],
    queryFn: () => api.get<OpportunitySummary[]>("/opportunities"),
  });

  const stats = useMemo(() => {
    const items = data ?? [];
    const risks = new Set(items.map((o) => o.riskCategory)).size;
    const avgDays =
      items.length === 0
        ? 0
        : Math.round(items.reduce((s, o) => s + o.durationDays, 0) / items.length);
    return { open: items.length, risks, avgDays };
  }, [data]);

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-56 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.22),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(349_74%_36%/0.14),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            <Sparkles className="h-3.5 w-3.5" />
            Trading Floor
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Explore opportunities</h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Open packages from admin — review risk, terms and projected targets before you invest.
          </p>
        </div>
        <Link
          href="/dashboard/invest"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
        >
          <ArrowLeft className="h-4 w-4" />
          My portfolio
        </Link>
      </div>

      <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Open now", value: isLoading ? "—" : String(stats.open), icon: TrendingUp },
          { label: "Risk bands", value: isLoading ? "—" : String(stats.risks), icon: ShieldCheck },
          {
            label: "Avg. duration",
            value: isLoading ? "—" : `${stats.avgDays}d`,
            icon: LineChart,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-surface-2 px-3 py-3 shadow-card"
          >
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <item.icon className="h-3 w-3" />
              {item.label}
            </p>
            <p className="mt-1 font-display text-xl font-bold tracking-tight">{item.value}</p>
          </div>
        ))}
      </div>

      {error ? (
        <Alert variant="danger">
          {apiErrorMessage(error, "Failed to load opportunities.")}
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[26rem] w-full rounded-[1.35rem]" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                href={`/dashboard/invest/explore/${opportunity.slug}`}
              />
            ))}
          </div>
          <ProjectionDisclaimer className="text-xs" />
        </>
      ) : (
        <EmptyState
          icon={LineChart}
          title="No opportunities open right now"
          description="Check back soon — new opportunities are published by admin."
        />
      )}
    </div>
  );
}
