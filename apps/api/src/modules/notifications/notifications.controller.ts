import { Controller, Get, Param, Post } from "@nestjs/common";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("me")
  @Auth()
  mine(@CurrentUser("id") userId: string) {
    return this.notifications.listForUser(userId);
  }

  @Post(":id/read")
  @Auth()
  markRead(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.notifications.markRead(id, userId);
  }
}
