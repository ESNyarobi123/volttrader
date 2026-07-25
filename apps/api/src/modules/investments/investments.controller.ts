import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { Role } from "@volt/config";
import { createInvestmentSchema, type CreateInvestmentInput } from "@volt/validation";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { InvestmentsService } from "./investments.service";

/** Settlement amount is a real credited value in minor units (0 = total loss). */
const settleSchema = z.object({ settledValue: z.number().int().nonnegative() });
type SettleInput = z.infer<typeof settleSchema>;

const FINANCE_ROLES = [Role.FINANCE_ADMIN, Role.SUPER_ADMIN] as const;

@Controller("investments")
export class InvestmentsController {
  constructor(private readonly investments: InvestmentsService) {}

  /** Create an investment (WALLET debits now; PAYMENT returns a checkout). */
  @Post()
  @Auth()
  create(
    @Body(new ZodValidationPipe(createInvestmentSchema)) dto: CreateInvestmentInput,
    @CurrentUser("id") userId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.investments.create(userId, dto, req.ip);
  }

  @Get("me")
  @Auth()
  mine(@CurrentUser("id") userId: string) {
    return this.investments.listMine(userId);
  }

  @Get("portfolio")
  @Auth()
  portfolio(@CurrentUser("id") userId: string) {
    return this.investments.portfolio(userId);
  }

  // Admin route before ":id" so it isn't swallowed by the param route.
  @Get("admin/all")
  @Auth(...FINANCE_ROLES)
  listAll(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    const pageNum = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    return this.investments.listAll(pageNum, size);
  }

  @Get(":id")
  @Auth()
  getOne(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.investments.getMine(userId, id);
  }

  @Patch(":id/settle")
  @Auth(...FINANCE_ROLES)
  settle(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(settleSchema)) dto: SettleInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.investments.settle(id, dto.settledValue, actorId, req.ip);
  }
}
