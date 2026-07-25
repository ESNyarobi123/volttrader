import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Role } from "@volt/config";
import { kycSubmissionSchema, type KycSubmissionInput } from "@volt/validation";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { KycService } from "./kyc.service";
import {
  kycListQuerySchema,
  reviewKycSchema,
  type KycListQuery,
  type ReviewKycInput,
} from "./dto/review-kyc.dto";

@Controller("kyc")
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post()
  @Auth()
  submit(
    @CurrentUser("id") userId: string,
    @Body(new ZodValidationPipe(kycSubmissionSchema)) dto: KycSubmissionInput,
  ) {
    return this.kyc.submit(userId, dto);
  }

  @Get("me")
  @Auth()
  me(@CurrentUser("id") userId: string) {
    return this.kyc.getMine(userId);
  }

  @Get()
  @Auth(Role.COMPLIANCE_OFFICER, Role.SUPER_ADMIN)
  async list(@Query(new ZodValidationPipe(kycListQuerySchema)) query: KycListQuery) {
    const { items, total } = await this.kyc.list(query.status, query.page, query.pageSize);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Get(":id")
  @Auth(Role.COMPLIANCE_OFFICER, Role.SUPER_ADMIN)
  getById(@Param("id") id: string) {
    return this.kyc.getById(id);
  }

  @Patch(":id/review")
  @Auth(Role.COMPLIANCE_OFFICER, Role.SUPER_ADMIN)
  review(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reviewKycSchema)) dto: ReviewKycInput,
    @CurrentUser("id") reviewerId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.kyc.review(id, dto.status, dto.reviewerNote, reviewerId, req.ip);
  }
}
