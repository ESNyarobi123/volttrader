"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { CoursePlanView } from "@volt/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ForexCoursePlanCard } from "./forex-course-plan-card";

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
            From free foundations to full mastery — choose the plan that matches your learning pace.
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
              {plans.map((plan) => (
                <ForexCoursePlanCard
                  key={plan.id}
                  plan={plan}
                  cta={
                    <Link href={plan.ctaHref} className="block">
                      <Button
                        size="lg"
                        className={cn(
                          "h-11 w-full rounded-full text-sm font-semibold",
                          plan.featured
                            ? "bg-ink text-white shadow-lg hover:bg-ink/90"
                            : "bg-surface-2 text-foreground hover:bg-volt hover:text-volt-foreground",
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
