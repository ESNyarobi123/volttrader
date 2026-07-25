import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { Role } from "@volt/config";
import { couponUpsertSchema, currencySchema, type CouponUpsertInput } from "@volt/validation";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CouponsService } from "./coupons.service";

// couponUpsertSchema carries a .refine() (ZodEffects) so it has no .partial();
// the update shape is declared explicitly with every field optional + `active`.
const couponUpdateSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/)
    .optional(),
  percentOff: z.number().int().min(1).max(100).nullable().optional(),
  amountOff: z.number().int().positive().nullable().optional(),
  currency: currencySchema.nullable().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  active: z.boolean().optional(),
});
type CouponUpdateInput = z.infer<typeof couponUpdateSchema>;

const FINANCE_ROLES = [Role.FINANCE_ADMIN, Role.SUPER_ADMIN] as const;

@Controller("coupons")
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  @Auth(...FINANCE_ROLES)
  list() {
    return this.coupons.list();
  }

  @Post()
  @Auth(...FINANCE_ROLES)
  create(
    @Body(new ZodValidationPipe(couponUpsertSchema)) dto: CouponUpsertInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.coupons.create(dto, actorId);
  }

  @Patch(":id")
  @Auth(...FINANCE_ROLES)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(couponUpdateSchema)) dto: CouponUpdateInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.coupons.update(id, dto, actorId);
  }

  @Delete(":id")
  @Auth(...FINANCE_ROLES)
  remove(@Param("id") id: string, @CurrentUser("id") actorId: string) {
    return this.coupons.delete(id, actorId);
  }
}
