import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { KycStatus, KycSubmission, Prisma } from "@prisma/client";
import type { KycSubmissionInput } from "@volt/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

export type AdminKycView = {
  id: string;
  documentType: KycSubmission["documentType"];
  documentNumber: string;
  status: KycStatus;
  reviewerNote: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  frontImageKey: string;
  backImageKey: string | null;
  selfieKey: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  selfieUrl: string | null;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    kycStatus: KycStatus;
    country: string | null;
  } | null;
};

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private publicUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    const base = (this.config.get<string>("S3_PUBLIC_URL") ?? "").replace(/\/$/, "");
    if (!base) return null;
    if (key.startsWith("http://") || key.startsWith("https://")) return key;
    return `${base}/${key.replace(/^\//, "")}`;
  }

  private toAdminView(
    submission: KycSubmission & {
      user?: {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        kycStatus: KycStatus;
        country: string | null;
      } | null;
    },
  ): AdminKycView {
    return {
      id: submission.id,
      documentType: submission.documentType,
      documentNumber: submission.documentNumber,
      status: submission.status,
      reviewerNote: submission.reviewerNote ?? null,
      reviewedById: submission.reviewedById ?? null,
      reviewedAt: submission.reviewedAt ? submission.reviewedAt.toISOString() : null,
      createdAt: submission.createdAt.toISOString(),
      frontImageKey: submission.frontImageKey,
      backImageKey: submission.backImageKey ?? null,
      selfieKey: submission.selfieKey ?? null,
      frontImageUrl: this.publicUrl(submission.frontImageKey),
      backImageUrl: this.publicUrl(submission.backImageKey),
      selfieUrl: this.publicUrl(submission.selfieKey),
      user: submission.user
        ? {
            id: submission.user.id,
            fullName: submission.user.fullName,
            email: submission.user.email,
            phone: submission.user.phone,
            kycStatus: submission.user.kycStatus,
            country: submission.user.country,
          }
        : null,
    };
  }

  /** Submit KYC docs. Creates a PENDING submission and flags the user PENDING. */
  async submit(userId: string, input: KycSubmissionInput) {
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.kycSubmission.create({
        data: {
          userId,
          documentType: input.documentType,
          documentNumber: input.documentNumber,
          frontImageKey: input.frontImageKey,
          backImageKey: input.backImageKey ?? null,
          selfieKey: input.selfieKey ?? null,
          status: "PENDING",
        },
      });
      await tx.user.update({ where: { id: userId }, data: { kycStatus: "PENDING" } });
      await this.audit.log(
        {
          actorId: userId,
          action: "kyc.submitted",
          entityType: "KycSubmission",
          entityId: submission.id,
          metadata: { documentType: submission.documentType },
        },
        tx,
      );
      return submission;
    });
  }

  /** The caller's latest submission plus their current gating status. */
  async getMine(userId: string) {
    const [submission, user] = await Promise.all([
      this.prisma.kycSubmission.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { kycStatus: true },
      }),
    ]);
    if (!user) throw new NotFoundException("User not found");
    return { kycStatus: user.kycStatus, submission };
  }

  /** Admin review queue, optionally filtered by status. */
  async list(status: KycStatus | undefined, page: number, pageSize: number) {
    const where: Prisma.KycSubmissionWhereInput = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.kycSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              kycStatus: true,
              country: true,
            },
          },
        },
      }),
      this.prisma.kycSubmission.count({ where }),
    ]);
    return { items: items.map((i) => this.toAdminView(i)), total };
  }

  async getById(id: string): Promise<AdminKycView> {
    const submission = await this.prisma.kycSubmission.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            kycStatus: true,
            country: true,
          },
        },
      },
    });
    if (!submission) throw new NotFoundException("KYC submission not found");
    return this.toAdminView(submission);
  }

  /** Compliance decision: update the submission and the user's gating status. */
  async review(
    id: string,
    status: KycStatus,
    reviewerNote: string | undefined,
    reviewerId: string,
    ip?: string,
  ) {
    const existing = await this.prisma.kycSubmission.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            kycStatus: true,
            country: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException("KYC submission not found");

    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.kycSubmission.update({
        where: { id },
        data: {
          status,
          reviewerNote: reviewerNote ?? null,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              kycStatus: true,
              country: true,
            },
          },
        },
      });
      await tx.user.update({
        where: { id: existing.userId },
        data: { kycStatus: status },
      });
      await this.audit.log(
        {
          actorId: reviewerId,
          action: "kyc.reviewed",
          entityType: "KycSubmission",
          entityId: id,
          ip,
          metadata: { status, userId: existing.userId, reviewerNote: reviewerNote ?? null },
        },
        tx,
      );
      return this.toAdminView(submission);
    });
  }
}
