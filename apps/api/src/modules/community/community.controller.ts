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
  adminCreateCommunityMemberSchema,
  adminUpdateCommunityMemberSchema,
  joinCommunitySchema,
  type AdminCreateCommunityMemberInput,
  type AdminUpdateCommunityMemberInput,
  type JoinCommunityInput,
} from "@volt/validation";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CommunityService } from "./community.service";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.CONTENT_MANAGER] as const;

@Controller("community")
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Post("join")
  @Auth()
  join(
    @Body(new ZodValidationPipe(joinCommunitySchema)) dto: JoinCommunityInput,
    @CurrentUser("id") userId: string,
  ) {
    return this.community.join(userId, dto);
  }

  @Get("me")
  @Auth()
  me(@CurrentUser("id") userId: string) {
    return this.community.me(userId);
  }

  @Get()
  @Auth(...ADMIN_ROLES)
  list(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.community.list(Number(page) || 1, Number(pageSize) || 20);
  }

  @Post("admin")
  @Auth(...ADMIN_ROLES)
  adminCreate(
    @Body(new ZodValidationPipe(adminCreateCommunityMemberSchema))
    dto: AdminCreateCommunityMemberInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.community.adminCreate(actorId, dto, req.ip);
  }

  @Get(":id")
  @Auth(...ADMIN_ROLES)
  getById(@Param("id") id: string) {
    return this.community.getById(id);
  }

  @Patch(":id")
  @Auth(...ADMIN_ROLES)
  adminUpdate(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(adminUpdateCommunityMemberSchema))
    dto: AdminUpdateCommunityMemberInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.community.adminUpdate(id, actorId, dto, req.ip);
  }

  @Delete(":id")
  @Auth(...ADMIN_ROLES)
  adminDelete(
    @Param("id") id: string,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.community.adminDelete(id, actorId, req.ip);
  }
}
