import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Course, CourseLevel, CourseStatus } from "@prisma/client";
import type {
  CourseUpsertInput,
  LessonUpsertInput,
} from "@volt/validation";
import type { CourseDetail, CourseSummary, LessonPlaybackView, LessonSummary } from "@volt/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { StorageService } from "../storage/storage.service";
import { CertificatesService } from "../enrollments/certificates.service";
import { PlanAccessService } from "../plan-access/plan-access.service";
import { toMoney } from "../../common/money";
import { toCourseSummary } from "./course.mapper";

export interface CreateCategoryInput {
  name: string;
  slug: string;
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly certificates: CertificatesService,
    private readonly planAccess: PlanAccessService,
  ) {}

  /** Public catalogue — published courses only, optionally filtered by level. */
  async listPublished(level?: CourseLevel): Promise<CourseSummary[]> {
    const courses = await this.prisma.course.findMany({
      where: { status: "PUBLISHED", ...(level ? { level } : {}) },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { lessons: true } } },
    });
    return courses.map((c) => toCourseSummary(c));
  }

  /**
   * Public course detail with lessons. Non-preview lessons of a PAID course are
   * locked unless the viewer is enrolled. FREE courses never lock lessons.
   */
  async getBySlug(slug: string, userId?: string): Promise<CourseDetail> {
    const course = await this.prisma.course.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: {
        _count: { select: { lessons: true } },
        lessons: { orderBy: { order: "asc" } },
        quiz: { select: { id: true } },
      },
    });
    if (!course) throw new NotFoundException("Course not found");

    let enrolled = false;
    let hasPlanAccess = false;
    let certificate = null;
    if (userId) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
      });
      enrolled = !!enrollment && enrollment.status !== "REVOKED";
      hasPlanAccess = await this.planAccess.canAccessCourse(userId, course);
      if (hasPlanAccess && !enrolled) {
        await this.prisma.enrollment.create({
          data: { userId, courseId: course.id },
        });
        enrolled = true;
      }
      if (enrolled) {
        const cert = await this.prisma.certificate.findUnique({
          where: { userId_courseId: { userId, courseId: course.id } },
        });
        if (cert) {
          certificate = await this.certificates.getDownload(userId, cert.id).catch(() => null);
        }
      }
    }

    const lessons: LessonSummary[] = course.lessons.map((lesson) => {
      const locked = !lesson.isPreview && !enrolled && !hasPlanAccess;
      return {
        id: lesson.id,
        title: lesson.title,
        order: lesson.order,
        isPreview: lesson.isPreview,
        durationSeconds: lesson.durationSeconds,
        locked,
        hasVideo: Boolean(lesson.videoKey),
        content: locked ? null : lesson.content,
      };
    });

    return {
      ...toCourseSummary(course),
      description: course.description,
      learningOutcomes: course.learningOutcomes,
      lessons,
      enrolled,
      hasQuiz: Boolean(course.quiz),
      certificate,
    };
  }

  async getLessonPlayback(lessonId: string, userId: string): Promise<LessonPlaybackView> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: lesson.courseId } },
    });
    const enrolled = !!enrollment && enrollment.status !== "REVOKED";
    const isPaid = lesson.course.accessType === "PAID";
    const locked = isPaid && !lesson.isPreview && !enrolled;
    if (locked) throw new ForbiddenException("Enroll to access this lesson");

    const expiresInSeconds = 3600;
    const videoUrl = lesson.videoKey
      ? await this.storage.presignGet(lesson.videoKey, expiresInSeconds)
      : null;

    return {
      lessonId: lesson.id,
      videoUrl,
      content: lesson.content,
      expiresInSeconds,
    };
  }

  /** Admin — every course regardless of status. */
  async listAll(): Promise<CourseSummary[]> {
    const courses = await this.prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { lessons: true } } },
    });
    return courses.map((c) => toCourseSummary(c));
  }

  async createCourse(input: CourseUpsertInput, actorId: string): Promise<CourseSummary> {
    const existing = await this.prisma.course.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ConflictException("A course with this slug already exists");

    const course = await this.prisma.course.create({
      data: {
        title: input.title,
        slug: input.slug,
        level: input.level,
        shortDescription: input.shortDescription,
        description: input.description,
        learningOutcomes: input.learningOutcomes,
        priceAmount: BigInt(input.price.amount),
        priceCurrency: input.price.currency,
        accessType: input.accessType,
        durationMinutes: input.durationMinutes,
        thumbnailKey: input.thumbnailKey ?? null,
        categoryId: input.categoryId ?? null,
        coursePlanId: input.coursePlanId ?? null,
      },
      include: { _count: { select: { lessons: true } } },
    });

    await this.audit.log({
      actorId,
      action: "course.created",
      entityType: "Course",
      entityId: course.id,
      metadata: { slug: course.slug },
    });

    return toCourseSummary(course);
  }

  async updateCourse(
    id: string,
    input: Partial<CourseUpsertInput> & { status?: CourseStatus },
    actorId: string,
  ): Promise<CourseSummary> {
    const existing = await this.prisma.course.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Course not found");

    if (input.slug && input.slug !== existing.slug) {
      const clash = await this.prisma.course.findUnique({ where: { slug: input.slug } });
      if (clash) throw new ConflictException("A course with this slug already exists");
    }

    const data: Prisma.CourseUncheckedUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.level !== undefined) data.level = input.level;
    if (input.shortDescription !== undefined) data.shortDescription = input.shortDescription;
    if (input.description !== undefined) data.description = input.description;
    if (input.learningOutcomes !== undefined) data.learningOutcomes = input.learningOutcomes;
    if (input.price !== undefined) {
      data.priceAmount = BigInt(input.price.amount);
      data.priceCurrency = input.price.currency;
    }
    if (input.accessType !== undefined) data.accessType = input.accessType;
    if (input.durationMinutes !== undefined) data.durationMinutes = input.durationMinutes;
    if (input.thumbnailKey !== undefined) data.thumbnailKey = input.thumbnailKey;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.coursePlanId !== undefined) data.coursePlanId = input.coursePlanId;
    if (input.status !== undefined) data.status = input.status;

    const course = await this.prisma.course.update({
      where: { id },
      data,
      include: { _count: { select: { lessons: true } } },
    });

    await this.audit.log({
      actorId,
      action: "course.updated",
      entityType: "Course",
      entityId: course.id,
      metadata: { fields: Object.keys(data) },
    });

    return toCourseSummary(course);
  }

  async addLesson(courseId: string, input: LessonUpsertInput, actorId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException("Course not found");

    const clash = await this.prisma.lesson.findUnique({
      where: { courseId_order: { courseId, order: input.order } },
    });
    if (clash) throw new ConflictException("A lesson with this order already exists");

    const lesson = await this.prisma.lesson.create({
      data: {
        courseId,
        title: input.title,
        order: input.order,
        videoKey: input.videoKey ?? null,
        content: input.content ?? null,
        isPreview: input.isPreview,
      },
    });

    await this.audit.log({
      actorId,
      action: "course.lesson_added",
      entityType: "Lesson",
      entityId: lesson.id,
      metadata: { courseId },
    });

    return lesson;
  }

  async createCategory(input: CreateCategoryInput, actorId: string) {
    const existing = await this.prisma.category.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ConflictException("A category with this slug already exists");

    const category = await this.prisma.category.create({
      data: { name: input.name, slug: input.slug },
    });

    await this.audit.log({
      actorId,
      action: "course.category_created",
      entityType: "Category",
      entityId: category.id,
      metadata: { slug: category.slug },
    });

    return category;
  }

  async listCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
  }

  /**
   * Admin editor view — the full course by id, including every lesson field
   * (unlike the public /:slug view, nothing is locked or omitted here).
   */
  async adminGetCourse(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        category: true,
        lessons: { orderBy: { order: "asc" } },
        quiz: true,
      },
    });
    if (!course) throw new NotFoundException("Course not found");

    const quiz = course.quiz;

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      level: course.level,
      shortDescription: course.shortDescription,
      description: course.description,
      learningOutcomes: course.learningOutcomes,
      price: toMoney(course.priceAmount, course.priceCurrency),
      accessType: course.accessType,
      durationMinutes: course.durationMinutes,
      thumbnailUrl: course.thumbnailKey ?? null,
      status: course.status,
      coursePlanId: course.coursePlanId,
      category: course.category,
      lessons: course.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        order: lesson.order,
        videoKey: lesson.videoKey,
        content: lesson.content,
        durationSeconds: lesson.durationSeconds,
        isPreview: lesson.isPreview,
      })),
      quiz: quiz
        ? {
            id: quiz.id,
            title: quiz.title,
            passScore: quiz.passScore,
            questions: quiz.questions,
          }
        : null,
    };
  }

  async updateLesson(
    lessonId: string,
    input: {
      title?: string;
      order?: number;
      videoKey?: string;
      content?: string;
      isPreview?: boolean;
    },
    actorId: string,
  ) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException("Lesson not found");

    if (input.order !== undefined && input.order !== lesson.order) {
      const clash = await this.prisma.lesson.findUnique({
        where: { courseId_order: { courseId: lesson.courseId, order: input.order } },
      });
      if (clash) throw new ConflictException("A lesson with this order already exists");
    }

    const data: Prisma.LessonUncheckedUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.order !== undefined) data.order = input.order;
    if (input.videoKey !== undefined) data.videoKey = input.videoKey;
    if (input.content !== undefined) data.content = input.content;
    if (input.isPreview !== undefined) data.isPreview = input.isPreview;

    const updated = await this.prisma.lesson.update({ where: { id: lessonId }, data });

    await this.audit.log({
      actorId,
      action: "course.lesson_updated",
      entityType: "Lesson",
      entityId: lessonId,
      metadata: { courseId: lesson.courseId, fields: Object.keys(data) },
    });

    return updated;
  }

  async deleteLesson(lessonId: string, actorId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException("Lesson not found");

    await this.prisma.lesson.delete({ where: { id: lessonId } });

    await this.audit.log({
      actorId,
      action: "course.lesson_deleted",
      entityType: "Lesson",
      entityId: lessonId,
      metadata: { courseId: lesson.courseId },
    });

    return { id: lessonId, deleted: true };
  }

  /**
   * Hard-delete a course. Blocked when learners are enrolled — archive instead
   * so money/learning history stays intact.
   */
  async deleteCourse(id: string, actorId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { enrollments: true, lessons: true } } },
    });
    if (!course) throw new NotFoundException("Course not found");

    if (course._count.enrollments > 0) {
      throw new BadRequestException(
        `Cannot delete "${course.title}" — ${course._count.enrollments} enrollment(s) exist. Archive it instead.`,
      );
    }

    await this.prisma.course.delete({ where: { id } });

    await this.audit.log({
      actorId,
      action: "course.deleted",
      entityType: "Course",
      entityId: id,
      metadata: { slug: course.slug, lessons: course._count.lessons },
    });

    return { id, deleted: true };
  }
}
