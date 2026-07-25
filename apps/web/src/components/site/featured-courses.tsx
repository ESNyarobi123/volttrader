import Link from "next/link";
import {
  ArrowRight,
  Clock,
  GraduationCap,
  Play,
  Sparkles,
} from "lucide-react";
import type { CourseLevel, CourseSummary } from "@volt/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { humanize } from "@/lib/status";
import { cn } from "@/lib/utils";

const LEVEL_THEME: Record<
  CourseLevel,
  {
    wash: string;
    badge: string;
    play: string;
    bar: string;
    orb: string;
  }
> = {
  BEGINNER: {
    wash: "from-volt/35 via-[hsl(350_73%_44%/0.12)] to-[hsl(0_0%_10%/0.15)]",
    badge: "bg-volt/20 text-volt-dim",
    play: "bg-volt text-volt-foreground group-hover:shadow-[0_12px_28px_-10px_hsl(350_73%_36%/0.7)]",
    bar: "from-volt/70 to-volt/15",
    orb: "bg-volt/40",
  },
  INTERMEDIATE: {
    wash: "from-[hsl(0_0%_10%/0.32)] via-[hsl(349_74%_36%/0.1)] to-volt/15",
    badge: "bg-[hsl(351_77%_61%/0.15)] text-[hsl(213_70%_36%)]",
    play: "bg-[hsl(350_73%_44%)] text-white group-hover:shadow-[0_12px_28px_-10px_hsl(349_74%_30%/0.65)]",
    bar: "from-[hsl(351_77%_61%/0.7)] to-[hsl(351_77%_61%/0.12)]",
    orb: "bg-[hsl(351_77%_61%/0.4)]",
  },
  ADVANCED: {
    wash: "from-[hsl(142_65%_29%/0.28)] via-surface to-[hsl(0_0%_10%/0.12)]",
    badge: "bg-[hsl(142_65%_29%/0.14)] text-[hsl(162_45%_30%)]",
    play: "bg-[hsl(162_55%_38%)] text-white group-hover:shadow-[0_12px_28px_-10px_hsl(162_55%_30%/0.6)]",
    bar: "from-[hsl(142_65%_29%/0.7)] to-[hsl(142_65%_29%/0.12)]",
    orb: "bg-[hsl(142_65%_29%/0.4)]",
  },
  PREMIUM: {
    wash: "from-[hsl(349_74%_36%/0.3)] via-[hsl(262_40%_70%/0.1)] to-volt/20",
    badge: "bg-[hsl(349_74%_36%/0.18)] text-[hsl(38_80%_32%)]",
    play: "bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground group-hover:shadow-[0_12px_28px_-10px_hsl(349_74%_30%/0.65)]",
    bar: "from-[hsl(349_74%_36%/0.75)] to-volt/15",
    orb: "bg-[hsl(349_74%_36%/0.45)]",
  },
};

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function CourseArt({ level, index }: { level: CourseLevel; index: number }) {
  const theme = LEVEL_THEME[level];
  return (
    <div
      className={cn(
        "relative aspect-[16/10] overflow-hidden bg-gradient-to-br",
        theme.wash,
      )}
    >
      {/* Soft chart / lesson motif */}
      <svg
        viewBox="0 0 200 120"
        className="absolute inset-0 h-full w-full opacity-40"
        aria-hidden
      >
        <path
          d={
            index % 2 === 0
              ? "M0 90 C30 85, 40 50, 70 55 C100 60, 110 30, 140 35 C165 38, 180 55, 200 40"
              : "M0 70 C35 95, 50 40, 80 50 C110 60, 120 25, 150 40 C170 50, 185 30, 200 45"
          }
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-foreground/25"
          strokeLinecap="round"
        />
        {[28, 56, 84, 112, 140, 168].map((x, i) => (
          <rect
            key={x}
            x={x}
            y={70 - ((i * 11 + index * 7) % 40)}
            width="10"
            height={30 + ((i * 9 + index * 5) % 28)}
            rx="2"
            className="fill-foreground/8"
          />
        ))}
      </svg>

      <span
        aria-hidden
        className={cn(
          "absolute -right-6 -top-6 h-28 w-28 rounded-full blur-2xl",
          theme.orb,
        )}
      />
      <span
        aria-hidden
        className="absolute -bottom-8 left-8 h-24 w-24 rounded-full bg-background/40 blur-2xl"
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            "grid h-14 w-14 place-items-center rounded-full shadow-lg transition-transform duration-300 group-hover:scale-110",
            theme.play,
          )}
        >
          <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
        </span>
      </div>

      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm",
            theme.badge,
          )}
        >
          {humanize(level)}
        </span>
      </div>
    </div>
  );
}

function FeaturedCourseCard({
  course,
  index,
  spotlight,
}: {
  course: CourseSummary;
  index: number;
  spotlight?: boolean;
}) {
  const theme = LEVEL_THEME[course.level];
  const priceLabel =
    course.accessType === "FREE" ? "Free" : formatMoney(course.price);

  return (
    <Link
      href={`/courses/${course.slug}`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border/80 bg-surface/95 shadow-card backdrop-blur-sm transition-all duration-300",
        "hover:-translate-y-1.5 hover:border-volt/35 hover:shadow-[0_24px_48px_-28px_hsl(350_73%_36%/0.4)]",
        spotlight && "md:col-span-2 md:grid md:grid-cols-[1.15fr_1fr] md:items-stretch",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r opacity-80 transition-opacity group-hover:opacity-100",
          theme.bar,
        )}
      />

      <div className={cn(spotlight && "md:min-h-full")}>
        <CourseArt level={course.level} index={index} />
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col p-5",
          spotlight && "md:justify-center md:p-7",
        )}
      >
        {spotlight && (
          <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-md bg-volt/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-volt-dim">
            <Sparkles className="h-3 w-3" />
            Start here
          </span>
        )}

        <h3
          className={cn(
            "font-display font-bold tracking-tight transition-colors group-hover:text-volt-dim",
            spotlight ? "text-2xl md:text-[1.65rem]" : "text-lg",
          )}
        >
          <span className="line-clamp-2">{course.title}</span>
        </h3>
        <p
          className={cn(
            "mt-2 text-sm leading-relaxed text-muted-foreground",
            spotlight ? "line-clamp-3 md:line-clamp-4" : "line-clamp-2",
          )}
        >
          {course.shortDescription}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" />
            {course.lessonsCount} lessons
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(course.durationMinutes)}
          </span>
          {course.accessType === "FREE" && (
            <span className="rounded-md bg-[hsl(142_62%_40%/0.12)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[hsl(142_55%_32%)]">
              Free access
            </span>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            {priceLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors group-hover:text-volt-dim">
            View course
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function FeaturedCourses({
  courses,
  isLoading,
  className,
}: {
  courses: CourseSummary[];
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden py-20 md:py-28", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_15%_20%,hsl(350_73%_44%/0.14),transparent_55%),radial-gradient(50%_40%_at_90%_70%,hsl(0_0%_10%/0.1),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />

      <div className="container-page relative">
        <header className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-volt-dim">
              Forex Academy
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.75rem]">
              Featured courses
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Start with the fundamentals, then move into advanced strategy.
            </p>
          </div>
          <Link href="/learn" className="shrink-0">
            <Button
              variant="outline"
              className="rounded-full border-foreground/12 bg-surface/80 px-5 shadow-sm backdrop-blur-sm"
            >
              View all courses
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </Link>
        </header>

        <div className="mt-12 md:mt-14">
          {isLoading ? (
            <div className="space-y-5">
              <Skeleton className="h-72 w-full rounded-[1.35rem] md:h-64" />
              <div className="grid gap-5 md:grid-cols-2">
                <Skeleton className="h-80 w-full rounded-[1.35rem]" />
                <Skeleton className="h-80 w-full rounded-[1.35rem]" />
              </div>
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              title="Courses coming soon"
              description="Our Forex Academy catalogue is being prepared."
            />
          ) : courses.length === 1 ? (
            <FeaturedCourseCard course={courses[0]} index={0} spotlight />
          ) : (
            <div className="space-y-5">
              <FeaturedCourseCard course={courses[0]} index={0} spotlight />
              <div className="grid gap-5 md:grid-cols-2">
                {courses.slice(1).map((course, index) => (
                  <FeaturedCourseCard
                    key={course.id}
                    course={course}
                    index={index + 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
