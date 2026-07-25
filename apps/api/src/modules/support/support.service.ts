import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TicketStatus, UserRole } from "@prisma/client";
import type { SupportTicketInput } from "@volt/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const AGENT_ROLES: UserRole[] = ["SUPPORT_AGENT", "SUPER_ADMIN"];

export type AdminTicketMessageView = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    role: UserRole;
  } | null;
};

export type AdminTicketView = {
  id: string;
  subject: string;
  category: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  user: {
    id: string;
    fullName: string;
    email: string | null;
  } | null;
  messages?: AdminTicketMessageView[];
};

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toListView(
    ticket: {
      id: string;
      subject: string;
      category: string;
      status: TicketStatus;
      createdAt: Date;
      updatedAt: Date;
      user?: { id: string; fullName: string; email: string | null } | null;
      _count?: { messages: number };
      messages?: { id: string }[];
    },
  ): AdminTicketView {
    return {
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      messageCount: ticket._count?.messages ?? ticket.messages?.length ?? 0,
      user: ticket.user
        ? {
            id: ticket.user.id,
            fullName: ticket.user.fullName,
            email: ticket.user.email,
          }
        : null,
    };
  }

  /** Create a ticket and its first message atomically. */
  async createTicket(userId: string, input: SupportTicketInput) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          userId,
          subject: input.subject,
          category: input.category,
          messages: {
            create: { authorId: userId, body: input.message },
          },
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      return ticket;
    });
  }

  /** Admin creates a ticket on behalf of a user. */
  async adminCreate(
    actorId: string,
    input: SupportTicketInput & { userId: string },
    ip?: string,
  ): Promise<AdminTicketView> {
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new NotFoundException("User not found");

    const ticket = await this.prisma.$transaction(async (tx) => {
      return tx.supportTicket.create({
        data: {
          userId: input.userId,
          subject: input.subject,
          category: input.category,
          messages: {
            create: { authorId: actorId, body: input.message },
          },
        },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          _count: { select: { messages: true } },
        },
      });
    });

    await this.audit.log({
      actorId,
      action: "support.ticket_created",
      entityType: "SupportTicket",
      entityId: ticket.id,
      ip,
      metadata: { userId: input.userId, category: input.category },
    });

    return this.toListView(ticket);
  }

  /** The caller's own tickets, each with its messages. */
  async listMine(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  }

  /** Append a message. Allowed for the ticket owner or a support agent. */
  async addMessage(ticketId: string, author: { id: string; role: UserRole }, body: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Ticket not found");

    const isAgent = AGENT_ROLES.includes(author.role);
    if (ticket.userId !== author.id && !isAgent) {
      throw new ForbiddenException("You do not have access to this ticket");
    }

    if (ticket.status === "CLOSED") {
      throw new ForbiddenException("This ticket is closed");
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: { ticketId, authorId: author.id, body },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
        },
      }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: isAgent ? "PENDING" : "OPEN" },
      }),
    ]);

    return {
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      author: message.author,
    };
  }

  /** Admin — every ticket, paginated. */
  async list(page = 1, pageSize = 20) {
    const take = Math.min(100, Math.max(1, pageSize));
    const skip = (Math.max(1, page) - 1) * take;
    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        orderBy: { updatedAt: "desc" },
        skip,
        take,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.supportTicket.count(),
    ]);
    return {
      data: items.map((t) => this.toListView(t)),
      meta: { page: Math.max(1, page), pageSize: take, total },
    };
  }

  async getById(id: string, requester: { id: string; role: UserRole }): Promise<AdminTicketView> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, fullName: true, role: true } } },
        },
        _count: { select: { messages: true } },
      },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");

    const isAgent = AGENT_ROLES.includes(requester.role);
    if (ticket.userId !== requester.id && !isAgent) {
      throw new ForbiddenException("You do not have access to this ticket");
    }

    return {
      ...this.toListView(ticket),
      messages: ticket.messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        author: m.author,
      })),
    };
  }

  async updateStatus(
    id: string,
    status: TicketStatus,
    actorId: string,
    ip?: string,
  ): Promise<AdminTicketView> {
    const existing = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        _count: { select: { messages: true } },
      },
    });
    if (!existing) throw new NotFoundException("Ticket not found");

    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        _count: { select: { messages: true } },
      },
    });

    await this.audit.log({
      actorId,
      action: "support.ticket_status",
      entityType: "SupportTicket",
      entityId: id,
      ip,
      metadata: { from: existing.status, to: status },
    });

    return this.toListView(ticket);
  }

  async adminDelete(id: string, actorId: string, ip?: string) {
    const existing = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Ticket not found");

    await this.prisma.supportTicket.delete({ where: { id } });

    await this.audit.log({
      actorId,
      action: "support.ticket_deleted",
      entityType: "SupportTicket",
      entityId: id,
      ip,
      metadata: { subject: existing.subject, status: existing.status },
    });

    return { id, deleted: true as const };
  }
}
