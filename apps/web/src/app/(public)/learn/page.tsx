"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, GraduationCap, Sparkles } from "lucide-react";
import type { CourseLevel } from "@volt/config";
import type { CourseSummary } from "@volt/types";
import { CourseCard } from "@/components/academy/course-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { ApiRequestError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

type LevelFilter = CourseLevel | "ALL";

const LEVELS: { value: LevelFilter; label: string }[] = [
  { value: "ALL", label: "All courses" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "PREMIUM", label: "Premium" },
];

export default function LearnPage() {
  const [level, setLevel] = useState<LevelFilter>("ALL");

  const { data, isLoading, error } = useQuery({
    queryKey: ["courses", level],
    queryFn: () =>
      api.get<CourseSummary[]>(level === "ALL" ? "/courses" : `/courses?level=${level}`),
  });

  const stats = useMemo(() => {
    const courses = data ?? [];
    const free = courses.filter((c) => c.accessType === "FREE").length;
    const lessons = courses.reduce((sum, c) => sum + c.lessonsCount, 0);
    return {
      count: courses.length,
      free,
      lessons,
    };
  }, [data]);

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(70%_55%_at_15%_0%,hsl(350_73%_44%/0.16),transparent_55%),radial-gradient(50%_40%_at_90%_20%,hsl(0_0%_10%/0.12),transparent_50%)]"
      />

      <div className="container-page relative py-12 md:py-16">
        {/* Hero */}
        <header className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-volt-dim">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Forex Academy
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.75rem]">
            Learn forex at your own pace
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Structured courses to learn forex trading from the fundamentals to advanced strategy —
            clear lessons, real structure, no clutter.
          </p>
        </header>

        {/* Live catalogue stats from API */}
        <dl className="mt-8 grid max-w-xl grid-cols-3 gap-3">
          {[
            { label: "Courses", value: isLoading ? "—" : String(stats.count), icon: BookOpen },
            { label: "Lessons", value: isLoading ? "—" : String(stats.lessons), icon: GraduationCap },
            { label: "Free to start", value: isLoading ? "—" : String(stats.free), icon: Sparkles },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border/80 bg-surface/80 px-3 py-3 shadow-sm backdrop-blur-sm"
            >
              <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <item.icon className="h-3 w-3" aria-hidden />
                {item.label}
              </dt>
              <dd className="mt-1 font-display text-xl font-bold tracking-tight">{item.value}</dd>
            </div>
          ))}
        </dl>

        {/* Level filters */}
        <div className="mt-10 flex flex-wrap gap-2">
          {LEVELS.map((item) => {
            const active = level === item.value;
            return (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={active ? "primary" : "outline"}
                onClick={() => setLevel(item.value)}
                className={cn(
                  "rounded-full px-4",
                  !active && "border-foreground/10 bg-surface/80",
                )}
              >
                {item.label}
              </Button>
            );
          })}
        </div>

        {error ? (
          <Alert variant="danger" className="mt-8">
            {error instanceof ApiRequestError ? error.message : "Failed to load courses."}
          </Alert>
        ) : null}

        <div className="mt-8 md:mt-10">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[22rem] w-full rounded-[1.35rem]" />
              ))}
            </div>
          ) : data && data.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((course, index) => (
                <CourseCard key={course.id} course={course} index={index} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={GraduationCap}
              title="No courses found"
              description="Try a different level filter, or check back soon — new courses are added regularly."
            />
          )}
        </div>
      </div>
    </div>
  );
}
