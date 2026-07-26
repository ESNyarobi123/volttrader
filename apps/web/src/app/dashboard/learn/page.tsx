"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpen, ChevronUp, Sparkles, Wallet } from "lucide-react";
import type { CoursePlanMembershipView, CoursePlanView } from "@volt/types";
import { api, apiErrorMessage } from "@/lib/api";
import { humanize } from "@/lib/status";
import { ForexCoursePlanCard } from "@/components/site/forex-course-plan-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function isInsufficientBalance(message: string) {
  return /insufficient wallet balance/i.test(message);
}

export default function DashboardLearnPage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [needsDeposit, setNeedsDeposit] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const membershipQuery = useQuery({
    queryKey: ["course-plans", "me"],
    queryFn: () => api.get<CoursePlanMembershipView>("/course-plans/me"),
  });

  const subscribe = useMutation({
    mutationFn: (coursePlanId: string) =>
      api.post("/course-plans/subscribe", {
        coursePlanId,
        source: "WALLET",
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      setActionError(null);
      setNeedsDeposit(false);
      setUpgradeOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["course-plans", "me"] });
      await queryClient.invalidateQueries({ queryKey: ["enrollments", "me"] });
    },
    onError: (err) => {
      const message = apiErrorMessage(err, "Could not activate plan");
      setActionError(message);
      setNeedsDeposit(isInsufficientBalance(message));
    },
  });

  const data = membershipQuery.data;
  const unlocked = useMemo(
    () => (data?.courses ?? []).filter((c) => !c.locked),
    [data?.courses],
  );
  const lockedCount = useMemo(
    () => (data?.courses ?? []).filter((c) => c.locked).length,
    [data?.courses],
  );
  const upgradePlans = useMemo(() => {
    if (!data?.plan) return data?.plans ?? [];
    return data.plans.filter((p) => p.sortOrder > data.plan!.sortOrder);
  }, [data]);

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Learn</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.plan
              ? "Your Forex courses for this plan."
              : "Choose a Forex plan to unlock academy courses."}
          </p>
        </div>

        {data?.plan ? (
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-volt/30 bg-volt/10 px-3 py-1.5 text-left transition hover:bg-volt/15"
          >
            <Badge variant="volt">{data.plan.name}</Badge>
            <span className="text-xs font-semibold text-volt-dim">
              {upgradePlans.length > 0 ? "Upgrade plan" : "Your plan"}
            </span>
            {upgradePlans.length > 0 ? (
              <ChevronUp className="h-3.5 w-3.5 text-volt-dim" aria-hidden />
            ) : null}
          </button>
        ) : null}
      </header>

      {membershipQuery.isError ? (
        <Alert variant="danger">
          {apiErrorMessage(membershipQuery.error, "Could not load Learn.")}
        </Alert>
      ) : null}

      {actionError ? (
        <Alert
          variant="danger"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{actionError}</span>
          {needsDeposit ? (
            <Link
              href="/dashboard/wallet"
              className={cn(buttonVariants({ size: "sm" }), "shrink-0 rounded-full shadow-volt")}
            >
              <Wallet className="h-4 w-4" />
              Deposit to wallet
            </Link>
          ) : null}
        </Alert>
      ) : null}

      {membershipQuery.isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : !data.plan ? (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">Forex plans</h2>
              <p className="text-xs text-muted-foreground">
                Same pricing cards as the landing page — activate one plan to unlock its courses.
              </p>
            </div>
            <div className="rounded-[2rem] bg-surface-2/80 p-3 sm:p-5 md:rounded-[2.5rem]">
              <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
                {data.plans.map((plan) => (
                  <SubscribePlanCard
                    key={plan.id}
                    plan={plan}
                    busy={subscribe.isPending}
                    onSelect={() => subscribe.mutate(plan.id)}
                  />
                ))}
              </div>
            </div>
          </section>
          <div className="rounded-2xl border border-volt/20 bg-volt/5 px-4 py-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-volt-dim" />
            <p className="mt-3 font-display text-lg font-bold tracking-tight">
              Start with Starter (free)
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              You only see courses included in the plan you activate. Paid plans unlock more.
            </p>
          </div>
        </>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold tracking-tight">Your courses</h2>
            {unlocked.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface-2/40 px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No courses published for your plan yet. Check back soon.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {unlocked.map((course) => (
                  <Link
                    key={course.id}
                    href={`/dashboard/learn/${course.slug}`}
                    className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition hover:border-volt/35 sm:p-4"
                  >
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-volt/12 text-volt-dim">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold group-hover:text-volt-dim">
                        {course.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {humanize(course.level)} · {course.lessonsCount} lessons
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {lockedCount > 0 && upgradePlans.length > 0 ? (
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-volt/25 bg-gradient-to-r from-volt/10 via-surface to-surface px-4 py-4 text-left shadow-card transition hover:border-volt/40"
            >
              <div>
                <p className="font-semibold tracking-tight">Want more courses?</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {lockedCount} more courses unlock when you upgrade your plan.
                </p>
              </div>
              <span
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "shrink-0 rounded-full shadow-volt pointer-events-none",
                )}
              >
                Upgrade
              </span>
            </button>
          ) : null}
        </>
      )}

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Upgrade Forex plan</DialogTitle>
            <DialogDescription>
              Higher plans unlock more academy courses. Paid plans debit your wallet.
            </DialogDescription>
          </DialogHeader>
          {upgradePlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">You already have the top plan.</p>
          ) : (
            <div className="grid max-h-[70vh] gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {upgradePlans.map((plan) => (
                <SubscribePlanCard
                  key={plan.id}
                  plan={plan}
                  busy={subscribe.isPending}
                  onSelect={() => subscribe.mutate(plan.id)}
                />
              ))}
            </div>
          )}
          {needsDeposit ? (
            <Alert
              variant="danger"
              className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>Not enough wallet balance for this plan.</span>
              <Link
                href="/dashboard/wallet"
                className={cn(buttonVariants({ size: "sm" }), "rounded-full shadow-volt")}
                onClick={() => setUpgradeOpen(false)}
              >
                <Wallet className="h-4 w-4" />
                Go deposit
              </Link>
            </Alert>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubscribePlanCard({
  plan,
  busy,
  onSelect,
}: {
  plan: CoursePlanView;
  busy: boolean;
  onSelect: () => void;
}) {
  const isFree = plan.price.amount === 0;

  return (
    <ForexCoursePlanCard
      plan={plan}
      cta={
        <Button
          size="lg"
          className={cn(
            "h-11 w-full rounded-full text-sm font-semibold",
            plan.featured
              ? "bg-ink text-white shadow-lg hover:bg-ink/90"
              : "bg-surface-2 text-foreground hover:bg-volt hover:text-volt-foreground",
          )}
          disabled={busy}
          onClick={onSelect}
        >
          {isFree ? "Start free" : "Subscribe with wallet"}
        </Button>
      }
    />
  );
}
