import { Controller, Get, Param, Query } from "@nestjs/common";
import { Role } from "@volt/config";
import { Auth } from "../../common/decorators/auth.decorator";
import { AuditService } from "./audit.service";

@Controller("admin/audit-logs")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get("stats")
  @Auth(Role.SUPER_ADMIN, Role.COMPLIANCE_OFFICER)
  stats() {
    return this.audit.stats();
  }

  @Get()
  @Auth(Role.SUPER_ADMIN, Role.COMPLIANCE_OFFICER)
  async list(
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "50",
    @Query("q") q?: string,
    @Query("entityType") entityType?: string,
    @Query("action") action?: string,
    @Query("domain") domain?: string,
  ) {
    const { items, total } = await this.audit.list(Number(page), Number(pageSize), {
      q,
      entityType,
      action,
      domain,
    });
    return {
      data: items,
      meta: { page: Number(page), pageSize: Number(pageSize), total },
    };
  }

  @Get(":id")
  @Auth(Role.SUPER_ADMIN, Role.COMPLIANCE_OFFICER)
  getOne(@Param("id") id: string) {
    return this.audit.getById(id);
  }
}
