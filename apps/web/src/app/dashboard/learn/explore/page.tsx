"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, GraduationCap, Wallet } from "lucide-react";
import type { CourseLevel } from "@volt/config";
import type { CourseSummary, WalletView } from "@volt/types";
import { api, ApiRequestError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { humanize } from "@/lib/status";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LevelFilter = CourseLevel | "ALL";

const LEVELS: { id: LevelFilter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "BEGINNER", label: "Beginner" },
  { id: "INTERMEDIATE", label: "Intermediate" },
  { id: "ADVANCED", label: "Advanced" },
  { id: "PREMIUM", label: "Premium" },
];

export default function DashboardLearnExplorePage() {
  const [level, setLevel] = useState<LevelFilter>("ALL");

  const coursesQuery = useQuery({
    queryKey: ["courses", level],
    queryFn: () =>
      api.get<CourseSummary[]>(level === "ALL" ? "/courses" : `/courses?level=${level}`),
  });

  const walletQuery = useQuery({
    queryKey: ["wallet"],
    queryFn: () => api.get<WalletView>("/wallet"),
  });

  const courses = coursesQuery.data ?? [];
  const wallet = walletQuery.data;
  const freeCount = useMemo(
    () => courses.filter((c) => c.accessType === "FREE").length,
    [courses],
  );

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Academy
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Browse Forex courses.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Link
            href="/dashboard/learn"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "justify-center rounded-full",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            My courses
          </Link>
          <Link
            href="/dashboard/wallet"
            className={cn(buttonVariants({ size: "sm" }), "justify-center rounded-full shadow-volt")}
          >
            <Wallet className="h-4 w-4" />
            Deposit
          </Link>
        </div>
      </header>

      {coursesQuery.isError ? (
        <Alert variant="danger">
          {coursesQuery.error instanceof ApiRequestError
            ? coursesQuery.error.message
            : "Could not load courses."}
        </Alert>
      ) : null}

      <section className="grid grid-cols-3 gap-3">
        {coursesQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))
        ) : (
          <>
            <Stat accent="volt" icon={BookOpen} label="Courses" value={String(courses.length)} />
            <Stat accent="ink" icon={GraduationCap} label="Free" value={String(freeCount)} />
            <Stat
              accent="soft"
              icon={Wallet}
              label="Wallet"
              value={wallet ? formatMoney(wallet.balance) : "—"}
            />
          </>
        )}
      </section>

      {wallet && wallet.balance.amount <= 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-volt/25 bg-gradient-to-br from-volt/12 via-surface to-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Deposit to your wallet before buying paid courses.
          </p>
          <Link
            href="/dashboard/wallet"
            className={cn(buttonVariants({ size: "sm" }), "rounded-full shadow-volt")}
          >
            Deposit now
          </Link>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {LEVELS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLevel(item.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                level === item.id
                  ? "bg-volt text-volt-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {coursesQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">No courses in this filter.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {courses.map((course) => (
              <CourseRow key={course.id} course={course} wallet={wallet} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CourseRow({
  course,
  wallet,
}: {
  course: CourseSummary;
  wallet?: WalletView;
}) {
  const free = course.accessType === "FREE";
  const canAfford =
    free || (wallet ? wallet.balance.amount >= course.price.amount : false);

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition hover:border-volt/35 hover:shadow-lift sm:gap-4 sm:p-4"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink/90 text-white sm:h-16 sm:w-16 sm:rounded-2xl">
        <BookOpen className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="volt" className="text-[10px]">
            {humanize(course.level)}
          </Badge>
          {free ? (
            <Badge variant="success" className="text-[10px]">
              Free
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 truncate font-semibold group-hover:text-volt-dim">{course.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {course.lessonsCount} lessons · {course.durationMinutes} min
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-lg bg-surface-2 px-2 py-1 text-[11px] font-semibold tabular-nums">
          {free ? "Free" : formatMoney(course.price)}
        </span>
        <span className="text-[11px] font-semibold text-volt-dim">
          {free ? "Enroll" : canAfford ? "Buy" : "Deposit first"}
        </span>
      </div>
    </Link>
  );
}

function Stat({
  accent,
  icon: Icon,
  label,
  value,
}: {
  accent: "volt" | "ink" | "soft";
  icon: typeof BookOpen;
  label: string;
  value: string;
}) {
  const bar =
    accent === "volt" ? "bg-volt" : accent === "ink" ? "bg-ink" : "bg-[hsl(351_77%_61%)]";

  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-surface p-3 shadow-card sm:p-4">
      <span className={cn("absolute inset-y-0 left-0 w-1", bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">
            {value}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-volt/12 text-volt-dim">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
