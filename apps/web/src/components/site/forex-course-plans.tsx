"use client";

import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import type { CoursePlanView } from "@volt/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

export function ForexCoursePlans({
  plans,
  isLoading,
  className,
}: {
  plans: CoursePlanView[];
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border pb-14 pt-8 md:pb-16 md:pt-10", className)}>
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-volt px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-volt-foreground shadow-volt">
            Pricing
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Choose the perfect Forex course plan
          </h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Clear academy tiers — pick what fits you. Admin can update these plans anytime.
          </p>
        </div>

        <div className="mt-6 rounded-[2rem] bg-surface-2/80 p-4 sm:mt-8 sm:p-6 md:rounded-[2.5rem] md:p-8">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[28rem] rounded-[1.75rem]" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Course plans are coming soon.
            </p>
          ) : (
            <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
              {plans.map((plan) => {
                const { main, suffix } = priceParts(plan);
                const featured = plan.featured;

                return (
                  <article
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col rounded-[1.75rem] border p-5 transition-transform sm:p-6",
                      featured
                        ? "z-10 border-transparent bg-gradient-to-b from-volt via-volt-hover to-ink text-white shadow-[0_28px_50px_-28px_hsl(var(--volt)/0.65)] xl:-mb-2 xl:min-h-[34rem] xl:scale-[1.03]"
                        : "border-border/80 bg-surface text-foreground shadow-card",
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
                      <p
                        className={cn(
                          "mt-1 text-sm",
                          featured ? "text-white/75" : "text-muted-foreground",
                        )}
                      >
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

                    <Link href={plan.ctaHref} className="mt-6 block">
                      <Button
                        size="lg"
                        className={cn(
                          "h-11 w-full rounded-full text-sm font-semibold",
                          featured
                            ? "bg-ink text-white shadow-lg hover:bg-ink/90"
                            : "bg-surface-2 text-foreground hover:bg-volt hover:text-volt-foreground",
                        )}
                      >
                        {plan.ctaLabel}
                      </Button>
                    </Link>

                    <div className="mt-7 flex-1">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          featured ? "text-white" : "text-foreground",
                        )}
                      >
                        What you will get
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
