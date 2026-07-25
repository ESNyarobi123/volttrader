import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import { Role, CourseStatus } from "@volt/config";
import {
  courseUpsertSchema,
  lessonUpsertSchema,
  quizUpsertSchema,
  quizSubmitSchema,
  type CourseUpsertInput,
  type LessonUpsertInput,
  type QuizUpsertInput,
  type QuizSubmitInput,
} from "@volt/validation";
import type { CourseLevel } from "@prisma/client";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Public } from "../../common/decorators/public.decorator";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CoursesService } from "./courses.service";
import { QuizzesService } from "./quizzes.service";

const courseUpdateSchema = courseUpsertSchema
  .partial()
  .extend({ status: z.nativeEnum(CourseStatus).optional() });
type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
});
type CategoryInput = z.infer<typeof categorySchema>;

/** Partial lesson edit — no courseId (the lesson's course never changes here). */
const lessonUpdateSchema = z.object({
  title: z.string().min(3).max(160).optional(),
  order: z.number().int().nonnegative().optional(),
  videoKey: z.string().optional(),
  content: z.string().max(20000).optional(),
  isPreview: z.boolean().optional(),
});
type LessonUpdateInput = z.infer<typeof lessonUpdateSchema>;

@Controller("courses")
export class CoursesController {
  constructor(
    private readonly courses: CoursesService,
    private readonly quizzes: QuizzesService,
  ) {}

  @Get()
  @Public()
  list(@Query("level") level?: CourseLevel) {
    return this.courses.listPublished(level);
  }

  // Admin routes declared before ":slug" so they are not swallowed by the param route.
  @Get("admin/all")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  listAll() {
    return this.courses.listAll();
  }

  @Get("categories")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  listCategories() {
    return this.courses.listCategories();
  }

  @Get("admin/:id")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  adminGetCourse(@Param("id") id: string) {
    return this.courses.adminGetCourse(id);
  }

  @Post()
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  create(
    @Body(new ZodValidationPipe(courseUpsertSchema)) dto: CourseUpsertInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.courses.createCourse(dto, actorId);
  }

  @Post("categories")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  createCategory(
    @Body(new ZodValidationPipe(categorySchema)) dto: CategoryInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.courses.createCategory(dto, actorId);
  }

  @Patch(":id")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(courseUpdateSchema)) dto: CourseUpdateInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.courses.updateCourse(id, dto, actorId);
  }

  @Delete(":id")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  remove(@Param("id") id: string, @CurrentUser("id") actorId: string) {
    return this.courses.deleteCourse(id, actorId);
  }

  @Post(":id/lessons")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  addLesson(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(lessonUpsertSchema)) dto: LessonUpsertInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.courses.addLesson(id, dto, actorId);
  }

  @Patch("lessons/:lessonId")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  updateLesson(
    @Param("lessonId") lessonId: string,
    @Body(new ZodValidationPipe(lessonUpdateSchema)) dto: LessonUpdateInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.courses.updateLesson(lessonId, dto, actorId);
  }

  @Delete("lessons/:lessonId")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  deleteLesson(@Param("lessonId") lessonId: string, @CurrentUser("id") actorId: string) {
    return this.courses.deleteLesson(lessonId, actorId);
  }

  @Get("lessons/:lessonId/playback")
  @Auth()
  lessonPlayback(@Param("lessonId") lessonId: string, @CurrentUser("id") userId: string) {
    return this.courses.getLessonPlayback(lessonId, userId);
  }

  @Put(":id/quiz")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  upsertQuiz(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(quizUpsertSchema)) dto: QuizUpsertInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.quizzes.upsertForCourse(id, dto, actorId);
  }

  @Get(":id/quiz/admin")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  adminQuiz(@Param("id") id: string) {
    return this.quizzes.adminGetForCourse(id);
  }

  @Get(":id/quiz")
  @Auth()
  learnerQuiz(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.quizzes.getForLearner(id, userId);
  }

  @Post(":id/quiz/submit")
  @Auth()
  submitQuiz(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(quizSubmitSchema)) dto: QuizSubmitInput,
    @CurrentUser("id") userId: string,
  ) {
    return this.quizzes.submit(id, userId, dto);
  }

  @Get(":slug")
  @Public()
  getBySlug(@Param("slug") slug: string, @CurrentUser("id") userId?: string) {
    return this.courses.getBySlug(slug, userId);
  }
}
