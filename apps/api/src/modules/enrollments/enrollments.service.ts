import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Enrollment } from "@prisma/client";
import type { z } from "zod";
import { lessonProgressSchema } from "@volt/validation";
import type { CertificateView, EnrollmentView } from "@volt/types";

type LessonProgressInput = z.infer<typeof lessonProgressSchema>;
import { PrismaService } from "../../prisma/prisma.service";
import { toCourseSummary, type CourseWithCount } from "../courses/course.mapper";
import { CertificatesService } from "./certificates.service";

type EnrollmentWithCourse = Enrollment & { course: CourseWithCount };

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certificates: CertificatesService,
  ) {}

  private toView(
    enrollment: EnrollmentWithCourse,
    certificate: CertificateView | null = null,
  ): EnrollmentView {
    return {
      id: enrollment.id,
      course: toCourseSummary(enrollment.course),
      status: enrollment.status,
      progressPercent: enrollment.progressPercent,
      startedAt: enrollment.startedAt.toISOString(),
      completedAt: enrollment.completedAt ? enrollment.completedAt.toISOString() : null,
      certificate,
    };
  }

  async listMine(userId: string): Promise<EnrollmentView[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      include: { course: { include: { _count: { select: { lessons: true } } } } },
    });
    const certs = await this.prisma.certificate.findMany({
      where: { userId },
      include: { course: { select: { title: true } } },
    });
    const certByCourse = new Map(certs.map((c) => [c.courseId, c]));
    return Promise.all(
      enrollments.map(async (e) => {
        const raw = certByCourse.get(e.courseId);
        const certificate = raw
          ? await this.certificates.getDownload(userId, raw.id).catch(() => null)
          : null;
        return this.toView(e, certificate);
      }),
    );
  }

  /** Direct enrollment is allowed for FREE courses only; PAID courses require a payment. */
  async enroll(userId: string, courseId: string): Promise<EnrollmentView> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { _count: { select: { lessons: true } } },
    });
    if (!course) throw new NotFoundException("Course not found");
    if (course.status !== "PUBLISHED") throw new BadRequestException("Course is not available");
    if (course.accessType !== "FREE") throw new BadRequestException("Purchase required");

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) throw new ConflictException("Already enrolled in this course");

    const enrollment = await this.prisma.enrollment.create({
      data: { userId, courseId },
      include: { course: { include: { _count: { select: { lessons: true } } } } },
    });
    return this.toView(enrollment);
  }

  /** Record lesson progress and recompute the enrollment's completion percentage. */
  async recordProgress(userId: string, input: LessonProgressInput): Promise<EnrollmentView> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: input.lessonId } });
    if (!lesson) throw new NotFoundException("Lesson not found");

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: lesson.courseId } },
    });
    if (!enrollment) throw new BadRequestException("Not enrolled in this course");

    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: input.lessonId } },
      create: {
        userId,
        lessonId: input.lessonId,
        completed: input.completed,
        positionSeconds: input.positionSeconds ?? 0,
      },
      update: {
        completed: input.completed,
        ...(input.positionSeconds !== undefined ? { positionSeconds: input.positionSeconds } : {}),
      },
    });

    const [totalLessons, completedLessons] = await Promise.all([
      this.prisma.lesson.count({ where: { courseId: lesson.courseId } }),
      this.prisma.lessonProgress.count({
        where: { userId, completed: true, lesson: { courseId: lesson.courseId } },
      }),
    ]);

    const progressPercent =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    const isComplete = totalLessons > 0 && completedLessons >= totalLessons;

    const updated = await this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        progressPercent,
        status: isComplete ? "COMPLETED" : "ACTIVE",
        completedAt: isComplete ? enrollment.completedAt ?? new Date() : null,
      },
      include: { course: { include: { _count: { select: { lessons: true } } } } },
    });

    let certificate = null;
    if (isComplete) {
      certificate = await this.certificates.issueIfEligible(userId, lesson.courseId);
    }
    return this.toView(updated, certificate);
  }
}
