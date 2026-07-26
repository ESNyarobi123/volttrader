import { Injectable, NotFoundException } from "@nestjs/common";
import type { Currency, InvestmentPlan, ProjectionLabel, RiskCategory } from "@prisma/client";
import type {
  InvestmentPlanActivateInput,
  InvestmentPlanUpdateInput,
  InvestmentPlanUpsertInput,
} from "@volt/validation";
import { pickDefined } from "../../common/pick-defined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

export interface InvestmentPlanView {
  id: string;
  name: string;
  subtitle: string;
  minAmount: { amount: number; currency: Currency };
  durationDays: number;
  projectionLabel: ProjectionLabel;
  projectionMultiplier: number;
  projectedTotal: { amount: number; currency: Currency };
  projectionHighlight: string;
  riskCategory: RiskCategory;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  featured: boolean;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentPlanCatalogItem extends InvestmentPlanView {
  opportunityId: string | null;
  opportunitySlug: string | null;
}

export interface InvestmentPlanMembershipView {
  plans: InvestmentPlanCatalogItem[];
}

@Injectable()
export class InvestmentPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private multiplierOf(plan: InvestmentPlan): number {
    return Number(plan.projectionMultiplier);
  }

  private toView(plan: InvestmentPlan): InvestmentPlanView {
    const multiplier = this.multiplierOf(plan);
    const minAmount = Number(plan.minAmount);
    const projectedAmount = Math.round(minAmount * multiplier);
    return {
      id: plan.id,
      name: plan.name,
      subtitle: plan.subtitle,
      minAmount: {
        amount: minAmount,
        currency: plan.currency,
      },
      durationDays: plan.durationDays,
      projectionLabel: plan.projectionLabel,
      projectionMultiplier: multiplier,
      projectedTotal: {
        amount: projectedAmount,
        currency: plan.currency,
      },
      projectionHighlight: plan.projectionHighlight,
      riskCategory: plan.riskCategory,
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

  /** Keep the investable opportunity package in sync with the landing plan. */
  private async syncCanonicalOpportunity(plan: InvestmentPlan) {
    const slug = `plan-${plan.name.toLowerCase().replace(/\s+/g, "-")}`;
    const riskDisclosure =
      "Capital is at risk. Projected outcomes are targets only and are not guaranteed. Past or modelled performance does not predict future results.";
    const terms =
      "By investing you accept the risk disclosure, platform terms, and that returns (if any) are settled after the management cycle ends.";
    const data = {
      name: plan.name,
      summary: plan.subtitle,
      description: `${plan.name} management plan — ${plan.subtitle}. Cycle: ${plan.durationDays} days.`,
      currency: plan.currency,
      minAmount: plan.minAmount,
      maxAmount: null as bigint | null,
      durationDays: plan.durationDays,
      projectionMultiplier: plan.projectionMultiplier,
      projectionLabel: plan.projectionLabel,
      riskCategory: plan.riskCategory,
      riskDisclosure,
      terms,
      status: "OPEN" as const,
      investmentPlanId: plan.id,
    };
    const existing = await this.prisma.opportunity.findUnique({ where: { slug } });
    if (existing) {
      await this.prisma.opportunity.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.opportunity.create({ data: { slug, ...data } });
    }
  }

  async listPublished(): Promise<InvestmentPlanView[]> {
    const plans = await this.prisma.investmentPlan.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return plans.map((p) => this.toView(p));
  }

  async listAdmin(): Promise<InvestmentPlanView[]> {
    const plans = await this.prisma.investmentPlan.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return plans.map((p) => this.toView(p));
  }

  async create(input: InvestmentPlanUpsertInput, actorId: string): Promise<InvestmentPlanView> {
    if (input.featured) {
      await this.prisma.investmentPlan.updateMany({ data: { featured: false } });
    }

    const plan = await this.prisma.investmentPlan.create({
      data: {
        name: input.name,
        subtitle: input.subtitle,
        minAmount: BigInt(input.minAmount.amount),
        currency: input.minAmount.currency,
        durationDays: input.durationDays,
        projectionLabel: input.projectionLabel,
        projectionMultiplier: input.projectionMultiplier,
        projectionHighlight: input.projectionHighlight ?? "",
        riskCategory: input.riskCategory,
        features: input.features,
        ctaLabel: input.ctaLabel,
        ctaHref: input.ctaHref,
        featured: input.featured,
        sortOrder: input.sortOrder,
        published: input.published,
      },
    });

    await this.syncCanonicalOpportunity(plan);

    await this.audit.log({
      actorId,
      action: "investment_plan.created",
      entityType: "InvestmentPlan",
      entityId: plan.id,
      metadata: { name: plan.name },
    });

    return this.toView(plan);
  }

  async update(
    id: string,
    input: InvestmentPlanUpdateInput,
    actorId: string,
  ): Promise<InvestmentPlanView> {
    const existing = await this.prisma.investmentPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Investment plan not found");

    if (input.featured === true) {
      await this.prisma.investmentPlan.updateMany({
        where: { id: { not: id } },
        data: { featured: false },
      });
    }

    const plan = await this.prisma.investmentPlan.update({
      where: { id },
      data: {
        ...pickDefined(input, [
          "name",
          "subtitle",
          "durationDays",
          "projectionLabel",
          "projectionMultiplier",
          "projectionHighlight",
          "riskCategory",
          "features",
          "ctaLabel",
          "ctaHref",
          "featured",
          "sortOrder",
          "published",
        ]),
        ...(input.minAmount !== undefined
          ? {
              minAmount: BigInt(input.minAmount.amount),
              currency: input.minAmount.currency,
            }
          : {}),
      },
    });

    await this.syncCanonicalOpportunity(plan);

    await this.audit.log({
      actorId,
      action: "investment_plan.updated",
      entityType: "InvestmentPlan",
      entityId: plan.id,
      metadata: { name: plan.name },
    });

    return this.toView(plan);
  }

  async delete(id: string, actorId: string): Promise<{ ok: true }> {
    const existing = await this.prisma.investmentPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Investment plan not found");

    await this.prisma.investmentPlan.delete({ where: { id } });

    await this.audit.log({
      actorId,
      action: "investment_plan.deleted",
      entityType: "InvestmentPlan",
      entityId: id,
      metadata: { name: existing.name },
    });

    return { ok: true };
  }

  /**
   * Member catalog: each published plan maps to one OPEN opportunity to fund.
   * Prefer canonical slug `plan-{name}` so landing cards = investable packages.
   */
  async membershipFor(_userId: string): Promise<InvestmentPlanMembershipView> {
    const plans = await this.prisma.investmentPlan.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        opportunities: {
          where: { status: "OPEN" },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return {
      plans: plans.map((plan) => {
        const canonicalSlug = `plan-${plan.name.toLowerCase().replace(/\s+/g, "-")}`;
        const opportunity =
          plan.opportunities.find((o) => o.slug === canonicalSlug) ??
          plan.opportunities[0] ??
          null;
        return {
          ...this.toView(plan),
          opportunityId: opportunity?.id ?? null,
          opportunitySlug: opportunity?.slug ?? null,
        };
      }),
    };
  }

  /**
   * Soft bookmark of interest in a plan (optional). Capital is paid via POST /investments.
   * Multiple ACTIVE plan interests are allowed — not an exclusive tier.
   */
  async activate(
    userId: string,
    input: InvestmentPlanActivateInput,
    ip?: string | null,
  ): Promise<{ plan: InvestmentPlanView }> {
    const plan = await this.prisma.investmentPlan.findFirst({
      where: { id: input.investmentPlanId, published: true },
    });
    if (!plan) throw new NotFoundException("Investment plan not found");

    const existing = await this.prisma.investmentPlanSubscription.findFirst({
      where: { userId, investmentPlanId: plan.id, status: "ACTIVE" },
    });
    if (!existing) {
      await this.prisma.investmentPlanSubscription.create({
        data: { userId, investmentPlanId: plan.id, status: "ACTIVE" },
      });
    }

    await this.audit.log({
      actorId: userId,
      action: "investment_plan.activated",
      entityType: "InvestmentPlan",
      entityId: plan.id,
      ip,
      metadata: { name: plan.name },
    });

    return { plan: this.toView(plan) };
  }
}
