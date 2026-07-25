import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { Role, OpportunityStatus } from "@volt/config";
import {
  opportunityUpsertSchema,
  type OpportunityUpsertInput,
} from "@volt/validation";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Public } from "../../common/decorators/public.decorator";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OpportunitiesService } from "./opportunities.service";

const opportunityUpdateSchema = opportunityUpsertSchema
  .partial()
  .extend({ status: z.nativeEnum(OpportunityStatus).optional() });
type OpportunityUpdateInput = z.infer<typeof opportunityUpdateSchema>;

const ADMIN_ROLES = [
  Role.CONTENT_MANAGER,
  Role.COMPLIANCE_OFFICER,
  Role.SUPER_ADMIN,
] as const;

@Controller("opportunities")
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Get()
  @Public()
  list() {
    return this.opportunities.listOpen();
  }

  // Admin routes declared before ":slug" so they are not swallowed by the param route.
  @Get("admin/all")
  @Auth(...ADMIN_ROLES)
  listAll() {
    return this.opportunities.listAll();
  }

  @Post()
  @Auth(...ADMIN_ROLES)
  create(
    @Body(new ZodValidationPipe(opportunityUpsertSchema)) dto: OpportunityUpsertInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.opportunities.create(dto, actorId);
  }

  @Patch(":id")
  @Auth(...ADMIN_ROLES)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(opportunityUpdateSchema)) dto: OpportunityUpdateInput,
    @CurrentUser("id") actorId: string,
  ) {
    return this.opportunities.update(id, dto, actorId);
  }

  @Delete(":id")
  @Auth(...ADMIN_ROLES)
  remove(@Param("id") id: string, @CurrentUser("id") actorId: string) {
    return this.opportunities.delete(id, actorId);
  }

  @Get(":slug")
  @Public()
  getBySlug(@Param("slug") slug: string) {
    return this.opportunities.getBySlug(slug);
  }
}
