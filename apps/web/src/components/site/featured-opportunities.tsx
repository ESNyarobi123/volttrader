import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { RiskCategory } from "@volt/config";
import type { OpportunitySummary } from "@volt/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectionDisclaimer } from "@/components/shared/compliance-note";
import { formatMoney } from "@/lib/format";
import { PROJECTION_LABELS, humanize } from "@/lib/status";
import { cn } from "@/lib/utils";

const RISK_THEME: Record<
  RiskCategory,
  {
    wash: string;
    badge: string;
    bar: string;
    orb: string;
    multiplier: string;
    chart: string;
  }
> = {
  LOW: {
    wash: "from-[hsl(142_65%_29%/0.28)] via-surface to-[hsl(0_0%_10%/0.1)]",
    badge: "bg-[hsl(142_65%_29%/0.14)] text-[hsl(162_45%_30%)]",
    bar: "from-[hsl(142_65%_29%/0.75)] to-[hsl(142_65%_29%/0.12)]",
    orb: "bg-[hsl(142_65%_29%/0.35)]",
    multiplier: "text-[hsl(162_45%_32%)]",
    chart: "hsl(162 55% 40%)",
  },
  MEDIUM: {
    wash: "from-[hsl(0_0%_10%/0.3)] via-surface to-volt/12",
    badge: "bg-[hsl(351_77%_61%/0.14)] text-[hsl(213_70%_36%)]",
    bar: "from-[hsl(351_77%_61%/0.75)] to-[hsl(351_77%_61%/0.12)]",
    orb: "bg-[hsl(351_77%_61%/0.35)]",
    multiplier: "text-[hsl(213_70%_38%)]",
    chart: "hsl(213 82% 52%)",
  },
  HIGH: {
    wash: "from-volt/30 via-surface to-[hsl(349_74%_36%/0.12)]",
    badge: "bg-volt/18 text-volt-dim",
    bar: "from-volt/70 to-volt/15",
    orb: "bg-volt/35",
    multiplier: "text-volt-dim",
    chart: "hsl(46 95% 45%)",
  },
  VERY_HIGH: {
    wash: "from-[hsl(0_70%_55%/0.18)] via-surface to-[hsl(349_74%_36%/0.14)]",
    badge: "bg-[hsl(0_70%_55%/0.12)] text-[hsl(0_65%_38%)]",
    bar: "from-[hsl(0_70%_55%/0.65)] to-[hsl(349_74%_36%/0.2)]",
    orb: "bg-[hsl(0_70%_55%/0.3)]",
    multiplier: "text-[hsl(0_65%_40%)]",
    chart: "hsl(0 70% 50%)",
  },
};

function FloorArt({
  risk,
  multiplier,
  index,
}: {
  risk: RiskCategory;
  multiplier: number;
  index: number;
}) {
  const theme = RISK_THEME[risk];
  const gid = `floor-fill-${index}`;

  return (
    <div className={cn("relative aspect-[16/10] overflow-hidden bg-gradient-to-br", theme.wash)}>
      <svg viewBox="0 0 200 120" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.chart} stopOpacity="0.35" />
            <stop offset="100%" stopColor={theme.chart} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={
            index % 2 === 0
              ? "M0 88 C28 82, 40 48, 68 52 C96 56, 108 28, 136 34 C158 38, 176 52, 200 30 L200 120 L0 120 Z"
              : "M0 70 C32 95, 48 40, 76 50 C104 60, 118 22, 148 38 C168 48, 182 28, 200 42 L200 120 L0 120 Z"
          }
          fill={`url(#${gid})`}
        />
        <path
          d={
            index % 2 === 0
              ? "M0 88 C28 82, 40 48, 68 52 C96 56, 108 28, 136 34 C158 38, 176 52, 200 30"
              : "M0 70 C32 95, 48 40, 76 50 C104 60, 118 22, 148 38 C168 48, 182 28, 200 42"
          }
          fill="none"
          stroke={theme.chart}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      <span
        aria-hidden
        className={cn("absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl", theme.orb)}
      />

      <div className="absolute left-3 top-3">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm",
            theme.badge,
          )}
        >
          {humanize(risk)} risk
        </span>
      </div>

      <div className="absolute bottom-3 right-3 rounded-xl border border-background/60 bg-surface/85 px-3 py-2 shadow-sm backdrop-blur-md">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Target
        </p>
        <p className={cn("inline-flex items-center gap-1 font-display text-xl font-bold", theme.multiplier)}>
          <TrendingUp className="h-4 w-4" aria-hidden />×{multiplier}
        </p>
      </div>
    </div>
  );
}

function FeaturedOpportunityCard({
  opportunity,
  index,
  spotlight,
}: {
  opportunity: OpportunitySummary;
  index: number;
  spotlight?: boolean;
}) {
  const theme = RISK_THEME[opportunity.riskCategory];
  const projectionLabel =
    PROJECTION_LABELS[opportunity.projectionLabel] ?? "Projected outcome";

  return (
    <Link
      href={`/trading-floor/${opportunity.slug}`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border/80 bg-surface/95 shadow-card backdrop-blur-sm transition-all duration-300",
        "hover:-translate-y-1.5 hover:border-[hsl(351_77%_61%/0.4)] hover:shadow-[0_24px_48px_-28px_hsl(349_74%_30%/0.4)]",
        spotlight && "md:grid md:grid-cols-[1.15fr_1fr] md:items-stretch",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r opacity-80 transition-opacity group-hover:opacity-100",
          theme.bar,
        )}
      />

      <FloorArt
        risk={opportunity.riskCategory}
        multiplier={opportunity.projectionMultiplier}
        index={index}
      />

      <div
        className={cn(
          "flex flex-1 flex-col p-5",
          spotlight && "md:justify-center md:p-7",
        )}
      >
        {spotlight && (
          <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-md bg-[hsl(351_77%_61%/0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(213_70%_36%)]">
            <Sparkles className="h-3 w-3" />
            Featured on floor
          </span>
        )}

        <h3
          className={cn(
            "font-display font-bold tracking-tight transition-colors group-hover:text-[hsl(213_70%_38%)]",
            spotlight ? "text-2xl md:text-[1.65rem]" : "text-lg",
          )}
        >
          <span className="line-clamp-2">{opportunity.name}</span>
        </h3>
        <p
          className={cn(
            "mt-2 text-sm leading-relaxed text-muted-foreground",
            spotlight ? "line-clamp-3 md:line-clamp-4" : "line-clamp-2",
          )}
        >
          {opportunity.summary}
        </p>

        <div
          className={cn(
            "mt-4 rounded-xl border border-border/70 bg-gradient-to-br from-surface-2/80 to-surface p-3.5",
            spotlight && "md:mt-5",
          )}
        >
          <p className="text-[11px] font-medium text-muted-foreground">{projectionLabel}</p>
          <p
            className={cn(
              "mt-0.5 inline-flex items-center gap-1.5 font-display text-2xl font-bold tracking-tight",
              theme.multiplier,
            )}
          >
            <TrendingUp className="h-5 w-5" aria-hidden />×{opportunity.projectionMultiplier}
            <span className="text-sm font-semibold text-muted-foreground">target</span>
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            From{" "}
            <span className="font-semibold text-foreground">
              {formatMoney({
                amount: opportunity.minAmount,
                currency: opportunity.currency,
              })}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            {opportunity.durationDays} days
          </span>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Risk disclosed
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors group-hover:text-[hsl(213_70%_38%)]">
            View opportunity
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function FeaturedOpportunities({
  opportunities,
  isLoading,
  className,
}: {
  opportunities: OpportunitySummary[];
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden py-20 md:py-28", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_85%_15%,hsl(0_0%_10%/0.14),transparent_55%),radial-gradient(50%_40%_at_10%_80%,hsl(142_65%_29%/0.1),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />

      <div className="container-page relative">
        <header className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(213_70%_40%)]">
              Account Management
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.75rem]">
              Investment opportunities
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Curated packages with clear risk categories and projected profit targets — never
              guarantees.
            </p>
          </div>
          <Link href="/trading-floor" className="shrink-0">
            <Button
              variant="outline"
              className="rounded-full border-foreground/12 bg-surface/80 px-5 shadow-sm backdrop-blur-sm"
            >
              View all opportunities
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </Link>
        </header>

        <div className="mt-12 md:mt-14">
          {isLoading ? (
            <div className="space-y-5">
              <Skeleton className="h-72 w-full rounded-[1.35rem] md:h-64" />
              <div className="grid gap-5 md:grid-cols-2">
                <Skeleton className="h-80 w-full rounded-[1.35rem]" />
                <Skeleton className="h-80 w-full rounded-[1.35rem]" />
              </div>
            </div>
          ) : opportunities.length === 0 ? (
            <EmptyState
              title="Opportunities coming soon"
              description="The trading floor is being curated — check back shortly."
            />
          ) : opportunities.length === 1 ? (
            <FeaturedOpportunityCard
              opportunity={opportunities[0]}
              index={0}
              spotlight
            />
          ) : (
            <div className="space-y-5">
              <FeaturedOpportunityCard
                opportunity={opportunities[0]}
                index={0}
                spotlight
              />
              <div className="grid gap-5 md:grid-cols-2">
                {opportunities.slice(1).map((opportunity, index) => (
                  <FeaturedOpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    index={index + 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {!isLoading && opportunities.length > 0 ? (
          <ProjectionDisclaimer className="mx-auto mt-10 max-w-2xl text-center" />
        ) : null}
      </div>
    </section>
  );
}
