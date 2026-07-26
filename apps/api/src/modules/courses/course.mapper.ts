import type { Course } from "@prisma/client";
import type { CourseSummary } from "@volt/types";
import { toMoney } from "../../common/money";

export type CourseWithCount = Course & { _count: { lessons: number } };

/** Shared course catalogue projection used by courses + enrollments. */
export function toCourseSummary(course: CourseWithCount): CourseSummary {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    level: course.level,
    shortDescription: course.shortDescription,
    price: toMoney(course.priceAmount, course.priceCurrency),
    accessType: course.accessType,
    durationMinutes: course.durationMinutes,
    lessonsCount: course._count.lessons,
    thumbnailUrl: course.thumbnailKey ?? null,
    status: course.status,
    coursePlanId: course.coursePlanId ?? null,
  };
}
