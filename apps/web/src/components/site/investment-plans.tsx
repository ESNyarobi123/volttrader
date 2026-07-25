"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Clock, Shield } from "lucide-react";
import type { InvestmentPlanView } from "@volt/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const PROJECTION_COPY: Record<InvestmentPlanView["projectionLabel"], string> = {
  PROJECTED_OUTCOME: "Projected Outcome",
  TARGET_PERFORMANCE: "Target Performance",
  HISTORICAL_PERFORMANCE: "Historical Performance",
};

const RISK_COPY: Record<InvestmentPlanView["riskCategory"], string> = {
  LOW: "Lower risk",
  MEDIUM: "Medium risk",
  HIGH: "Higher risk",
  VERY_HIGH: "Very high risk",
};

export function InvestmentPlans({
  plans,
  isLoading,
  className,
}: {
  plans: InvestmentPlanView[];
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border pb-14 pt-4 md:pb-16 md:pt-6", className)}>
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white shadow-lift">
            Trading Floor
            <ArrowUpRight className="h-3.5 w-3.5 text-volt" aria-hidden />
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Choose your investment path
          </h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Four clear tiers — entry, duration, and what you gain. Targets are projections, not
            guarantees.
          </p>
        </div>

        <div className="mt-6 rounded-[2rem] bg-gradient-to-b from-surface-2/90 via-surface to-surface p-4 sm:mt-8 sm:p-6 md:rounded-[2.5rem] md:p-8">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[32rem] rounded-[1.75rem]" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Investment plans are coming soon.
            </p>
          ) : (
            <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
              {plans.map((plan) => {
                const featured = plan.featured;
                return (
                  <article
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col overflow-hidden rounded-[1.75rem] border p-5 transition-transform sm:p-6",
                      featured
                        ? "z-10 border-transparent bg-gradient-to-b from-volt via-volt-hover to-ink text-white shadow-[0_28px_50px_-28px_hsl(var(--volt)/0.7)] xl:-mb-2 xl:min-h-[36rem] xl:scale-[1.03]"
                        : "border-border/80 bg-surface text-foreground shadow-card",
                    )}
                  >
                    {featured ? (
                      <span className="absolute right-4 top-4 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Featured
                      </span>
                    ) : null}

                    <div>
                      <h3
                        className={cn(
                          "font-display text-xl font-bold tracking-tight",
                          featured ? "text-white" : "text-foreground",
                        )}
                      >
                        {plan.name}
                      </h3>
                      <p
                        className={cn(
                          "mt-1 text-sm",
                          featured ? "text-white/75" : "text-muted-foreground",
                        )}
                      >
                        {plan.subtitle}
                      </p>
                    </div>

                    <div className="mt-5">
                      <p
                        className={cn(
                          "text-[11px] font-semibold uppercase tracking-[0.12em]",
                          featured ? "text-white/55" : "text-muted-foreground",
                        )}
                      >
                        From
                      </p>
                      <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                        <span
                          className={cn(
                            "font-display text-3xl font-bold tracking-tight sm:text-4xl",
                            featured ? "text-white" : "text-foreground",
                          )}
                        >
                          {formatMoney(plan.minAmount)}
                        </span>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "mt-4 rounded-2xl px-3 py-2.5",
                        featured ? "bg-white/10" : "bg-volt/8 border border-volt/15",
                      )}
                    >
                      <p
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-[0.12em]",
                          featured ? "text-white/60" : "text-volt-dim",
                        )}
                      >
                        {PROJECTION_COPY[plan.projectionLabel]}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 font-display text-lg font-bold",
                          featured ? "text-white" : "text-foreground",
                        )}
                      >
                        {plan.projectionHighlight}
                      </p>
                    </div>

                    <div
                      className={cn(
                        "mt-3 flex flex-wrap gap-2 text-[11px] font-medium",
                        featured ? "text-white/70" : "text-muted-foreground",
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {plan.durationDays} days
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5" aria-hidden />
                        {RISK_COPY[plan.riskCategory]}
                      </span>
                    </div>

                    <Link href={plan.ctaHref} className="mt-5 block">
                      <Button
                        size="lg"
                        className={cn(
                          "h-11 w-full rounded-full text-sm font-semibold",
                          featured
                            ? "bg-white text-ink shadow-lg hover:bg-white/90"
                            : "bg-ink text-white hover:bg-ink/90",
                        )}
                      >
                        {plan.ctaLabel}
                      </Button>
                    </Link>

                    <div className="mt-6 flex-1">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          featured ? "text-white" : "text-foreground",
                        )}
                      >
                        What you will gain
                      </p>
                      <ul className="mt-3 space-y-2.5">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2.5 text-sm">
                            <span
                              className={cn(
                                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                                featured
                                  ? "bg-white/15 text-white"
                                  : "bg-volt/10 text-volt-dim",
                              )}
                            >
                              <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                            </span>
                            <span className={featured ? "text-white/85" : "text-muted-foreground"}>
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <p
                      className={cn(
                        "mt-5 text-[10px] leading-relaxed",
                        featured ? "text-white/45" : "text-muted-foreground/80",
                      )}
                    >
                      Not a guarantee. Projections are targets — capital is at risk.
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
