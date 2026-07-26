"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp } from "lucide-react";
import type { InvestmentView } from "@volt/types";
import { api, apiErrorMessage } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import { statusVariant, humanize } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectionDisclaimer } from "@/components/shared/compliance-note";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function InvestmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const query = useQuery({
    queryKey: ["investments", id],
    queryFn: () => api.get<InvestmentView>(`/investments/${id}`),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError || !query.data) {
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

  const investment = query.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
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
            {humanize(investment.opportunity.riskCategory)} risk ·{" "}
            {investment.opportunity.durationDays} days
          </p>
        </div>
        <Badge variant={statusVariant(investment.status)} className="self-start">
          {humanize(investment.status)}
        </Badge>
      </div>

      <Card className="relative overflow-hidden border-border shadow-card">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(349_74%_36%)] opacity-80"
        />
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Principal</p>
            <p className="mt-1 text-lg font-bold">{formatMoney(investment.principal)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-volt-dim">Projected value</p>
            <p className="mt-1 text-lg font-bold">{formatMoney(investment.projectedValue)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Opened</p>
            <p className="mt-1 text-sm font-semibold">{formatDate(investment.createdAt)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Matures</p>
            <p className="mt-1 text-sm font-semibold">{formatDate(investment.maturesAt)}</p>
          </div>
          {investment.settledValue ? (
            <div className="sm:col-span-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Settled value
              </p>
              <p className="mt-1 text-lg font-bold">{formatMoney(investment.settledValue)}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ProjectionDisclaimer />

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/dashboard/invest/explore/${investment.opportunity.slug}`}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          <TrendingUp className="h-4 w-4" />
          View opportunity
        </Link>
        <Link href="/dashboard/wallet" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Wallet
        </Link>
      </div>
    </div>
  );
}
