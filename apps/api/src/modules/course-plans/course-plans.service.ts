import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { Prisma, type CoursePlan, type Currency } from "@prisma/client";
import type {
  CoursePlanSubscribeInput,
  CoursePlanUpdateInput,
  CoursePlanUpsertInput,
} from "@volt/validation";
import type { CourseSummary } from "@volt/types";
import { pickDefined } from "../../common/pick-defined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LedgerService } from "../ledger/ledger.service";
import { GatewayRegistry } from "../payments/gateways/gateway.registry";
import { PlanAccessService } from "../plan-access/plan-access.service";
import { toCourseSummary } from "../courses/course.mapper";

export interface CoursePlanView {
  id: string;
  name: string;
  subtitle: string;
  price: { amount: number; currency: Currency };
  billingPeriod: "month" | "year" | "once";
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  featured: boolean;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoursePlanMembershipView {
  plan: CoursePlanView | null;
  plans: CoursePlanView[];
  courses: Array<CourseSummary & { locked: boolean; enrolled: boolean }>;
}

@Injectable()
export class CoursePlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly gateways: GatewayRegistry,
    private readonly planAccess: PlanAccessService,
  ) {}

  private toView(plan: CoursePlan): CoursePlanView {
    return {
      id: plan.id,
      name: plan.name,
      subtitle: plan.subtitle,
      price: {
        amount: Number(plan.priceAmount),
        currency: plan.priceCurrency,
      },
      billingPeriod: plan.billingPeriod as CoursePlanView["billingPeriod"],
      features: plan.features,
      ctaLabel: plan.ctaLabel,
      ctaHref: plan.ctaHref,
      featured: plan.featured,
      sortOrder: plan.sortOrder,
      published: plan.published,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  async listPublished(): Promise<CoursePlanView[]> {
    const plans = await this.prisma.coursePlan.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return plans.map((p) => this.toView(p));
  }

  async listAdmin(): Promise<CoursePlanView[]> {
    const plans = await this.prisma.coursePlan.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return plans.map((p) => this.toView(p));
  }

  async create(input: CoursePlanUpsertInput, actorId: string): Promise<CoursePlanView> {
    if (input.featured) {
      await this.prisma.coursePlan.updateMany({ data: { featured: false } });
    }

    const plan = await this.prisma.coursePlan.create({
      data: {
        name: input.name,
        subtitle: input.subtitle,
        priceAmount: BigInt(input.price.amount),
        priceCurrency: input.price.currency,
        billingPeriod: input.billingPeriod,
        features: input.features,
        ctaLabel: input.ctaLabel,
        ctaHref: input.ctaHref,
        featured: input.featured,
        sortOrder: input.sortOrder,
        published: input.published,
      },
    });

    await this.audit.log({
      actorId,
      action: "course_plan.created",
      entityType: "CoursePlan",
      entityId: plan.id,
      metadata: { name: plan.name },
    });

    return this.toView(plan);
  }

  async update(
    id: string,
    input: CoursePlanUpdateInput,
    actorId: string,
  ): Promise<CoursePlanView> {
    const existing = await this.prisma.coursePlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Course plan not found");

    if (input.featured === true) {
      await this.prisma.coursePlan.updateMany({
        where: { id: { not: id } },
        data: { featured: false },
      });
    }

    const plan = await this.prisma.coursePlan.update({
      where: { id },
      data: {
        ...pickDefined(input, [
          "name",
          "subtitle",
          "billingPeriod",
          "features",
          "ctaLabel",
          "ctaHref",
          "featured",
          "sortOrder",
          "published",
        ]),
        ...(input.price !== undefined
          ? {
              priceAmount: BigInt(input.price.amount),
              priceCurrency: input.price.currency,
            }
          : {}),
      },
    });

    await this.audit.log({
      actorId,
      action: "course_plan.updated",
      entityType: "CoursePlan",
      entityId: plan.id,
      metadata: { name: plan.name },
    });

    return this.toView(plan);
  }

  async delete(id: string, actorId: string): Promise<{ ok: true }> {
    const existing = await this.prisma.coursePlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Course plan not found");

    await this.prisma.coursePlan.delete({ where: { id } });

    await this.audit.log({
      actorId,
      action: "course_plan.deleted",
      entityType: "CoursePlan",
      entityId: id,
      metadata: { name: existing.name },
    });

    return { ok: true };
  }

  /** Dashboard Learn — current membership + all published plans + gated courses. */
  async membershipFor(userId: string): Promise<CoursePlanMembershipView> {
    const plans = await this.listPublished();
    const active = await this.planAccess.getActiveCoursePlan(userId);
    const courses = await this.prisma.course.findMany({
      where: { status: "PUBLISHED", coursePlanId: { not: null } },
      orderBy: [{ coursePlan: { sortOrder: "asc" } }, { createdAt: "desc" }],
      include: {
        _count: { select: { lessons: true } },
        coursePlan: true,
        enrollments: { where: { userId }, take: 1 },
      },
    });

    const activeSort = active?.sortOrder ?? -1;
    return {
      plan: active ? this.toView(active) : null,
      plans,
      courses: courses.map((c) => {
        const planSort = c.coursePlan?.sortOrder ?? 999;
        const locked = activeSort < planSort;
        return {
          ...toCourseSummary(c),
          locked,
          enrolled: c.enrollments.length > 0 && c.enrollments[0]!.status !== "REVOKED",
        };
      }),
    };
  }

  /**
   * Activate / upgrade Forex plan. Free plans activate immediately.
   * Paid plans debit wallet (or open gateway intent).
   */
  async subscribe(
    userId: string,
    input: CoursePlanSubscribeInput,
    ip?: string | null,
  ): Promise<{
    plan: CoursePlanView;
    payment: { id: string; status: string; amount: number; currency: Currency } | null;
    checkoutUrl: string | null;
    enrolledCourseCount: number;
  }> {
    const plan = await this.prisma.coursePlan.findFirst({
      where: { id: input.coursePlanId, published: true },
    });
    if (!plan) throw new NotFoundException("Course plan not found");

    const current = await this.planAccess.getActiveCoursePlan(userId);
    if (current && current.id === plan.id) {
      throw new ConflictException("You already have this plan");
    }
    if (current && current.sortOrder > plan.sortOrder) {
      throw new BadRequestException("You already have a higher plan. Contact support to downgrade.");
    }

    // Free tier — no payment.
    if (plan.priceAmount === 0n) {
      const enrolledCourseCount = await this.activateMembership(userId, plan.id, null);
      await this.audit.log({
        actorId: userId,
        action: "course_plan.activated",
        entityType: "CoursePlan",
        entityId: plan.id,
        ip,
        metadata: { free: true },
      });
      return {
        plan: this.toView(plan),
        payment: null,
        checkoutUrl: null,
        enrolledCourseCount,
      };
    }

    if (input.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return {
          plan: this.toView(plan),
          payment: {
            id: existing.id,
            status: existing.status,
            amount: Number(existing.amount),
            currency: existing.currency,
          },
          checkoutUrl: existing.checkoutUrl ?? null,
          enrolledCourseCount: 0,
        };
      }
    }

    const reference = `CPLAN-${input.idempotencyKey ?? randomUUID()}`;
    const amount = plan.priceAmount;
    const currency = plan.priceCurrency;

    if (input.source === "WALLET") {
      await this.ledger.ensureWallet(userId, currency);
      const enrolledCourseCount = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            userId,
            type: "COURSE_PLAN_PURCHASE",
            status: "PAID",
            amount,
            currency,
            gateway: "wallet",
            reference,
            idempotencyKey: input.idempotencyKey ?? null,
            coursePlanId: plan.id,
            paidAt: new Date(),
          },
        });
        await this.ledger.post(tx, {
          userId,
          direction: "DEBIT",
          type: "COURSE_PLAN_PURCHASE",
          amount,
          currency,
          reference,
          paymentId: payment.id,
        });
        return this.activateMembershipTx(tx, userId, plan.id, payment.id);
      });

      await this.audit.log({
        actorId: userId,
        action: "course_plan.purchased",
        entityType: "CoursePlan",
        entityId: plan.id,
        ip,
        metadata: { source: "WALLET", amount: Number(amount) },
      });

      return {
        plan: this.toView(plan),
        payment: {
          id: reference,
          status: "PAID",
          amount: Number(amount),
          currency,
        },
        checkoutUrl: null,
        enrolledCourseCount,
      };
    }

    // Gateway checkout — membership activates on verified webhook.
    const gateway = this.gateways.resolve(input.gateway);
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        type: "COURSE_PLAN_PURCHASE",
        status: "INITIATED",
        amount,
        currency,
        gateway: gateway.id,
        reference,
        idempotencyKey: input.idempotencyKey ?? null,
        coursePlanId: plan.id,
      },
    });
    const intent = await gateway.createIntent({
      userId,
      amount,
      currency,
      reference,
      type: "COURSE_PLAN_PURCHASE",
      metadata: { coursePlanId: plan.id },
    });
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: intent.providerRef,
        checkoutUrl: intent.checkoutUrl,
        status: "PENDING",
      },
    });

    return {
      plan: this.toView(plan),
      payment: {
        id: updated.id,
        status: updated.status,
        amount: Number(updated.amount),
        currency: updated.currency,
      },
      checkoutUrl: updated.checkoutUrl ?? null,
      enrolledCourseCount: 0,
    };
  }

  async activateMembership(
    userId: string,
    coursePlanId: string,
    paymentId: string | null,
  ): Promise<number> {
    return this.prisma.$transaction((tx) =>
      this.activateMembershipTx(tx, userId, coursePlanId, paymentId),
    );
  }

  private async activateMembershipTx(
    tx: Prisma.TransactionClient,
    userId: string,
    coursePlanId: string,
    paymentId: string | null,
  ): Promise<number> {
    await tx.coursePlanSubscription.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "CANCELLED", endsAt: new Date() },
    });
    await tx.coursePlanSubscription.create({
      data: {
        userId,
        coursePlanId,
        status: "ACTIVE",
        paymentId,
      },
    });

    const plan = await tx.coursePlan.findUniqueOrThrow({ where: { id: coursePlanId } });
    const courses = await tx.course.findMany({
      where: {
        status: "PUBLISHED",
        coursePlan: { sortOrder: { lte: plan.sortOrder } },
      },
      select: { id: true },
    });

    let enrolled = 0;
    for (const course of courses) {
      const existing = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
      });
      if (!existing) {
        await tx.enrollment.create({
          data: { userId, courseId: course.id, paymentId: paymentId ?? undefined },
        });
        enrolled += 1;
      } else if (existing.status === "REVOKED") {
        await tx.enrollment.update({
          where: { id: existing.id },
          data: { status: "ACTIVE" },
        });
        enrolled += 1;
      }
    }
    return enrolled;
  }
}
