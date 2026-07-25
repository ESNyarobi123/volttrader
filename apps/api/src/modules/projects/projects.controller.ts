import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { Role } from "@volt/config";
import { Public } from "../../common/decorators/public.decorator";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ProjectsService } from "./projects.service";
import {
  projectUpdateSchema,
  projectUpsertSchema,
  type ProjectUpdateInput,
  type ProjectUpsertInput,
} from "./dto/project.schema";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @Public()
  list() {
    return this.projects.listPublic();
  }

  @Get(":slug")
  @Public()
  getBySlug(@Param("slug") slug: string) {
    return this.projects.getBySlug(slug);
  }

  @Post()
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  create(@Body(new ZodValidationPipe(projectUpsertSchema)) dto: ProjectUpsertInput) {
    return this.projects.create(dto);
  }

  @Patch(":id")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(projectUpdateSchema)) dto: ProjectUpdateInput,
  ) {
    return this.projects.update(id, dto);
  }

  @Delete(":id")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  delete(@Param("id") id: string, @CurrentUser("id") actorId: string) {
    return this.projects.delete(id, actorId);
  }
}
