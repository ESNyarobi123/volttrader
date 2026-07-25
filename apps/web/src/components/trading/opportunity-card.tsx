import Link from "next/link";
import { ArrowRight, CalendarClock, TrendingUp } from "lucide-react";
import type { OpportunitySummary } from "@volt/types";
import { OpportunityTrend, RISK_THEME } from "@/components/trading/opportunity-trend";
import { formatMoney } from "@/lib/format";
import { PROJECTION_LABELS, humanize } from "@/lib/status";
import { cn } from "@/lib/utils";

export function OpportunityCard({
  opportunity,
  className,
  href,
}: {
  opportunity: OpportunitySummary;
  className?: string;
  /** Override detail link (dashboard explore vs public floor). */
  href?: string;
}) {
  const theme = RISK_THEME[opportunity.riskCategory];
  const projectionLabel =
    PROJECTION_LABELS[opportunity.projectionLabel] ?? "Projected outcome";

  return (
    <Link
      href={href ?? `/trading-floor/${opportunity.slug}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border/80 bg-surface/95 shadow-card transition-all duration-300",
        "hover:-translate-y-1.5 hover:border-[hsl(351_77%_61%/0.4)] hover:shadow-[0_24px_48px_-28px_hsl(349_74%_30%/0.4)]",
        className,
      )}
    >
      <OpportunityTrend
        risk={opportunity.riskCategory}
        multiplier={opportunity.projectionMultiplier}
        seed={opportunity.id || opportunity.slug}
      />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-bold leading-snug tracking-tight transition-colors group-hover:text-[hsl(213_70%_38%)]">
            <span className="line-clamp-2">{opportunity.name}</span>
          </h3>
        </div>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {opportunity.summary}
        </p>

        <div className="mt-4 rounded-xl border border-border/70 bg-gradient-to-br from-surface-2/80 to-surface p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">{projectionLabel}</p>
          <p
            className={cn(
              "mt-0.5 inline-flex items-center gap-1.5 font-display text-xl font-bold tracking-tight",
              theme.multiplier,
            )}
          >
            <TrendingUp className="h-4 w-4" aria-hidden />×{opportunity.projectionMultiplier}
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
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            {opportunity.durationDays} days
          </span>
          <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {humanize(opportunity.riskCategory)} risk
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3.5">
          <span className="text-[11px] text-muted-foreground">Risk disclosed</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors group-hover:text-[hsl(213_70%_38%)]">
            View
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}
