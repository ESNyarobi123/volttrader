import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { BRAND } from "@volt/config";
import type { CertificateView } from "@volt/types";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { buildCertificatePdf } from "../storage/certificate-pdf";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  private async toView(cert: {
    id: string;
    courseId: string;
    certificateNumber: string;
    pdfKey: string | null;
    issuedAt: Date;
    course: { title: string };
  }): Promise<CertificateView> {
    const downloadUrl = cert.pdfKey ? await this.storage.presignGet(cert.pdfKey, 3600) : null;
    return {
      id: cert.id,
      courseId: cert.courseId,
      courseTitle: cert.course.title,
      certificateNumber: cert.certificateNumber,
      issuedAt: cert.issuedAt.toISOString(),
      downloadUrl,
    };
  }

  async listMine(userId: string): Promise<CertificateView[]> {
    const rows = await this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
      include: { course: { select: { title: true } } },
    });
    return Promise.all(rows.map((r) => this.toView(r)));
  }

  async getDownload(userId: string, certificateId: string): Promise<CertificateView> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      include: { course: { select: { title: true } } },
    });
    if (!cert) throw new NotFoundException("Certificate not found");
    if (cert.userId !== userId) throw new ForbiddenException("Not your certificate");
    return this.toView(cert);
  }

  /**
   * Issue a certificate when lessons are complete and quiz (if any) is passed.
   * Idempotent — returns existing cert when already issued.
   */
  async issueIfEligible(userId: string, courseId: string): Promise<CertificateView | null> {
    const existing = await this.prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: { course: { select: { title: true } } },
    });
    if (existing) return this.toView(existing);

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.status === "REVOKED") return null;

    const [totalLessons, completedLessons, quiz, user, course] = await Promise.all([
      this.prisma.lesson.count({ where: { courseId } }),
      this.prisma.lessonProgress.count({
        where: { userId, completed: true, lesson: { courseId } },
      }),
      this.prisma.quiz.findUnique({ where: { courseId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.course.findUnique({ where: { id: courseId } }),
    ]);

    if (!user || !course) return null;
    if (totalLessons === 0 || completedLessons < totalLessons) return null;

    if (quiz) {
      const pass = await this.prisma.quizResult.findFirst({
        where: { quizId: quiz.id, userId, passed: true },
      });
      if (!pass) return null;
    }

    const certificateNumber = `VT-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const issuedAt = new Date();
    const pdf = buildCertificatePdf({
      learnerName: user.fullName,
      courseTitle: course.title,
      certificateNumber,
      issuedAt: issuedAt.toISOString().slice(0, 10),
      brandName: BRAND.name,
    });
    const pdfKey = `certificates/${userId}/${courseId}-${certificateNumber}.pdf`;
    await this.storage.putObject(pdfKey, pdf, "application/pdf");

    const created = await this.prisma.certificate.create({
      data: {
        userId,
        courseId,
        certificateNumber,
        pdfKey,
        issuedAt,
      },
      include: { course: { select: { title: true } } },
    });

    if (enrollment.status !== "COMPLETED") {
      await this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "COMPLETED",
          progressPercent: 100,
          completedAt: enrollment.completedAt ?? issuedAt,
        },
      });
    }

    await this.audit.log({
      actorId: userId,
      action: "course.certificate_issued",
      entityType: "Certificate",
      entityId: created.id,
      metadata: { courseId, certificateNumber },
    });

    return this.toView(created);
  }
}
