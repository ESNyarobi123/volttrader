import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InvestmentStatus, KycStatus, PaymentStatus, type Currency } from "@prisma/client";
import * as net from "node:net";
import { BRAND } from "@volt/config";
import type { PlatformSettingsUpdateInput } from "@volt/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { toMoney } from "../../common/money";
import { errorMessage } from "../../common/errors";

/** Length of the dashboard activity timeseries (inclusive of today). */
const TIMESERIES_DAYS = 14;

type ServiceStatus = "up" | "down";

export interface SystemServiceProbe {
  id: string;
  name: string;
  container: string;
  status: ServiceStatus;
  latencyMs: number | null;
  detail: string;
}

export type AdminSearchFilter =
  | "all"
  | "users"
  | "courses"
  | "opportunities"
  | "payments"
  | "withdrawals"
  | "investments";

export interface AdminSearchResult {
  id: string;
  type: Exclude<AdminSearchFilter, "all">;
  title: string;
  subtitle: string;
  href: string;
}

export interface AdminAlert {
  id: string;
  kind: "finance" | "compliance" | "support" | "system";
  severity: "info" | "warning" | "danger" | "success";
  title: string;
  body: string;
  href: string;
  createdAt: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /** Editable platform settings + read-only runtime/env snapshot. */
  async getSettings() {
    const row = await this.ensureSettings();
    return this.serializeSettings(row);
  }

  async updateSettings(
    dto: PlatformSettingsUpdateInput,
    actorId: string,
    ip?: string | null,
  ) {
    await this.ensureSettings();

    const data: Record<string, unknown> = { updatedById: actorId };
    if (dto.supportEmail !== undefined) data.supportEmail = dto.supportEmail;
    if (dto.supportPhone !== undefined) data.supportPhone = dto.supportPhone;
    if (dto.supportHours !== undefined) data.supportHours = dto.supportHours;
    if (dto.maintenanceMode !== undefined) data.maintenanceMode = dto.maintenanceMode;
    if (dto.registrationOpen !== undefined) data.registrationOpen = dto.registrationOpen;
    if (dto.communityOpen !== undefined) data.communityOpen = dto.communityOpen;
    if (dto.minDepositMinor !== undefined) data.minDepositMinor = BigInt(dto.minDepositMinor);
    if (dto.minWithdrawalMinor !== undefined) {
      data.minWithdrawalMinor = BigInt(dto.minWithdrawalMinor);
    }
    if (dto.depositMobileProvider !== undefined) {
      data.depositMobileProvider = dto.depositMobileProvider;
    }
    if (dto.depositMobileNumber !== undefined) data.depositMobileNumber = dto.depositMobileNumber;
    if (dto.depositMobileName !== undefined) data.depositMobileName = dto.depositMobileName;
    if (dto.depositBankName !== undefined) data.depositBankName = dto.depositBankName;
    if (dto.depositBankAccount !== undefined) data.depositBankAccount = dto.depositBankAccount;
    if (dto.depositBankAccountName !== undefined) {
      data.depositBankAccountName = dto.depositBankAccountName;
    }
    if (dto.depositInstructions !== undefined) data.depositInstructions = dto.depositInstructions;
    if (dto.depositManualEnabled !== undefined) data.depositManualEnabled = dto.depositManualEnabled;
    if (dto.depositOnlineEnabled !== undefined) data.depositOnlineEnabled = dto.depositOnlineEnabled;

    const row = await this.prisma.platformSettings.update({
      where: { id: "default" },
      data,
    });

    await this.audit.log({
      actorId,
      action: "settings.updated",
      entityType: "PlatformSettings",
      entityId: row.id,
      ip,
      metadata: dto as object,
    });

    return this.serializeSettings(row);
  }

  private async ensureSettings() {
    const existing = await this.prisma.platformSettings.findUnique({
      where: { id: "default" },
    });
    if (existing) return existing;
    return this.prisma.platformSettings.create({
      data: {
        id: "default",
        supportEmail: "support@volttrades.local",
        supportHours: "Mon–Fri 09:00–17:00 EAT",
      },
    });
  }

  private serializeSettings(row: {
    id: string;
    supportEmail: string | null;
    supportPhone: string | null;
    supportHours: string | null;
    maintenanceMode: boolean;
    registrationOpen: boolean;
    communityOpen: boolean;
    minDepositMinor: bigint;
    minWithdrawalMinor: bigint;
    depositMobileProvider: string | null;
    depositMobileNumber: string | null;
    depositMobileName: string | null;
    depositBankName: string | null;
    depositBankAccount: string | null;
    depositBankAccountName: string | null;
    depositInstructions: string | null;
    depositManualEnabled: boolean;
    depositOnlineEnabled: boolean;
    updatedAt: Date;
    updatedById: string | null;
  }) {
    const currency = (this.config.get<string>("DEFAULT_CURRENCY") ?? "TZS") as Currency;
    const flutterwaveConfigured = Boolean(
      this.config.get<string>("FLUTTERWAVE_SECRET_KEY")?.trim(),
    );
    return {
      editable: {
        supportEmail: row.supportEmail,
        supportPhone: row.supportPhone,
        supportHours: row.supportHours,
        maintenanceMode: row.maintenanceMode,
        registrationOpen: row.registrationOpen,
        communityOpen: row.communityOpen,
        minDeposit: toMoney(row.minDepositMinor, currency),
        minWithdrawal: toMoney(row.minWithdrawalMinor, currency),
        depositMobileProvider: row.depositMobileProvider,
        depositMobileNumber: row.depositMobileNumber,
        depositMobileName: row.depositMobileName,
        depositBankName: row.depositBankName,
        depositBankAccount: row.depositBankAccount,
        depositBankAccountName: row.depositBankAccountName,
        depositInstructions: row.depositInstructions,
        depositManualEnabled: row.depositManualEnabled,
        depositOnlineEnabled: row.depositOnlineEnabled,
      },
      runtime: {
        brandName: BRAND.name,
        brandTagline: BRAND.tagline,
        currency,
        paymentGateway: this.config.get<string>("PAYMENT_DEFAULT_GATEWAY") ?? "mock",
        flutterwaveConfigured,
        allowMockPayments: this.isFeatureEnabled("ALLOW_MOCK_PAYMENTS"),
        featureRealMoneyInvestments: this.isFeatureEnabled("FEATURE_REAL_MONEY_INVESTMENTS"),
        nodeEnv: this.config.get<string>("NODE_ENV") ?? "development",
        mailFrom: process.env.MAIL_FROM ?? null,
        s3Bucket: this.config.get<string>("S3_BUCKET") ?? null,
      },
      meta: {
        updatedAt: row.updatedAt.toISOString(),
        updatedById: row.updatedById,
      },
    };
  }

  /** High-level KPIs for the admin dashboard. */
  async overview() {
    const [
      totalUsers,
      totalCourses,
      openOpportunities,
      pendingWithdrawals,
      pendingKyc,
      grossVolume,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.course.count(),
      this.prisma.opportunity.count({ where: { status: "OPEN" } }),
      this.prisma.withdrawal.count({
        where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"] } },
      }),
      this.prisma.kycSubmission.count({ where: { status: "PENDING" } }),
      this.prisma.payment.aggregate({
        where: { status: "PAID" },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalUsers,
      totalCourses,
      openOpportunities,
      pendingWithdrawals,
      pendingKyc,
      grossVolume: Number(grossVolume._sum.amount ?? 0n),
    };
  }

  /**
   * Rich analytics payload for the admin dashboard: KPI totals, money
   * aggregates, status breakdowns, a 14-day activity timeseries and recent
   * activity feeds. All money is plain numbers in minor units (default
   * currency TZS) except per-record "recent" items, which keep the usual
   * { amount, currency } envelope.
   */
  async stats() {
    const dayKeys = this.lastNDayKeys(TIMESERIES_DAYS);
    const windowStart = new Date(`${dayKeys[0]}T00:00:00.000Z`);

    const [
      users,
      courses,
      publishedCourses,
      opportunities,
      openOpportunities,
      activeInvestments,
      pendingWithdrawals,
      pendingKyc,
      openTickets,
      communityMembers,
      enrollments,
      grossVolume,
      depositsTotal,
      withdrawalsPaidTotal,
      courseSalesTotal,
      investmentFundingTotal,
      paymentsByStatusRaw,
      investmentsByStatusRaw,
      usersByKycRaw,
      recentPayments,
      recentSignups,
      recentWithdrawals,
      depositsWindow,
      withdrawalsWindow,
      signupsWindow,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.course.count(),
      this.prisma.course.count({ where: { status: "PUBLISHED" } }),
      this.prisma.opportunity.count(),
      this.prisma.opportunity.count({ where: { status: "OPEN" } }),
      this.prisma.investment.count({ where: { status: "ACTIVE" } }),
      this.prisma.withdrawal.count({
        where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"] } },
      }),
      this.prisma.kycSubmission.count({ where: { status: "PENDING" } }),
      this.prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }),
      this.prisma.communityMember.count(),
      this.prisma.enrollment.count(),
      this.prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({
        where: { status: "PAID", type: "WALLET_DEPOSIT" },
        _sum: { amount: true },
      }),
      this.prisma.withdrawal.aggregate({
        where: { status: "COMPLETED" },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: "PAID", type: "COURSE_PURCHASE" },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: "PAID", type: "INVESTMENT_FUNDING" },
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({ by: ["status"], _count: true }),
      this.prisma.investment.groupBy({ by: ["status"], _count: true }),
      this.prisma.user.groupBy({ by: ["kycStatus"], _count: true }),
      this.prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      this.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, fullName: true, email: true, createdAt: true },
      }),
      this.prisma.withdrawal.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      this.prisma.payment.findMany({
        where: { status: "PAID", type: "WALLET_DEPOSIT", createdAt: { gte: windowStart } },
        select: { amount: true, createdAt: true },
      }),
      this.prisma.withdrawal.findMany({
        where: { status: "COMPLETED", createdAt: { gte: windowStart } },
        select: { amount: true, createdAt: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
    ]);

    const paymentsByStatus = this.zeroRecord(Object.values(PaymentStatus));
    for (const row of paymentsByStatusRaw) paymentsByStatus[row.status] = row._count;

    const investmentsByStatus = this.zeroRecord(Object.values(InvestmentStatus));
    for (const row of investmentsByStatusRaw) investmentsByStatus[row.status] = row._count;

    const usersByKyc = this.zeroRecord(Object.values(KycStatus));
    for (const row of usersByKycRaw) usersByKyc[row.kycStatus] = row._count;

    return {
      currency: this.config.get<string>("DEFAULT_CURRENCY") ?? "TZS",
      totals: {
        users,
        courses,
        publishedCourses,
        opportunities,
        openOpportunities,
        activeInvestments,
        pendingWithdrawals,
        pendingKyc,
        openTickets,
        communityMembers,
        enrollments,
      },
      money: {
        grossVolume: Number(grossVolume._sum.amount ?? 0n),
        depositsTotal: Number(depositsTotal._sum.amount ?? 0n),
        withdrawalsPaidTotal: Number(withdrawalsPaidTotal._sum.amount ?? 0n),
        courseSalesTotal: Number(courseSalesTotal._sum.amount ?? 0n),
        investmentFundingTotal: Number(investmentFundingTotal._sum.amount ?? 0n),
      },
      paymentsByStatus,
      investmentsByStatus,
      usersByKyc,
      timeseries: this.buildTimeseries(dayKeys, depositsWindow, withdrawalsWindow, signupsWindow),
      recent: {
        payments: recentPayments.map((p) => ({
          id: p.id,
          type: p.type,
          status: p.status,
          amount: toMoney(p.amount, p.currency),
          gateway: p.gateway,
          reference: p.reference,
          checkoutUrl: p.checkoutUrl ?? null,
          createdAt: p.createdAt.toISOString(),
        })),
        signups: recentSignups.map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          createdAt: u.createdAt.toISOString(),
        })),
        withdrawals: recentWithdrawals.map((w) => ({
          id: w.id,
          amount: toMoney(w.amount, w.currency),
          method: w.method,
          destinationMasked: w.destinationMasked,
          status: w.status,
          createdAt: w.createdAt.toISOString(),
          processedAt: w.processedAt ? w.processedAt.toISOString() : null,
        })),
      },
    };
  }

  /**
   * Global admin search across users, courses, opportunities, payments,
   * withdrawals and investments. `filter` scopes the domains queried.
   */
  async search(q: string, filter = "all") {
    const term = q.trim();
    if (term.length < 1) {
      return { q: term, filter, results: [] as AdminSearchResult[] };
    }

    const like = { contains: term, mode: "insensitive" as const };
    const take = 8;
    const want = (key: AdminSearchFilter) => filter === "all" || filter === key;

    const [users, courses, opportunities, payments, withdrawals, investments] = await Promise.all([
      want("users")
        ? this.prisma.user.findMany({
            where: { OR: [{ fullName: like }, { email: like }, { phone: like }] },
            take,
            orderBy: { createdAt: "desc" },
            select: { id: true, fullName: true, email: true, role: true, status: true },
          })
        : Promise.resolve([]),
      want("courses")
        ? this.prisma.course.findMany({
            where: { OR: [{ title: like }, { slug: like }, { shortDescription: like }] },
            take,
            orderBy: { updatedAt: "desc" },
            select: { id: true, title: true, slug: true, status: true, level: true },
          })
        : Promise.resolve([]),
      want("opportunities")
        ? this.prisma.opportunity.findMany({
            where: { OR: [{ name: like }, { slug: like }, { summary: like }] },
            take,
            orderBy: { updatedAt: "desc" },
            select: { id: true, name: true, slug: true, status: true, riskCategory: true },
          })
        : Promise.resolve([]),
      want("payments")
        ? this.prisma.payment.findMany({
            where: {
              OR: [
                { reference: like },
                { gateway: like },
                { providerRef: like },
                { user: { fullName: like } },
                { user: { email: like } },
              ],
            },
            take,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              reference: true,
              type: true,
              status: true,
              amount: true,
              currency: true,
              user: { select: { fullName: true } },
            },
          })
        : Promise.resolve([]),
      want("withdrawals")
        ? this.prisma.withdrawal.findMany({
            where: {
              OR: [
                { reference: like },
                { destinationMasked: like },
                { user: { fullName: like } },
                { user: { email: like } },
              ],
            },
            take,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              reference: true,
              status: true,
              amount: true,
              currency: true,
              method: true,
              user: { select: { fullName: true } },
            },
          })
        : Promise.resolve([]),
      want("investments")
        ? this.prisma.investment.findMany({
            where: {
              OR: [
                { reference: like },
                { user: { fullName: like } },
                { opportunity: { name: like } },
              ],
            },
            take,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              reference: true,
              status: true,
              principalAmount: true,
              currency: true,
              user: { select: { fullName: true } },
              opportunity: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const results: AdminSearchResult[] = [
      ...users.map((u) => ({
        id: u.id,
        type: "users" as const,
        title: u.fullName,
        subtitle: `${u.email ?? "No email"} · ${u.role} · ${u.status}`,
        href: "/admin/users",
      })),
      ...courses.map((c) => ({
        id: c.id,
        type: "courses" as const,
        title: c.title,
        subtitle: `${c.slug} · ${c.level} · ${c.status}`,
        href: "/admin/courses",
      })),
      ...opportunities.map((o) => ({
        id: o.id,
        type: "opportunities" as const,
        title: o.name,
        subtitle: `${o.slug} · ${o.riskCategory} · ${o.status}`,
        href: "/admin/opportunities",
      })),
      ...payments.map((p) => ({
        id: p.id,
        type: "payments" as const,
        title: p.reference,
        subtitle: `${p.user.fullName} · ${p.type} · ${p.status}`,
        href: "/admin/payments",
      })),
      ...withdrawals.map((w) => ({
        id: w.id,
        type: "withdrawals" as const,
        title: w.reference,
        subtitle: `${w.user.fullName} · ${w.method} · ${w.status}`,
        href: "/admin/withdrawals",
      })),
      ...investments.map((i) => ({
        id: i.id,
        type: "investments" as const,
        title: i.reference,
        subtitle: `${i.user.fullName} · ${i.opportunity.name} · ${i.status}`,
        href: "/admin/investments",
      })),
    ];

    return { q: term, filter, results };
  }

  /**
   * Actionable system alerts for the admin notification center
   * (pending ops + infra health). Does not write to notifications table.
   */
  async alerts() {
    const [pendingWithdrawals, pendingKyc, openTickets, failedPayments, system] = await Promise.all([
      this.prisma.withdrawal.count({
        where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"] } },
      }),
      this.prisma.kycSubmission.count({ where: { status: "PENDING" } }),
      this.prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }),
      this.prisma.payment.count({ where: { status: "FAILED" } }),
      this.system(),
    ]);

    const items: AdminAlert[] = [];

    if (pendingWithdrawals > 0) {
      items.push({
        id: "alert-withdrawals",
        kind: "finance",
        severity: "warning",
        title: `${pendingWithdrawals} withdrawal(s) need attention`,
        body: "Review requested or processing withdrawals.",
        href: "/admin/withdrawals",
        createdAt: new Date().toISOString(),
      });
    }
    if (pendingKyc > 0) {
      items.push({
        id: "alert-kyc",
        kind: "compliance",
        severity: "warning",
        title: `${pendingKyc} KYC submission(s) pending`,
        body: "Compliance review is waiting.",
        href: "/admin/kyc",
        createdAt: new Date().toISOString(),
      });
    }
    if (openTickets > 0) {
      items.push({
        id: "alert-support",
        kind: "support",
        severity: "info",
        title: `${openTickets} open support ticket(s)`,
        body: "Customers are waiting for a reply.",
        href: "/admin/support",
        createdAt: new Date().toISOString(),
      });
    }
    if (failedPayments > 0) {
      items.push({
        id: "alert-payments",
        kind: "finance",
        severity: "danger",
        title: `${failedPayments} failed payment(s)`,
        body: "Investigate gateway or ledger failures.",
        href: "/admin/payments",
        createdAt: new Date().toISOString(),
      });
    }

    for (const svc of system.services.filter((s) => s.status === "down")) {
      items.push({
        id: `alert-svc-${svc.id}`,
        kind: "system",
        severity: "danger",
        title: `${svc.name} is down`,
        body: `${svc.container} · ${svc.detail}`,
        href: "/admin",
        createdAt: system.checkedAt,
      });
    }

    if (system.overall === "healthy" && items.length === 0) {
      items.push({
        id: "alert-healthy",
        kind: "system",
        severity: "success",
        title: "All systems healthy",
        body: "Docker infra and queues look good.",
        href: "/admin",
        createdAt: system.checkedAt,
      });
    }

    return { items, checkedAt: new Date().toISOString() };
  }

  /** Env/config flags may arrive as boolean (from loadEnv) or string (from envFilePath). */
  private isFeatureEnabled(key: string): boolean {
    const raw = this.config.get<unknown>(key);
    return raw === true || raw === "true";
  }

  /**
   * Live probes for local Docker infra + API. Used by the admin overview
   * "System status" panel. Best-effort — a failed probe never throws.
   */
  async system() {
    const started = Date.now();
    const [database, redis, storage, mail] = await Promise.all([
      this.probeDatabase(),
      this.probeRedis(),
      this.probeHttp({
        id: "storage",
        name: "Object storage",
        container: "volt-minio",
        url: this.config.get<string>("S3_ENDPOINT") ?? "http://localhost:9000",
        detail: "MinIO / S3",
      }),
      this.probeHttp({
        id: "mail",
        name: "Mail catcher",
        container: "volt-mailhog",
        url: this.mailUiUrl(),
        detail: "Mailhog SMTP + UI",
      }),
    ]);

    const services: SystemServiceProbe[] = [
      {
        id: "api",
        name: "API",
        container: "host",
        status: "up",
        latencyMs: Date.now() - started,
        detail: "NestJS on Fastify",
      },
      database,
      redis,
      storage,
      mail,
    ];

    const upCount = services.filter((s) => s.status === "up").length;
    return {
      overall: upCount === services.length ? "healthy" : upCount === 0 ? "down" : "degraded",
      checkedAt: new Date().toISOString(),
      services,
    };
  }

  /** UTC "YYYY-MM-DD" keys for the last `n` days, oldest first (inclusive of today). */
  private lastNDayKeys(n: number): string[] {
    const today = new Date();
    const utcMidnight = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const keys: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(utcMidnight);
      d.setUTCDate(d.getUTCDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    return keys;
  }

  /** A zero-initialized record covering every member of an enum. */
  private zeroRecord<K extends string>(values: readonly K[]): Record<K, number> {
    return Object.fromEntries(values.map((v) => [v, 0])) as Record<K, number>;
  }

  /** Zero-filled daily series, bucketed in JS from raw rows (no SQL date grouping). */
  private buildTimeseries(
    dayKeys: string[],
    deposits: Array<{ amount: bigint; createdAt: Date }>,
    withdrawals: Array<{ amount: bigint; createdAt: Date }>,
    signups: Array<{ createdAt: Date }>,
  ): Array<{ date: string; deposits: number; withdrawals: number; signups: number }> {
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);

    const depositsByDay = new Map<string, number>();
    for (const p of deposits) {
      const key = dayKey(p.createdAt);
      depositsByDay.set(key, (depositsByDay.get(key) ?? 0) + Number(p.amount));
    }

    const withdrawalsByDay = new Map<string, number>();
    for (const w of withdrawals) {
      const key = dayKey(w.createdAt);
      withdrawalsByDay.set(key, (withdrawalsByDay.get(key) ?? 0) + Number(w.amount));
    }

    const signupsByDay = new Map<string, number>();
    for (const u of signups) {
      const key = dayKey(u.createdAt);
      signupsByDay.set(key, (signupsByDay.get(key) ?? 0) + 1);
    }

    return dayKeys.map((date) => ({
      date,
      deposits: depositsByDay.get(date) ?? 0,
      withdrawals: withdrawalsByDay.get(date) ?? 0,
      signups: signupsByDay.get(date) ?? 0,
    }));
  }

  private async probeDatabase(): Promise<SystemServiceProbe> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        id: "database",
        name: "PostgreSQL",
        container: "volt-postgres",
        status: "up",
        latencyMs: Date.now() - started,
        detail: "Primary relational store",
      };
    } catch (err) {
      this.logger.warn(`System probe: PostgreSQL is down (${errorMessage(err)})`);
      return {
        id: "database",
        name: "PostgreSQL",
        container: "volt-postgres",
        status: "down",
        latencyMs: null,
        detail: "Primary relational store",
      };
    }
  }

  private async probeRedis(): Promise<SystemServiceProbe> {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    let host = "localhost";
    let port = 6379;
    try {
      const parsed = new URL(url);
      host = parsed.hostname || host;
      port = Number(parsed.port || 6379);
    } catch (err) {
      this.logger.warn(
        `REDIS_URL ("${url}") is not a valid URL (${errorMessage(err)}); probing ${host}:${port}`,
      );
    }
    const tcp = await this.probeTcp(host, port);
    return {
      id: "redis",
      name: "Redis",
      container: "volt-redis",
      status: tcp.status,
      latencyMs: tcp.latencyMs,
      detail: "Cache / jobs (reserved)",
    };
  }

  private mailUiUrl(): string {
    const smtp = process.env.SMTP_URL;
    if (smtp) {
      try {
        const parsed = new URL(smtp);
        const host = parsed.hostname || "localhost";
        return `http://${host}:8025`;
      } catch (err) {
        this.logger.warn(`SMTP_URL ("${smtp}") is not a valid URL (${errorMessage(err)})`);
      }
    }
    return "http://localhost:8025";
  }

  private async probeHttp(input: {
    id: string;
    name: string;
    container: string;
    url: string;
    detail: string;
  }): Promise<SystemServiceProbe> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      await fetch(input.url, { method: "GET", signal: controller.signal });
      return {
        id: input.id,
        name: input.name,
        container: input.container,
        status: "up",
        latencyMs: Date.now() - started,
        detail: input.detail,
      };
    } catch (err) {
      this.logger.warn(`System probe: ${input.name} is down (${errorMessage(err)})`);
      return {
        id: input.id,
        name: input.name,
        container: input.container,
        status: "down",
        latencyMs: null,
        detail: input.detail,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private probeTcp(
    host: string,
    port: number,
    timeoutMs = 2000,
  ): Promise<{ status: ServiceStatus; latencyMs: number | null }> {
    const started = Date.now();
    return new Promise((resolve) => {
      const socket = net.connect({ host, port });
      const done = (status: ServiceStatus) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve({
          status,
          latencyMs: status === "up" ? Date.now() - started : null,
        });
      };
      socket.setTimeout(timeoutMs);
      socket.once("connect", () => done("up"));
      socket.once("timeout", () => done("down"));
      socket.once("error", () => done("down"));
    });
  }
}
