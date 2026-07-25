import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { Role } from "@volt/config";
import {
  coursePlanUpdateSchema,
  coursePlanUpsertSchema,
  type CoursePlanUpdateInput,
  type CoursePlanUpsertInput,
} from "@volt/validation";
import { Public } from "../../common/decorators/public.decorator";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CoursePlansService } from "./course-plans.service";

@Controller("course-plans")
export class CoursePlansController {
  constructor(private readonly plans: CoursePlansService) {}

  /** Public landing — published plans only, sortOrder ascending. */
  @Get()
  @Public()
  listPublic() {
    return this.plans.listPublished();
  }

  @Get("admin/all")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  listAdmin() {
    return this.plans.listAdmin();
  }

  @Post()
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  create(
    @Body(new ZodValidationPipe(coursePlanUpsertSchema)) dto: CoursePlanUpsertInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.plans.create(dto, actorId);
  }

  @Patch(":id")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(coursePlanUpdateSchema)) dto: CoursePlanUpdateInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.plans.update(id, dto, actorId);
  }

  @Delete(":id")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  remove(@Param("id") id: string, @CurrentUser("id") actorId: string) {
    return this.plans.delete(id, actorId);
  }
}
