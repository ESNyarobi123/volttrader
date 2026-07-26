import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { User, UserRole, UserStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  UpdateProfileInput,
} from "@volt/validation";
import type { SessionUser } from "@volt/types";
import { hashPassword } from "../../common/password";
import { pickDefined } from "../../common/pick-defined";
import { toSessionUser } from "../../common/session-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LedgerService } from "../ledger/ledger.service";

/** Admin-facing projection of a user account (no secrets). */
const ADMIN_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  country: true,
  role: true,
  status: true,
  emailVerified: true,
  kycStatus: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type AdminUserView = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  kycStatus: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly config: ConfigService,
  ) {}

  private toAdminView(
    user: Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SELECT }>,
  ): AdminUserView {
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private async assertContactAvailable(
    email: string | null | undefined,
    phone: string | null | undefined,
    excludeId?: string,
  ) {
    if (!email && !phone) return;
    const clash = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (clash) throw new ConflictException("An account with these details already exists");
  }

  async me(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    return toSessionUser(user);
  }

  async updateMe(userId: string, input: UpdateProfileInput): Promise<SessionUser> {
    if (input.phone) {
      const clash = await this.prisma.user.findFirst({
        where: { phone: input.phone, id: { not: userId } },
      });
      if (clash) throw new ConflictException("That phone number is already in use");
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...pickDefined(input, ["fullName", "country", "phone"]),
        },
      });
      return toSessionUser(user);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundException("User not found");
      }
      throw err;
    }
  }

  async list(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: ADMIN_USER_SELECT,
      }),
      this.prisma.user.count(),
    ]);
    return { items: items.map((u) => this.toAdminView(u)), total };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: ADMIN_USER_SELECT,
    });
    if (!user) throw new NotFoundException("User not found");
    return this.toAdminView(user);
  }

  async create(input: AdminCreateUserInput, actorId: string, ip?: string) {
    await this.assertContactAvailable(input.email, input.phone);

    const passwordHash = await hashPassword(input.password, this.config);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email ?? null,
          phone: input.phone ?? null,
          country: input.country ?? null,
          passwordHash,
          role: input.role,
          status: input.status ?? "ACTIVE",
          emailVerified: input.emailVerified ?? Boolean(input.email),
          acceptedTermsAt: new Date(),
        },
        select: ADMIN_USER_SELECT,
      });
      await this.ledger.ensureWallet(created.id, "TZS", tx);
      return created;
    });

    await this.audit.log({
      actorId,
      action: "user.created",
      entityType: "User",
      entityId: user.id,
      ip,
      metadata: { role: user.role, email: user.email, phone: user.phone },
    });

    return this.toAdminView(user);
  }

  async update(id: string, input: AdminUpdateUserInput, actorId: string, ip?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("User not found");

    if (id === actorId) {
      if (input.role !== undefined && input.role !== existing.role) {
        throw new BadRequestException("You cannot change your own role");
      }
      if (input.status !== undefined && input.status !== "ACTIVE") {
        throw new BadRequestException("You cannot change your own account status");
      }
    }

    const nextEmail = input.email === undefined ? existing.email : input.email;
    const nextPhone = input.phone === undefined ? existing.phone : input.phone;
    if (!nextEmail && !nextPhone) {
      throw new BadRequestException("User must keep an email or a phone number");
    }
    await this.assertContactAvailable(nextEmail, nextPhone, id);

    const data: Prisma.UserUpdateInput = {};
    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.country !== undefined) data.country = input.country;
    if (input.role !== undefined) data.role = input.role;
    if (input.status !== undefined) data.status = input.status;
    if (input.emailVerified !== undefined) data.emailVerified = input.emailVerified;
    if (input.password) {
      data.passwordHash = await hashPassword(input.password, this.config);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: ADMIN_USER_SELECT,
    });

    await this.audit.log({
      actorId,
      action: "user.updated",
      entityType: "User",
      entityId: id,
      ip,
      metadata: {
        fields: Object.keys(input).filter((k) => k !== "password"),
        passwordReset: Boolean(input.password),
      },
    });

    return this.toAdminView(user);
  }

  async delete(id: string, actorId: string, ip?: string) {
    if (id === actorId) {
      throw new BadRequestException("You cannot delete your own account");
    }

    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ledgerEntries: true,
            investments: true,
            payments: true,
            withdrawals: true,
            enrollments: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException("User not found");

    const { ledgerEntries, investments, payments, withdrawals, enrollments } = existing._count;
    const blockers = [
      ledgerEntries > 0 ? `${ledgerEntries} ledger entr${ledgerEntries === 1 ? "y" : "ies"}` : null,
      investments > 0 ? `${investments} investment(s)` : null,
      payments > 0 ? `${payments} payment(s)` : null,
      withdrawals > 0 ? `${withdrawals} withdrawal(s)` : null,
      enrollments > 0 ? `${enrollments} enrollment(s)` : null,
    ].filter(Boolean);

    if (blockers.length > 0) {
      throw new BadRequestException(
        `Cannot delete this user — ${blockers.join(", ")} exist. Suspend or ban the account instead.`,
      );
    }

    await this.prisma.user.delete({ where: { id } });

    await this.audit.log({
      actorId,
      action: "user.deleted",
      entityType: "User",
      entityId: id,
      ip,
      metadata: { email: existing.email, phone: existing.phone, role: existing.role },
    });

    return { id, deleted: true as const };
  }

  async updateStatus(id: string, status: UserStatus, actorId: string, ip?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("User not found");
    if (id === actorId && status !== "ACTIVE") {
      throw new BadRequestException("You cannot change your own account status");
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: ADMIN_USER_SELECT,
    });

    await this.audit.log({
      actorId,
      action: "user.status_changed",
      entityType: "User",
      entityId: id,
      ip,
      metadata: { from: existing.status, to: status },
    });

    return this.toAdminView(user);
  }

  async updateRole(id: string, role: UserRole, actorId: string, ip?: string) {
    if (id === actorId) {
      throw new BadRequestException("You cannot change your own role");
    }

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("User not found");

    const user = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: ADMIN_USER_SELECT,
    });

    await this.audit.log({
      actorId,
      action: "user.role_changed",
      entityType: "User",
      entityId: id,
      ip,
      metadata: { from: existing.role, to: role },
    });

    return this.toAdminView(user);
  }
}
