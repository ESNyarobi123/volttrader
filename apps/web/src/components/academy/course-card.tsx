import Link from "next/link";
import { Clock, GraduationCap } from "lucide-react";
import type { CourseSummary } from "@volt/types";
import { CourseVideoFrame } from "@/components/academy/course-media";
import { formatMoney } from "@/lib/format";
import { humanize } from "@/lib/status";
import { cn } from "@/lib/utils";

const LEVEL_CHIP: Record<CourseSummary["level"], string> = {
  BEGINNER: "bg-volt/15 text-volt-dim",
  INTERMEDIATE: "bg-[hsl(351_77%_61%/0.12)] text-[hsl(213_70%_36%)]",
  ADVANCED: "bg-[hsl(142_65%_29%/0.12)] text-[hsl(162_45%_30%)]",
  PREMIUM: "bg-[hsl(349_74%_36%/0.16)] text-[hsl(38_80%_32%)]",
};

export function CourseCard({
  course,
  index = 0,
  className,
}: {
  course: CourseSummary;
  index?: number;
  className?: string;
}) {
  const priceLabel =
    course.accessType === "FREE" ? "Free" : formatMoney(course.price);

  return (
    <Link
      href={`/courses/${course.slug}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border/80 bg-surface/95 shadow-card transition-all duration-300",
        "hover:-translate-y-1.5 hover:border-volt/35 hover:shadow-[0_24px_48px_-28px_hsl(350_73%_36%/0.4)]",
        className,
      )}
    >
      <div className="p-2.5 pb-0">
        <CourseVideoFrame
          level={course.level}
          title={course.title}
          durationMinutes={course.durationMinutes}
          thumbnailUrl={course.thumbnailUrl}
          index={index}
        />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5 pt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              LEVEL_CHIP[course.level],
            )}
          >
            {humanize(course.level)}
          </span>
          {course.accessType === "FREE" ? (
            <span className="rounded-md bg-[hsl(142_62%_40%/0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(142_55%_32%)]">
              Free
            </span>
          ) : null}
        </div>

        <h3 className="line-clamp-2 font-display text-lg font-bold leading-snug tracking-tight transition-colors group-hover:text-volt-dim">
          {course.title}
        </h3>
        <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {course.shortDescription}
        </p>

        <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/70 pt-3.5">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden />
              {course.lessonsCount} lessons
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {course.durationMinutes}m
            </span>
          </div>
          <span className="font-display text-sm font-bold tracking-tight text-foreground">
            {priceLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
