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
import { z } from "zod";
import { Role } from "@volt/config";
import { supportTicketSchema, type SupportTicketInput } from "@volt/validation";
import type { AuthenticatedUser } from "../../common/types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SupportService } from "./support.service";

const messageSchema = z.object({ body: z.string().min(1).max(5000) });
type MessageInput = z.infer<typeof messageSchema>;

const statusSchema = z.object({
  status: z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]),
});
type StatusInput = z.infer<typeof statusSchema>;

const adminCreateSchema = supportTicketSchema.extend({
  userId: z.string().min(1),
});
type AdminCreateInput = z.infer<typeof adminCreateSchema>;

const AGENT_ROLES = [Role.SUPPORT_AGENT, Role.SUPER_ADMIN] as const;

@Controller("support")
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post("tickets")
  @Auth()
  create(
    @Body(new ZodValidationPipe(supportTicketSchema)) dto: SupportTicketInput,
    @CurrentUser("id") userId: string,
  ) {
    return this.support.createTicket(userId, dto);
  }

  @Post("tickets/admin")
  @Auth(...AGENT_ROLES)
  adminCreate(
    @Body(new ZodValidationPipe(adminCreateSchema)) dto: AdminCreateInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.support.adminCreate(actorId, dto, req.ip);
  }

  @Get("tickets/me")
  @Auth()
  mine(@CurrentUser("id") userId: string) {
    return this.support.listMine(userId);
  }

  @Get("tickets")
  @Auth(...AGENT_ROLES)
  list(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.support.list(Number(page) || 1, Number(pageSize) || 20);
  }

  @Get("tickets/:id")
  @Auth()
  getOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.support.getById(id, { id: user.id, role: user.role });
  }

  @Patch("tickets/:id")
  @Auth(...AGENT_ROLES)
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(statusSchema)) dto: StatusInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.support.updateStatus(id, dto.status, actorId, req.ip);
  }

  @Delete("tickets/:id")
  @Auth(...AGENT_ROLES)
  remove(
    @Param("id") id: string,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.support.adminDelete(id, actorId, req.ip);
  }

  @Post("tickets/:id/messages")
  @Auth()
  addMessage(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(messageSchema)) dto: MessageInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.support.addMessage(id, { id: user.id, role: user.role }, dto.body);
  }
}
