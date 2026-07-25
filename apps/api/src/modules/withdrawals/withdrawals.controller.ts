import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Role } from "@volt/config";
import {
  adminCreateWithdrawalSchema,
  adminUpdateWithdrawalSchema,
  withdrawalRequestSchema,
  type AdminCreateWithdrawalInput,
  type AdminUpdateWithdrawalInput,
  type WithdrawalRequestInput,
} from "@volt/validation";
import type { WithdrawalStatus } from "@prisma/client";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { WithdrawalsService } from "./withdrawals.service";
import {
  withdrawalReviewSchema,
  type WithdrawalReviewInput,
} from "./dto/withdrawal-review.schema";

const FINANCE_ROLES = [Role.FINANCE_ADMIN, Role.SUPER_ADMIN] as const;

@Controller("withdrawals")
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post()
  @Auth()
  request(
    @Body(new ZodValidationPipe(withdrawalRequestSchema)) dto: WithdrawalRequestInput,
    @CurrentUser("id") userId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.withdrawals.request(userId, dto, { ip: req.ip });
  }

  /** Admin — create a payout request on behalf of a user. */
  @Post("admin")
  @Auth(...FINANCE_ROLES)
  adminCreate(
    @Body(new ZodValidationPipe(adminCreateWithdrawalSchema)) dto: AdminCreateWithdrawalInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.withdrawals.adminCreate(actorId, dto, { ip: req.ip });
  }

  @Get("me")
  @Auth()
  listMine(@CurrentUser("id") userId: string) {
    return this.withdrawals.listMine(userId);
  }

  @Get()
  @Auth(...FINANCE_ROLES)
  listAll(
    @Query("status") status?: WithdrawalStatus,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    return this.withdrawals.listAll(status, pageNum, size);
  }

  @Patch(":id/review")
  @Auth(...FINANCE_ROLES)
  review(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(withdrawalReviewSchema)) dto: WithdrawalReviewInput,
    @CurrentUser("id") reviewerId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.withdrawals.review(id, reviewerId, dto, { ip: req.ip });
  }

  @Patch(":id")
  @Auth(...FINANCE_ROLES)
  adminUpdate(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(adminUpdateWithdrawalSchema)) dto: AdminUpdateWithdrawalInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.withdrawals.adminUpdate(id, actorId, dto, { ip: req.ip });
  }

  @Delete(":id")
  @Auth(...FINANCE_ROLES)
  adminDelete(
    @Param("id") id: string,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.withdrawals.adminDelete(id, actorId, { ip: req.ip });
  }
}
