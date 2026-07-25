import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Withdrawal, WithdrawalStatus } from "@prisma/client";
import type {
  AdminCreateWithdrawalInput,
  AdminUpdateWithdrawalInput,
  WithdrawalRequestInput,
} from "@volt/validation";
import type { WithdrawalView } from "@volt/types";
import { PrismaService } from "../../prisma/prisma.service";
import { LedgerService } from "../ledger/ledger.service";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "../auth/auth.service";
import { toMoney } from "../../common/money";
import type { WithdrawalReviewInput } from "./dto/withdrawal-review.schema";

/** Which current statuses each review action may be applied to. */
const ALLOWED_FROM: Record<WithdrawalReviewInput["action"], WithdrawalStatus[]> = {
  APPROVE: ["REQUESTED", "UNDER_REVIEW"],
  PROCESS: ["APPROVED"],
  COMPLETE: ["PROCESSING"],
  REJECT: ["REQUESTED", "UNDER_REVIEW", "APPROVED"],
  FAIL: ["APPROVED", "PROCESSING"],
};

const ACTION_TO_STATUS: Record<WithdrawalReviewInput["action"], WithdrawalStatus> = {
  APPROVE: "APPROVED",
  PROCESS: "PROCESSING",
  COMPLETE: "COMPLETED",
  REJECT: "REJECTED",
  FAIL: "FAILED",
};

const EDITABLE_STATUSES: WithdrawalStatus[] = ["REQUESTED", "UNDER_REVIEW"];
const DELETABLE_OPEN: WithdrawalStatus[] = ["REQUESTED", "UNDER_REVIEW"];
const DELETABLE_CLOSED: WithdrawalStatus[] = ["REJECTED", "FAILED"];

export type AdminWithdrawalView = WithdrawalView & {
  user?: { id: string; fullName: string; email: string | null } | null;
  reviewerNote?: string | null;
  reference?: string;
};

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  private toView(w: Withdrawal): WithdrawalView {
    return {
      id: w.id,
      amount: toMoney(w.amount, w.currency),
      method: w.method,
      destinationMasked: w.destinationMasked,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
      processedAt: w.processedAt ? w.processedAt.toISOString() : null,
    };
  }

  private toAdminView(
    w: Withdrawal & {
      user?: { id: string; fullName: string; email: string | null } | null;
    },
  ): AdminWithdrawalView {
    return {
      ...this.toView(w),
      user: w.user ?? null,
      reviewerNote: w.reviewerNote ?? null,
      reference: w.reference,
    };
  }

  /** Mask a destination, revealing only the last 3 characters. */
  private mask(destination: string): string {
    const visible = destination.slice(-3);
    const hiddenLength = Math.max(0, destination.length - visible.length);
    return "*".repeat(hiddenLength) + visible;
  }

  private async createHold(
    userId: string,
    input: WithdrawalRequestInput,
    meta?: { ip?: string; actorId?: string; skipKycCheck?: boolean; skip2faCheck?: boolean },
  ): Promise<AdminWithdrawalView> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    if (!meta?.skipKycCheck && user.kycStatus !== "APPROVED") {
      throw new ForbiddenException("KYC verification required");
    }
    if (!meta?.skip2faCheck) {
      this.auth.assertTotp(user, input.totpCode);
    }

    if (input.idempotencyKey) {
      const existing = await this.prisma.withdrawal.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      });
      if (existing) return this.toAdminView(existing);
    }

    const amount = BigInt(input.amount);
    const reference = `WDL-${randomUUID()}`;
    const actorId = meta?.actorId ?? userId;

    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const balance = await this.ledger.getBalance(userId, tx);
      if (balance < amount) {
        throw new BadRequestException("Insufficient wallet balance");
      }

      const created = await tx.withdrawal.create({
        data: {
          userId,
          amount,
          currency: input.currency,
          method: input.method,
          destinationMasked: this.mask(input.destination),
          status: "REQUESTED",
          reference,
          idempotencyKey: input.idempotencyKey ?? null,
        },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      });

      await this.ledger.post(tx, {
        userId,
        direction: "DEBIT",
        type: "WITHDRAWAL",
        amount,
        currency: input.currency,
        reference,
        withdrawalId: created.id,
      });

      return created;
    });

    await this.audit.log({
      actorId,
      action: "withdrawal.requested",
      entityType: "Withdrawal",
      entityId: withdrawal.id,
      ip: meta?.ip ?? null,
      metadata: {
        amount: Number(amount),
        currency: input.currency,
        method: input.method,
        onBehalfOf: userId !== actorId ? userId : undefined,
      },
    });

    return this.toAdminView(withdrawal);
  }

  /**
   * Create a withdrawal request. Requires APPROVED KYC. Holds the funds by
   * posting a DEBIT/WITHDRAWAL ledger entry atomically with the request row.
   */
  async request(
    userId: string,
    input: WithdrawalRequestInput,
    meta?: { ip?: string },
  ): Promise<WithdrawalView> {
    return this.createHold(userId, input, { ip: meta?.ip, actorId: userId });
  }

  /** Admin: create a withdrawal for a selected user (ledger hold). */
  async adminCreate(
    actorId: string,
    input: AdminCreateWithdrawalInput,
    meta?: { ip?: string },
  ): Promise<AdminWithdrawalView> {
    const { userId, skipKycCheck, skip2faCheck, ...rest } = input;
    return this.createHold(userId, rest, {
      ip: meta?.ip,
      actorId,
      skipKycCheck: skipKycCheck ?? true,
      skip2faCheck: skip2faCheck ?? true,
    });
  }

  async listMine(userId: string): Promise<WithdrawalView[]> {
    const items = await this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return items.map((w) => this.toView(w));
  }

  /** Admin: paginated list, optionally filtered by status. */
  async listAll(status: WithdrawalStatus | undefined, page: number, pageSize: number) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, fullName: true, email: true } } },
      }),
      this.prisma.withdrawal.count({ where }),
    ]);
    return {
      data: items.map((w) => this.toAdminView(w)),
      meta: { page, pageSize, total },
    };
  }

  /** Admin: update destination/method/note while still in the review queue. */
  async adminUpdate(
    id: string,
    actorId: string,
    input: AdminUpdateWithdrawalInput,
    meta?: { ip?: string },
  ): Promise<AdminWithdrawalView> {
    const existing = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (!existing) throw new NotFoundException("Withdrawal not found");
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new BadRequestException(
        `Cannot edit a withdrawal in status ${existing.status}. Only open requests can be updated.`,
      );
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        ...(input.method !== undefined ? { method: input.method } : {}),
        ...(input.destination !== undefined
          ? { destinationMasked: this.mask(input.destination) }
          : {}),
        ...(input.reviewerNote !== undefined ? { reviewerNote: input.reviewerNote } : {}),
      },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });

    await this.audit.log({
      actorId,
      action: "withdrawal.updated",
      entityType: "Withdrawal",
      entityId: id,
      ip: meta?.ip ?? null,
      metadata: { fields: Object.keys(input) },
    });

    return this.toAdminView(updated);
  }

  /**
   * Admin delete:
   * - Open (REQUESTED/UNDER_REVIEW): reverse ledger hold, then hard-delete.
   * - Closed (REJECTED/FAILED): hard-delete only (hold already reversed).
   * - COMPLETED/APPROVED/PROCESSING: blocked (use review flow).
   */
  async adminDelete(id: string, actorId: string, meta?: { ip?: string }) {
    const existing = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Withdrawal not found");

    if (DELETABLE_OPEN.includes(existing.status)) {
      await this.prisma.$transaction(async (tx) => {
        await this.ledger.post(tx, {
          userId: existing.userId,
          direction: "CREDIT",
          type: "WITHDRAWAL_REVERSAL",
          amount: existing.amount,
          currency: existing.currency,
          reference: existing.reference,
          withdrawalId: existing.id,
        });
        await tx.withdrawal.delete({ where: { id } });
      });
    } else if (DELETABLE_CLOSED.includes(existing.status)) {
      await this.prisma.withdrawal.delete({ where: { id } });
    } else {
      throw new BadRequestException(
        `Cannot delete a withdrawal in status ${existing.status}. Reject/fail it first, or complete the payout flow.`,
      );
    }

    await this.audit.log({
      actorId,
      action: "withdrawal.deleted",
      entityType: "Withdrawal",
      entityId: id,
      ip: meta?.ip ?? null,
      metadata: {
        status: existing.status,
        amount: Number(existing.amount),
        currency: existing.currency,
      },
    });

    return { id, deleted: true as const };
  }

  /**
   * Admin: advance a withdrawal through its lifecycle. REJECT/FAIL reverse the
   * held funds with a compensating CREDIT/WITHDRAWAL_REVERSAL entry. Ledger rows
   * are never mutated; corrections are new entries.
   */
  async review(
    id: string,
    reviewerId: string,
    input: WithdrawalReviewInput,
    meta?: { ip?: string },
  ): Promise<AdminWithdrawalView> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (!withdrawal) throw new NotFoundException("Withdrawal not found");

    const allowedFrom = ALLOWED_FROM[input.action];
    if (!allowedFrom.includes(withdrawal.status)) {
      throw new BadRequestException(
        `Cannot ${input.action} a withdrawal in status ${withdrawal.status}`,
      );
    }

    const nextStatus = ACTION_TO_STATUS[input.action];
    const reversesHold = input.action === "REJECT" || input.action === "FAIL";
    const isTerminal =
      nextStatus === "COMPLETED" || nextStatus === "REJECTED" || nextStatus === "FAILED";

    const updated = await this.prisma.$transaction(async (tx) => {
      if (reversesHold) {
        await this.ledger.post(tx, {
          userId: withdrawal.userId,
          direction: "CREDIT",
          type: "WITHDRAWAL_REVERSAL",
          amount: withdrawal.amount,
          currency: withdrawal.currency,
          reference: withdrawal.reference,
          withdrawalId: withdrawal.id,
        });
      }

      return tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: nextStatus,
          reviewedById: reviewerId,
          reviewerNote: input.reviewerNote ?? withdrawal.reviewerNote,
          processedAt: isTerminal ? withdrawal.processedAt ?? new Date() : withdrawal.processedAt,
        },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      });
    });

    await this.audit.log({
      actorId: reviewerId,
      action: `withdrawal.${nextStatus.toLowerCase()}`,
      entityType: "Withdrawal",
      entityId: withdrawal.id,
      ip: meta?.ip ?? null,
      metadata: {
        action: input.action,
        from: withdrawal.status,
        to: nextStatus,
        ...(input.reviewerNote ? { reviewerNote: input.reviewerNote } : {}),
      },
    });

    return this.toAdminView(updated);
  }
}
