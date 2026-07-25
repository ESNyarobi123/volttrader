import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { QuizUpsertInput, QuizSubmitInput, QuizQuestionInput } from "@volt/validation";
import type { QuizResultView, QuizView } from "@volt/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CertificatesService } from "../enrollments/certificates.service";

@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly certificates: CertificatesService,
  ) {}

  private parseQuestions(raw: unknown): QuizQuestionInput[] {
    if (!Array.isArray(raw)) return [];
    return raw as QuizQuestionInput[];
  }

  private async assertEnrolled(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.status === "REVOKED") {
      throw new ForbiddenException("Enrollment required");
    }
    return enrollment;
  }

  async upsertForCourse(courseId: string, input: QuizUpsertInput, actorId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException("Course not found");

    for (const q of input.questions) {
      if (q.correctIndex >= q.choices.length) {
        throw new BadRequestException(`Invalid correctIndex for question ${q.id}`);
      }
    }

    const quiz = await this.prisma.quiz.upsert({
      where: { courseId },
      create: {
        courseId,
        title: input.title,
        passScore: input.passScore,
        questions: input.questions,
      },
      update: {
        title: input.title,
        passScore: input.passScore,
        questions: input.questions,
      },
    });

    await this.audit.log({
      actorId,
      action: "course.quiz_upserted",
      entityType: "Quiz",
      entityId: quiz.id,
      metadata: { courseId, questionCount: input.questions.length },
    });

    return {
      id: quiz.id,
      courseId: quiz.courseId,
      title: quiz.title,
      passScore: quiz.passScore,
      questions: this.parseQuestions(quiz.questions),
    };
  }

  async adminGetForCourse(courseId: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { courseId } });
    if (!quiz) return null;
    return {
      id: quiz.id,
      courseId: quiz.courseId,
      title: quiz.title,
      passScore: quiz.passScore,
      questions: this.parseQuestions(quiz.questions),
    };
  }

  async getForLearner(courseId: string, userId: string): Promise<QuizView> {
    await this.assertEnrolled(userId, courseId);
    const quiz = await this.prisma.quiz.findUnique({ where: { courseId } });
    if (!quiz) throw new NotFoundException("Quiz not found for this course");

    const latest = await this.prisma.quizResult.findFirst({
      where: { quizId: quiz.id, userId },
      orderBy: { createdAt: "desc" },
    });

    const questions = this.parseQuestions(quiz.questions).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      choices: q.choices,
    }));

    return {
      id: quiz.id,
      courseId: quiz.courseId,
      title: quiz.title,
      passScore: quiz.passScore,
      questions,
      latestResult: latest
        ? {
            id: latest.id,
            score: latest.score,
            passed: latest.passed,
            createdAt: latest.createdAt.toISOString(),
          }
        : null,
    };
  }

  async submit(
    courseId: string,
    userId: string,
    input: QuizSubmitInput,
  ): Promise<QuizResultView> {
    await this.assertEnrolled(userId, courseId);
    const quiz = await this.prisma.quiz.findUnique({ where: { courseId } });
    if (!quiz) throw new NotFoundException("Quiz not found for this course");

    const questions = this.parseQuestions(quiz.questions);
    if (questions.length === 0) throw new BadRequestException("Quiz has no questions");

    const byId = new Map(questions.map((q) => [q.id, q]));
    let correct = 0;
    for (const answer of input.answers) {
      const q = byId.get(answer.questionId);
      if (!q) continue;
      if (answer.choiceIndex === q.correctIndex) correct += 1;
    }

    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= quiz.passScore;

    const result = await this.prisma.quizResult.create({
      data: {
        quizId: quiz.id,
        userId,
        score,
        passed,
        answers: input.answers,
      },
    });

    if (passed) {
      await this.certificates.issueIfEligible(userId, courseId);
    }

    return {
      id: result.id,
      score: result.score,
      passed: result.passed,
      createdAt: result.createdAt.toISOString(),
    };
  }
}
