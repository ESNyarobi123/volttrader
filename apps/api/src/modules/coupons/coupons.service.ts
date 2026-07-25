import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Coupon } from "@prisma/client";
import type { CouponUpsertInput } from "@volt/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

export interface CouponView {
  id: string;
  code: string;
  percentOff: number | null;
  amountOff: number | null;
  currency: Coupon["currency"];
  maxRedemptions: number | null;
  redemptions: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

type CouponUpdateInput = {
  code?: string;
  percentOff?: number | null;
  amountOff?: number | null;
  currency?: Coupon["currency"] | null;
  maxRedemptions?: number | null;
  expiresAt?: Date | null;
  active?: boolean;
};

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toView(coupon: Coupon): CouponView {
    return {
      id: coupon.id,
      code: coupon.code,
      percentOff: coupon.percentOff ?? null,
      amountOff: coupon.amountOff !== null ? Number(coupon.amountOff) : null,
      currency: coupon.currency ?? null,
      maxRedemptions: coupon.maxRedemptions ?? null,
      redemptions: coupon.redemptions,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null,
      active: coupon.active,
      createdAt: coupon.createdAt.toISOString(),
    };
  }

  async list(): Promise<CouponView[]> {
    const coupons = await this.prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
    return coupons.map((c) => this.toView(c));
  }

  async create(input: CouponUpsertInput, actorId: string): Promise<CouponView> {
    const existing = await this.prisma.coupon.findUnique({ where: { code: input.code } });
    if (existing) throw new ConflictException("A coupon with this code already exists");

    const usePercent = input.percentOff !== undefined;
    const coupon = await this.prisma.coupon.create({
      data: {
        code: input.code,
        percentOff: usePercent ? (input.percentOff ?? null) : null,
        amountOff: !usePercent && input.amountOff !== undefined ? BigInt(input.amountOff) : null,
        currency: !usePercent ? (input.currency ?? null) : null,
        maxRedemptions: input.maxRedemptions ?? null,
        expiresAt: input.expiresAt ?? null,
      },
    });

    await this.audit.log({
      actorId,
      action: "coupon.created",
      entityType: "Coupon",
      entityId: coupon.id,
      metadata: { code: coupon.code },
    });

    return this.toView(coupon);
  }

  async update(id: string, input: CouponUpdateInput, actorId: string): Promise<CouponView> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Coupon not found");

    if (input.code && input.code !== existing.code) {
      const clash = await this.prisma.coupon.findUnique({ where: { code: input.code } });
      if (clash) throw new ConflictException("A coupon with this code already exists");
    }

    const data: Record<string, unknown> = {};
    if (input.code !== undefined) data.code = input.code;
    if (input.active !== undefined) data.active = input.active;
    if (input.maxRedemptions !== undefined) data.maxRedemptions = input.maxRedemptions;
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt;

    // Prefer percent when both arrive; clear the opposite discount type.
    if (input.percentOff !== undefined && input.percentOff !== null) {
      data.percentOff = input.percentOff;
      data.amountOff = null;
      data.currency = null;
    } else if (input.amountOff !== undefined && input.amountOff !== null) {
      data.amountOff = BigInt(input.amountOff);
      data.percentOff = null;
      data.currency = input.currency ?? existing.currency;
    } else {
      if (input.percentOff === null) data.percentOff = null;
      if (input.amountOff === null) data.amountOff = null;
      if (input.currency !== undefined) data.currency = input.currency;
    }

    const coupon = await this.prisma.coupon.update({ where: { id }, data });

    await this.audit.log({
      actorId,
      action: "coupon.updated",
      entityType: "Coupon",
      entityId: coupon.id,
      metadata: { fields: Object.keys(input) },
    });

    return this.toView(coupon);
  }

  async delete(id: string, actorId: string): Promise<{ id: string; deleted: true }> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Coupon not found");

    await this.prisma.coupon.delete({ where: { id } });

    await this.audit.log({
      actorId,
      action: "coupon.deleted",
      entityType: "Coupon",
      entityId: id,
      metadata: { code: existing.code },
    });

    return { id, deleted: true };
  }
}
