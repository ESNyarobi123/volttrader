import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CommunityMember, MembershipStatus } from "@prisma/client";
import type {
  AdminCreateCommunityMemberInput,
  AdminUpdateCommunityMemberInput,
  JoinCommunityInput,
} from "@volt/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

export type AdminCommunityMemberView = {
  id: string;
  status: MembershipStatus;
  motivation: string | null;
  joinedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;
};

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toAdminView(
    member: CommunityMember & {
      user?: {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
      } | null;
    },
  ): AdminCommunityMemberView {
    return {
      id: member.id,
      status: member.status,
      motivation: member.motivation ?? null,
      joinedAt: member.joinedAt.toISOString(),
      user: member.user
        ? {
            id: member.user.id,
            fullName: member.user.fullName,
            email: member.user.email,
            phone: member.user.phone,
          }
        : null,
    };
  }

  /** Upsert the caller's membership; new members land on the WAITLIST. */
  async join(userId: string, input: JoinCommunityInput) {
    return this.prisma.communityMember.upsert({
      where: { userId },
      create: {
        userId,
        status: "WAITLIST",
        motivation: input.motivation ?? null,
      },
      update: {
        ...(input.motivation !== undefined ? { motivation: input.motivation } : {}),
      },
    });
  }

  async me(userId: string) {
    return this.prisma.communityMember.findUnique({ where: { userId } });
  }

  async list(page = 1, pageSize = 20) {
    const take = Math.min(100, Math.max(1, pageSize));
    const skip = (Math.max(1, page) - 1) * take;
    const [items, total] = await Promise.all([
      this.prisma.communityMember.findMany({
        orderBy: { joinedAt: "desc" },
        skip,
        take,
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      }),
      this.prisma.communityMember.count(),
    ]);
    return {
      data: items.map((m) => this.toAdminView(m)),
      meta: { page: Math.max(1, page), pageSize: take, total },
    };
  }

  async getById(id: string): Promise<AdminCommunityMemberView> {
    const member = await this.prisma.communityMember.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });
    if (!member) throw new NotFoundException("Community member not found");
    return this.toAdminView(member);
  }

  async adminCreate(
    actorId: string,
    input: AdminCreateCommunityMemberInput,
    ip?: string,
  ): Promise<AdminCommunityMemberView> {
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new NotFoundException("User not found");

    const existing = await this.prisma.communityMember.findUnique({
      where: { userId: input.userId },
    });
    if (existing) {
      throw new ConflictException("This user is already on the Volt Society list");
    }

    const member = await this.prisma.communityMember.create({
      data: {
        userId: input.userId,
        status: input.status ?? "WAITLIST",
        motivation: input.motivation ?? null,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });

    await this.audit.log({
      actorId,
      action: "community.member_created",
      entityType: "CommunityMember",
      entityId: member.id,
      ip,
      metadata: { userId: input.userId, status: member.status },
    });

    return this.toAdminView(member);
  }

  async adminUpdate(
    id: string,
    actorId: string,
    input: AdminUpdateCommunityMemberInput,
    ip?: string,
  ): Promise<AdminCommunityMemberView> {
    const existing = await this.prisma.communityMember.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Community member not found");

    const member = await this.prisma.communityMember.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.motivation !== undefined ? { motivation: input.motivation } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });

    await this.audit.log({
      actorId,
      action: "community.member_updated",
      entityType: "CommunityMember",
      entityId: id,
      ip,
      metadata: {
        fields: Object.keys(input),
        from: existing.status,
        to: member.status,
      },
    });

    return this.toAdminView(member);
  }

  async adminDelete(id: string, actorId: string, ip?: string) {
    const existing = await this.prisma.communityMember.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Community member not found");

    await this.prisma.communityMember.delete({ where: { id } });

    await this.audit.log({
      actorId,
      action: "community.member_deleted",
      entityType: "CommunityMember",
      entityId: id,
      ip,
      metadata: { userId: existing.userId, status: existing.status },
    });

    return { id, deleted: true as const };
  }
}
