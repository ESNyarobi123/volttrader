import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Role } from "@volt/config";
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  paginationSchema,
  updateProfileSchema,
  type AdminCreateUserInput,
  type AdminUpdateUserInput,
  type Pagination,
  type UpdateProfileInput,
} from "@volt/validation";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";
import {
  updateUserRoleSchema,
  updateUserStatusSchema,
  type UpdateUserRoleInput,
  type UpdateUserStatusInput,
} from "./dto/update-status.dto";

const STAFF_ROLES = [Role.SUPPORT_AGENT, Role.SUPER_ADMIN] as const;

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @Auth()
  me(@CurrentUser("id") userId: string) {
    return this.users.me(userId);
  }

  @Patch("me")
  @Auth()
  updateMe(
    @CurrentUser("id") userId: string,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileInput,
  ) {
    return this.users.updateMe(userId, dto);
  }

  @Get()
  @Auth(...STAFF_ROLES)
  async list(@Query(new ZodValidationPipe(paginationSchema)) query: Pagination) {
    const { items, total } = await this.users.list(query.page, query.pageSize);
    return { data: items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  @Post()
  @Auth(Role.SUPER_ADMIN)
  create(
    @Body(new ZodValidationPipe(adminCreateUserSchema)) dto: AdminCreateUserInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.users.create(dto, actorId, req.ip);
  }

  @Get(":id")
  @Auth(...STAFF_ROLES)
  getById(@Param("id") id: string) {
    return this.users.getById(id);
  }

  @Patch(":id")
  @Auth(Role.SUPER_ADMIN)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(adminUpdateUserSchema)) dto: AdminUpdateUserInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.users.update(id, dto, actorId, req.ip);
  }

  @Delete(":id")
  @Auth(Role.SUPER_ADMIN)
  remove(
    @Param("id") id: string,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.users.delete(id, actorId, req.ip);
  }

  @Patch(":id/status")
  @Auth(...STAFF_ROLES)
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema)) dto: UpdateUserStatusInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.users.updateStatus(id, dto.status, actorId, req.ip);
  }

  @Patch(":id/role")
  @Auth(Role.SUPER_ADMIN)
  updateRole(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserRoleSchema)) dto: UpdateUserRoleInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.users.updateRole(id, dto.role, actorId, req.ip);
  }
}
