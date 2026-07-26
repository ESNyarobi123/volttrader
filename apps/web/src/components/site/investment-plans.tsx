"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { InvestmentPlanView } from "@volt/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { InvestmentPlanCard } from "./investment-plan-card";

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
            Account Management
            <ArrowUpRight className="h-3.5 w-3.5 text-volt" aria-hidden />
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Choose your Management account plan
          </h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Four clear tiers — entry, cycle, and what you gain. Projected profits are targets, not
            guarantees. You can hold more than one plan at a time.
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
              {plans.map((plan) => (
                <InvestmentPlanCard
                  key={plan.id}
                  plan={plan}
                  cta={
                    <Link href={plan.ctaHref} className="block">
                      <Button
                        size="lg"
                        className={cn(
                          "h-11 w-full rounded-full text-sm font-semibold",
                          plan.featured
                            ? "bg-white text-ink shadow-lg hover:bg-white/90"
                            : "bg-ink text-white hover:bg-ink/90",
                        )}
                      >
                        {plan.ctaLabel}
                      </Button>
                    </Link>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
