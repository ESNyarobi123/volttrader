import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Notification, NotificationType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type Tx = Prisma.TransactionClient;

export interface CreateNotificationParams {
  userId: string;
  type?: NotificationType;
  title: string;
  body: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a notification for a user. Usable from other modules (optionally inside a tx). */
  async create(
    params: CreateNotificationParams,
    client: Tx | PrismaService = this.prisma,
  ): Promise<Notification> {
    return client.notification.create({
      data: {
        userId: params.userId,
        type: params.type ?? "SYSTEM",
        title: params.title,
        body: params.body,
      },
    });
  }

  async listForUser(userId: string): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException("Notification not found");
    if (notification.userId !== userId) {
      throw new ForbiddenException("You do not have access to this notification");
    }
    if (notification.readAt) return notification;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }
}
