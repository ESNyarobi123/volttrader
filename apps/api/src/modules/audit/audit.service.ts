import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type Tx = Prisma.TransactionClient;

export interface AuditParams {
  actorId?: string | null;
  action: string; // e.g. "withdrawal.approved"
  entityType: string;
  entityId?: string | null;
  ip?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface AuditListFilters {
  q?: string;
  entityType?: string;
  action?: string;
  /** Prefix match on action, e.g. "payment" → payment.* */
  domain?: string;
}

/** Append-only audit trail for admin, financial and sensitive actions. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditParams, client: Tx | PrismaService = this.prisma): Promise<void> {
    await client.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        ip: params.ip ?? null,
        metadata: params.metadata,
      },
    });
  }

  private where(filters: AuditListFilters = {}): Prisma.AuditLogWhereInput {
    const and: Prisma.AuditLogWhereInput[] = [];

    if (filters.entityType) {
      and.push({ entityType: filters.entityType });
    }
    if (filters.action) {
      and.push({ action: filters.action });
    }
    if (filters.domain) {
      and.push({ action: { startsWith: `${filters.domain}.` } });
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim();
      and.push({
        OR: [
          { action: { contains: q, mode: "insensitive" } },
          { entityType: { contains: q, mode: "insensitive" } },
          { entityId: { contains: q, mode: "insensitive" } },
          { ip: { contains: q, mode: "insensitive" } },
          { actor: { fullName: { contains: q, mode: "insensitive" } } },
          { actor: { email: { contains: q, mode: "insensitive" } } },
        ],
      });
    }

    return and.length ? { AND: and } : {};
  }

  async list(page = 1, pageSize = 50, filters: AuditListFilters = {}) {
    const where = this.where(filters);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { id: true, fullName: true, email: true, role: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }

  async getById(id: string) {
    const row = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });
    if (!row) throw new NotFoundException("Audit event not found");
    return row;
  }

  async stats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [total, today, week, actors] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.auditLog.findMany({
        where: { actorId: { not: null } },
        distinct: ["actorId"],
        select: { actorId: true },
      }),
    ]);

    return {
      total,
      today,
      week,
      uniqueActors: actors.length,
    };
  }
}
