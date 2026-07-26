"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  PlayCircle,
  PlusCircle,
} from "lucide-react";
import type { EnrollmentView } from "@volt/types";
import { api, apiErrorMessage } from "@/lib/api";
import { humanize, statusVariant } from "@/lib/status";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { resolveStorageUrl } from "@/lib/format";

type FilterId = "all" | "active" | "completed";

function isCompleted(e: EnrollmentView) {
  return e.status === "COMPLETED" || e.progressPercent >= 100;
}

export default function DashboardLearnPage() {
  const [filter, setFilter] = useState<FilterId>("all");

  const enrollmentsQuery = useQuery({
    queryKey: ["enrollments", "me"],
    queryFn: () => api.get<EnrollmentView[]>("/enrollments/me"),
  });

  const enrollments = enrollmentsQuery.data ?? [];
  const completed = enrollments.filter(isCompleted).length;
  const active = enrollments.filter((e) => !isCompleted(e)).length;

  const continueCourse = useMemo(() => {
    return (
      [...enrollments]
        .filter((e) => !isCompleted(e))
        .sort((a, b) => b.progressPercent - a.progressPercent)[0] ?? null
    );
  }, [enrollments]);

  const filtered = useMemo(() => {
    if (filter === "active") return enrollments.filter((e) => !isCompleted(e));
    if (filter === "completed") return enrollments.filter(isCompleted);
    return enrollments;
  }, [enrollments, filter]);

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Learn</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your Forex courses.</p>
        </div>
        <Link
          href="/dashboard/learn/explore"
          className={cn(
            buttonVariants({ size: "sm" }),
            "justify-center rounded-full shadow-volt sm:shrink-0",
          )}
        >
          <PlusCircle className="h-4 w-4" />
          Browse academy
        </Link>
      </header>

      {enrollmentsQuery.isError ? (
        <Alert variant="danger">
          {apiErrorMessage(enrollmentsQuery.error, "Could not load courses.")}
        </Alert>
      ) : null}

      {/* Compact stats */}
      <section className="grid grid-cols-3 gap-3">
        {enrollmentsQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))
        ) : (
          <>
            <Stat label="Enrolled" value={String(enrollments.length)} />
            <Stat label="Active" value={String(active)} />
            <Stat label="Done" value={String(completed)} />
          </>
        )}
      </section>

      {/* Continue — one clear CTA */}
      {enrollmentsQuery.isLoading ? (
        <Skeleton className="h-36 w-full rounded-2xl" />
      ) : continueCourse ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-volt/25 bg-gradient-to-br from-volt/12 via-surface to-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <ProgressRing value={continueCourse.progressPercent} size={68} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-volt-dim">
                Continue
              </p>
              <h2 className="mt-0.5 truncate font-display text-lg font-bold tracking-tight">
                {continueCourse.course.title}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {humanize(continueCourse.course.level)} ·{" "}
                {continueCourse.course.lessonsCount} lessons
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/learn/${continueCourse.course.slug}`}
            className={cn(
              buttonVariants({ size: "md" }),
              "w-full shrink-0 rounded-full shadow-volt sm:w-auto",
            )}
          >
            <PlayCircle className="h-4 w-4" />
            Resume
          </Link>
        </section>
      ) : null}

      {/* Course list */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold tracking-tight">My courses</h2>
          {enrollments.length > 0 ? (
            <div className="flex gap-1">
              {(
                [
                  ["all", "All"],
                  ["active", "Active"],
                  ["completed", "Done"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    filter === id
                      ? "bg-volt text-volt-foreground"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {enrollmentsQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center shadow-card">
            <GraduationCap className="mx-auto h-8 w-8 text-volt-dim" />
            <p className="mt-3 font-semibold">No courses yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Start with a Forex plan.</p>
            <Link
              href="/dashboard/learn/explore"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-4 rounded-full",
              )}
            >
              Browse academy
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Nothing here.</p>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="mt-2 text-sm font-semibold text-volt-dim hover:underline"
            >
              Show all
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((e) => (
              <CourseRow key={e.id} enrollment={e} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-3 shadow-card sm:p-4">
      <p className="truncate font-display text-xl font-bold tracking-tight sm:text-2xl">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function CourseRow({ enrollment }: { enrollment: EnrollmentView }) {
  const done = isCompleted(enrollment);
  const thumb = resolveStorageUrl(enrollment.course.thumbnailUrl);

  return (
    <Link
      href={`/dashboard/learn/${enrollment.course.slug}`}
      className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition hover:border-volt/35 hover:shadow-lift sm:p-4"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-volt/10 sm:h-16 sm:w-16">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-volt-dim">
            <BookOpen className="h-5 w-5" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={statusVariant(enrollment.status)} className="text-[10px]">
            {humanize(enrollment.status)}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {humanize(enrollment.course.level)}
          </span>
        </div>
        <p className="mt-1 truncate font-semibold group-hover:text-volt-dim">
          {enrollment.course.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {enrollment.course.lessonsCount} lessons
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <ProgressRing value={enrollment.progressPercent} size={56} />
        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-volt-dim">
          {done ? "Review" : "Open"}
          <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
