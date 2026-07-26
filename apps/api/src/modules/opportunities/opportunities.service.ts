import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Opportunity, OpportunityStatus } from "@prisma/client";
import type { OpportunityUpsertInput } from "@volt/validation";
import type { OpportunityDetail, OpportunitySummary } from "@volt/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { toOpportunitySummary } from "./opportunity.mapper";

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toDetail(o: Opportunity): OpportunityDetail {
    return {
      ...toOpportunitySummary(o),
      description: o.description,
      riskDisclosure: o.riskDisclosure,
      terms: o.terms,
      startDate: o.startDate ? o.startDate.toISOString() : null,
      endDate: o.endDate ? o.endDate.toISOString() : null,
    };
  }

  /** Public list — OPEN opportunities only. */
  async listOpen(): Promise<OpportunitySummary[]> {
    const items = await this.prisma.opportunity.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
    });
    return items.map((o) => toOpportunitySummary(o));
  }

  /** Public detail (incl. risk disclosure + terms). DRAFT opportunities are never public. */
  async getBySlug(slug: string): Promise<OpportunityDetail> {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { slug, status: { not: "DRAFT" } },
    });
    if (!opportunity) throw new NotFoundException("Opportunity not found");
    return this.toDetail(opportunity);
  }

  /** Admin — every opportunity regardless of status. */
  async listAll(): Promise<OpportunityDetail[]> {
    const items = await this.prisma.opportunity.findMany({
      orderBy: { createdAt: "desc" },
    });
    return items.map((o) => this.toDetail(o));
  }

  async create(input: OpportunityUpsertInput, actorId: string): Promise<OpportunityDetail> {
    const existing = await this.prisma.opportunity.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ConflictException("An opportunity with this slug already exists");

    const opportunity = await this.prisma.opportunity.create({
      data: {
        name: input.name,
        slug: input.slug,
        summary: input.summary,
        description: input.description,
        currency: input.currency,
        minAmount: BigInt(input.minAmount),
        maxAmount: input.maxAmount !== undefined ? BigInt(input.maxAmount) : null,
        durationDays: input.durationDays,
        projectionMultiplier: input.projectionMultiplier,
        projectionLabel: input.projectionLabel,
        riskCategory: input.riskCategory,
        riskDisclosure: input.riskDisclosure,
        terms: input.terms,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
      },
    });

    await this.audit.log({
      actorId,
      action: "opportunity.created",
      entityType: "Opportunity",
      entityId: opportunity.id,
      metadata: { slug: opportunity.slug },
    });

    return this.toDetail(opportunity);
  }

  async update(
    id: string,
    input: Partial<OpportunityUpsertInput> & { status?: OpportunityStatus },
    actorId: string,
  ): Promise<OpportunityDetail> {
    const existing = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Opportunity not found");

    if (input.slug && input.slug !== existing.slug) {
      const clash = await this.prisma.opportunity.findUnique({ where: { slug: input.slug } });
      if (clash) throw new ConflictException("An opportunity with this slug already exists");
    }

    const data: Prisma.OpportunityUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.summary !== undefined) data.summary = input.summary;
    if (input.description !== undefined) data.description = input.description;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.minAmount !== undefined) data.minAmount = BigInt(input.minAmount);
    if (input.maxAmount !== undefined) data.maxAmount = BigInt(input.maxAmount);
    if (input.durationDays !== undefined) data.durationDays = input.durationDays;
    if (input.projectionMultiplier !== undefined) data.projectionMultiplier = input.projectionMultiplier;
    if (input.projectionLabel !== undefined) data.projectionLabel = input.projectionLabel;
    if (input.riskCategory !== undefined) data.riskCategory = input.riskCategory;
    if (input.riskDisclosure !== undefined) data.riskDisclosure = input.riskDisclosure;
    if (input.terms !== undefined) data.terms = input.terms;
    if (input.startDate !== undefined) data.startDate = input.startDate;
    if (input.endDate !== undefined) data.endDate = input.endDate;
    if (input.status !== undefined) data.status = input.status;

    const opportunity = await this.prisma.opportunity.update({ where: { id }, data });

    await this.audit.log({
      actorId,
      action: "opportunity.updated",
      entityType: "Opportunity",
      entityId: opportunity.id,
      metadata: { fields: Object.keys(data) },
    });

    return this.toDetail(opportunity);
  }

  /**
   * Hard-delete an opportunity. Blocked when investments exist — close/suspend
   * instead so portfolio history stays intact.
   */
  async delete(id: string, actorId: string) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id },
      include: { _count: { select: { investments: true } } },
    });
    if (!opportunity) throw new NotFoundException("Opportunity not found");

    if (opportunity._count.investments > 0) {
      throw new BadRequestException(
        `Cannot delete "${opportunity.name}" — ${opportunity._count.investments} investment(s) exist. Close or suspend it instead.`,
      );
    }

    await this.prisma.opportunity.delete({ where: { id } });

    await this.audit.log({
      actorId,
      action: "opportunity.deleted",
      entityType: "Opportunity",
      entityId: id,
      metadata: { slug: opportunity.slug },
    });

    return { id, deleted: true };
  }
}
