"use client";

import type { ReactNode } from "react";
import { Check, Clock, Shield } from "lucide-react";
import type { InvestmentPlanView } from "@volt/types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Member-facing label — still a projection, never a guarantee. */
const PROJECTION_COPY: Record<InvestmentPlanView["projectionLabel"], string> = {
  PROJECTED_OUTCOME: "Your projected profit",
  TARGET_PERFORMANCE: "Your projected profit",
  HISTORICAL_PERFORMANCE: "Your projected profit",
};

const RISK_COPY: Record<InvestmentPlanView["riskCategory"], string> = {
  LOW: "Lower risk",
  MEDIUM: "Medium risk",
  HIGH: "Higher risk",
  VERY_HIGH: "Very high risk",
};

export function InvestmentPlanCard({
  plan,
  cta,
  className,
}: {
  plan: InvestmentPlanView;
  cta: ReactNode;
  className?: string;
}) {
  const featured = plan.featured;

  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[1.75rem] border p-5 transition-transform sm:p-6",
        featured
          ? "z-10 border-transparent bg-gradient-to-b from-volt via-volt-hover to-ink text-white shadow-[0_28px_50px_-28px_hsl(var(--volt)/0.7)] xl:min-h-[36rem] xl:scale-[1.03]"
          : "border-border/80 bg-surface text-foreground shadow-card",
        className,
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
        <p className={cn("mt-1 text-sm", featured ? "text-white/75" : "text-muted-foreground")}>
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
          {formatMoney(plan.projectedTotal)}
        </p>
        <p
          className={cn(
            "mt-0.5 text-[10px]",
            featured ? "text-white/55" : "text-muted-foreground",
          )}
        >
          Target on {formatMoney(plan.minAmount)} entry · not a guarantee
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
          {plan.durationDays % 7 === 0
            ? `${plan.durationDays / 7} week${plan.durationDays === 7 ? "" : "s"}`
            : `${plan.durationDays} days`}
        </span>
        <span className="inline-flex items-center gap-1">
          <Shield className="h-3.5 w-3.5" aria-hidden />
          {RISK_COPY[plan.riskCategory]}
        </span>
      </div>

      <div className="mt-5">{cta}</div>

      <div className="mt-6 flex-1">
        <p className={cn("text-sm font-semibold", featured ? "text-white" : "text-foreground")}>
          What you will gain
        </p>
        <ul className="mt-3 space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <span
                className={cn(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                  featured ? "bg-white/15 text-white" : "bg-volt/10 text-volt-dim",
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              </span>
              <span className={featured ? "text-white/85" : "text-muted-foreground"}>{feature}</span>
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
}
