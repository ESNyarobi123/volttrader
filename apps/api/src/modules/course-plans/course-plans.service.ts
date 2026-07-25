import { Injectable, NotFoundException } from "@nestjs/common";
import type { CoursePlan, Currency } from "@prisma/client";
import type { CoursePlanUpdateInput, CoursePlanUpsertInput } from "@volt/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

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

@Injectable()
export class CoursePlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
        ...(input.price !== undefined
          ? {
              priceAmount: BigInt(input.price.amount),
              priceCurrency: input.price.currency,
            }
          : {}),
        ...(input.billingPeriod !== undefined ? { billingPeriod: input.billingPeriod } : {}),
        ...(input.features !== undefined ? { features: input.features } : {}),
        ...(input.ctaLabel !== undefined ? { ctaLabel: input.ctaLabel } : {}),
        ...(input.ctaHref !== undefined ? { ctaHref: input.ctaHref } : {}),
        ...(input.featured !== undefined ? { featured: input.featured } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.published !== undefined ? { published: input.published } : {}),
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
}
