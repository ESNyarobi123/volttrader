import { Body, Controller, Get, Patch, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Role } from "@volt/config";
import {
  platformSettingsUpdateSchema,
  type PlatformSettingsUpdateInput,
} from "@volt/validation";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AdminService, type AdminSearchFilter } from "./admin.service";

const STAFF = [
  Role.SUPER_ADMIN,
  Role.FINANCE_ADMIN,
  Role.COMPLIANCE_OFFICER,
  Role.CONTENT_MANAGER,
  Role.SUPPORT_AGENT,
] as const;

@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("overview")
  @Auth(...STAFF)
  overview() {
    return this.admin.overview();
  }

  @Get("stats")
  @Auth(...STAFF)
  stats() {
    return this.admin.stats();
  }

  @Get("system")
  @Auth(...STAFF)
  system() {
    return this.admin.system();
  }

  @Get("alerts")
  @Auth(...STAFF)
  alerts() {
    return this.admin.alerts();
  }

  @Get("settings")
  @Auth(Role.SUPER_ADMIN, Role.COMPLIANCE_OFFICER, Role.FINANCE_ADMIN)
  settings() {
    return this.admin.getSettings();
  }

  @Patch("settings")
  @Auth(Role.SUPER_ADMIN, Role.FINANCE_ADMIN)
  updateSettings(
    @Body(new ZodValidationPipe(platformSettingsUpdateSchema))
    dto: PlatformSettingsUpdateInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.admin.updateSettings(dto, actorId, req.ip);
  }

  @Get("search")
  @Auth(...STAFF)
  search(@Query("q") q = "", @Query("filter") filter = "all") {
    const allowed: AdminSearchFilter[] = [
      "all",
      "users",
      "courses",
      "opportunities",
      "payments",
      "withdrawals",
      "investments",
    ];
    const safeFilter = allowed.includes(filter as AdminSearchFilter)
      ? (filter as AdminSearchFilter)
      : "all";
    return this.admin.search(q ?? "", safeFilter);
  }
}
