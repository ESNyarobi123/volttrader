import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { Role } from "@volt/config";
import {
  investmentPlanUpdateSchema,
  investmentPlanUpsertSchema,
  type InvestmentPlanUpdateInput,
  type InvestmentPlanUpsertInput,
} from "@volt/validation";
import { Public } from "../../common/decorators/public.decorator";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { InvestmentPlansService } from "./investment-plans.service";

@Controller("investment-plans")
export class InvestmentPlansController {
  constructor(private readonly plans: InvestmentPlansService) {}

  @Get()
  @Public()
  listPublic() {
    return this.plans.listPublished();
  }

  @Get("admin/all")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN, Role.FINANCE_ADMIN)
  listAdmin() {
    return this.plans.listAdmin();
  }

  @Post()
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN, Role.FINANCE_ADMIN)
  create(
    @Body(new ZodValidationPipe(investmentPlanUpsertSchema)) dto: InvestmentPlanUpsertInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.plans.create(dto, actorId);
  }

  @Patch(":id")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN, Role.FINANCE_ADMIN)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(investmentPlanUpdateSchema)) dto: InvestmentPlanUpdateInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.plans.update(id, dto, actorId);
  }

  @Delete(":id")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN, Role.FINANCE_ADMIN)
  remove(@Param("id") id: string, @CurrentUser("id") actorId: string) {
    return this.plans.delete(id, actorId);
  }
}
