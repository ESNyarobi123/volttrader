"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { CoursePlanView } from "@volt/types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

function periodSuffix(period: CoursePlanView["billingPeriod"]) {
  if (period === "month") return "/month";
  if (period === "year") return "/year";
  return "";
}

function priceParts(plan: CoursePlanView) {
  if (plan.price.amount <= 0) {
    return { main: "Free", suffix: "" };
  }
  const formatted = formatMoney(plan.price);
  return { main: formatted, suffix: periodSuffix(plan.billingPeriod) };
}

export function ForexCoursePlanCard({
  plan,
  cta,
  className,
}: {
  plan: CoursePlanView;
  cta: ReactNode;
  className?: string;
}) {
  const { main, suffix } = priceParts(plan);
  const featured = plan.featured;

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-[1.75rem] border p-5 transition-transform sm:p-6",
        featured
          ? "z-10 border-transparent bg-gradient-to-b from-volt via-volt-hover to-ink text-white shadow-[0_28px_50px_-28px_hsl(var(--volt)/0.65)] xl:min-h-[34rem] xl:scale-[1.03]"
          : "border-border/80 bg-surface text-foreground shadow-card",
        className,
      )}
    >
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

      <div className="mt-6 flex flex-wrap items-baseline gap-1.5">
        <span
          className={cn(
            "font-display text-4xl font-bold tracking-tight",
            featured ? "text-white" : "text-foreground",
          )}
        >
          {main}
        </span>
        {suffix ? (
          <span
            className={cn(
              "text-sm font-medium",
              featured ? "text-white/65" : "text-muted-foreground",
            )}
          >
            {suffix}
          </span>
        ) : null}
      </div>

      <div className="mt-6">{cta}</div>

      <div className="mt-7 flex-1">
        <p className={cn("text-sm font-semibold", featured ? "text-white" : "text-foreground")}>
          What you will get
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
    </article>
  );
}
