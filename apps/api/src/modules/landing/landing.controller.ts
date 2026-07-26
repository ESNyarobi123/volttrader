import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Role } from "@volt/config";
import {
  landingPageUpdateSchema,
  type LandingPageUpdateInput,
} from "@volt/validation";
import { Public } from "../../common/decorators/public.decorator";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { LandingService } from "./landing.service";

@Controller("landing")
export class LandingController {
  constructor(private readonly landing: LandingService) {}

  /** Public homepage marketing payload. */
  @Get()
  @Public()
  getPublic() {
    return this.landing.getPublic();
  }

  @Get("admin")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  getAdmin() {
    return this.landing.getAdmin();
  }

  @Patch("admin")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN)
  update(
    @Body(new ZodValidationPipe(landingPageUpdateSchema)) dto: LandingPageUpdateInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.landing.update(dto, actorId, req.ip);
  }
}
