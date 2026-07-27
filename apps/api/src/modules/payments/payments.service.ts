import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { Course, Coupon, Payment, PaymentStatus, PaymentType, UserRole } from "@prisma/client";
import type {
  AdminCreatePaymentInput,
  AdminUpdatePaymentInput,
  CourseCheckoutInput,
  DepositInput,
  ManualDepositInput,
  MockPaymentSimulateInput,
} from "@volt/validation";
import type { DepositMethodsView, PaymentView } from "@volt/types";
import { ADMIN_ROLES, Role, type Currency } from "@volt/config";
import { PrismaService } from "../../prisma/prisma.service";
import { LedgerService } from "../ledger/ledger.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { toMoney } from "../../common/money";
import { GatewayRegistry } from "./gateways/gateway.registry";

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CourseCheckoutResult {
  payment: PaymentView | null;
  enrolled: boolean;
  checkoutUrl: string | null;
}

/**
 * Payment orchestration. A payment is NEVER confirmed by the client — only a
 * verified gateway webhook flips it to PAID, and the side effects (wallet
 * credit, enrollment, investment activation) happen atomically in that handler.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly gateways: GatewayRegistry,
  ) {}

  private toView(p: Payment): PaymentView {
    return {
      id: p.id,
      type: p.type,
      status: p.status,
      amount: toMoney(p.amount, p.currency),
      gateway: p.gateway,
      reference: p.reference,
      checkoutUrl: p.checkoutUrl ?? null,
      createdAt: p.createdAt.toISOString(),
      metadata: (p.metadata as Record<string, unknown> | null) ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Admin-published deposit instructions (manual mobile money / bank).
  // -------------------------------------------------------------------------
  async getDepositMethods(): Promise<DepositMethodsView> {
    const currency = (this.config.get<string>("DEFAULT_CURRENCY") ?? "USD") as Currency;
    const settings =
      (await this.prisma.platformSettings.findUnique({ where: { id: "default" } })) ??
      (await this.prisma.platformSettings.create({
        data: {
          id: "default",
          supportEmail: "support@volttrades.local",
          supportHours: "Mon–Fri 09:00–17:00 EAT",
        },
      }));

    const mobile =
      settings.depositMobileNumber && settings.depositMobileProvider
        ? {
            provider: settings.depositMobileProvider,
            number: settings.depositMobileNumber,
            accountName: settings.depositMobileName ?? "",
          }
        : null;

    const bank =
      settings.depositBankAccount && settings.depositBankName
        ? {
            bankName: settings.depositBankName,
            accountNumber: settings.depositBankAccount,
            accountName: settings.depositBankAccountName ?? "",
          }
        : null;

    const gatewayId = this.gateways.defaultOnlineGatewayId();
    const catalog = this.gateways.catalog().find((g) => g.id === gatewayId);
    const onlineAvailable = Boolean(catalog?.available && gatewayId !== "manual");

    return {
      manualEnabled: settings.depositManualEnabled,
      onlineEnabled: settings.depositOnlineEnabled,
      mobile,
      bank,
      instructions: settings.depositInstructions,
      minDeposit: toMoney(settings.minDepositMinor, currency),
      currency,
      online: settings.depositOnlineEnabled
        ? {
            gateway: gatewayId,
            available: onlineAvailable,
            label: catalog?.label ?? gatewayId,
          }
        : null,
    };
  }

  /**
   * User reports a completed transfer against admin-published details.
   * Credits only after finance confirms via confirmManualDeposit (ledger-safe).
   */
  async createManualDeposit(
    userId: string,
    input: ManualDepositInput,
    ip?: string,
  ): Promise<PaymentView> {
    if (input.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return this.toView(existing);
    }

    const methods = await this.getDepositMethods();
    if (!methods.manualEnabled) {
      throw new BadRequestException("Manual deposits are disabled by admin");
    }
    if (input.channel === "MOBILE_MONEY" && !methods.mobile) {
      throw new BadRequestException("Mobile money deposits are not configured yet");
    }
    if (input.channel === "BANK_TRANSFER" && !methods.bank) {
      throw new BadRequestException("Bank transfer deposits are not configured yet");
    }
    if (input.amount < methods.minDeposit.amount) {
      throw new BadRequestException(
        `Minimum deposit is ${methods.minDeposit.amount} minor units (${methods.currency})`,
      );
    }
    if (input.currency !== methods.currency) {
      throw new BadRequestException(`Deposits must use ${methods.currency}`);
    }

    await this.ledger.ensureWallet(userId, input.currency);

    const amount = BigInt(input.amount);
    const reference = `PAY-MAN-${input.idempotencyKey ?? randomUUID()}`;

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        type: "WALLET_DEPOSIT",
        status: "UNDER_REVIEW",
        amount,
        currency: input.currency,
        gateway: "manual",
        reference,
        idempotencyKey: input.idempotencyKey ?? null,
        metadata: {
          channel: input.channel,
          payerReference: input.payerReference,
          submittedAt: new Date().toISOString(),
        },
      },
    });

    await this.audit.log({
      actorId: userId,
      action: "payment.manual_deposit_submitted",
      entityType: "Payment",
      entityId: payment.id,
      ip,
      metadata: {
        amount: input.amount,
        currency: input.currency,
        channel: input.channel,
      },
    });

    await this.notify(
      userId,
      "PAYMENT",
      "Deposit under review",
      `Your deposit of ${input.amount} ${input.currency} was submitted and is awaiting finance confirmation.`,
    );

    return this.toView(payment);
  }

  /** Finance confirms a manual deposit — credits wallet via applyPaid inside one transaction. */
  async confirmManualDeposit(
    paymentId: string,
    actorId: string,
    ip?: string,
  ): Promise<PaymentView> {
    const existing = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!existing) throw new NotFoundException("Payment not found");
    if (existing.gateway !== "manual") {
      throw new BadRequestException("Only manual payments can be confirmed this way");
    }
    if (
      existing.type !== "WALLET_DEPOSIT" &&
      existing.type !== "COURSE_PLAN_PURCHASE" &&
      existing.type !== "INVESTMENT_FUNDING"
    ) {
      throw new BadRequestException("This payment type cannot be confirmed manually");
    }
    if (existing.status === "PAID") return this.toView(existing);
    if (!["UNDER_REVIEW", "PENDING"].includes(existing.status)) {
      throw new BadRequestException(`Cannot confirm a ${existing.status} payment`);
    }

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!fresh) throw new NotFoundException("Payment not found");
      if (fresh.status === "PAID") return;
      await this.applyPaid(tx, fresh);
    });

    const updated = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

    const notifyCopy =
      updated.type === "COURSE_PLAN_PURCHASE"
        ? {
            action: "payment.manual_course_plan_confirmed" as const,
            title: "Plan payment confirmed",
            body: `Your Forex plan payment of ${Number(updated.amount)} ${updated.currency} was confirmed. Your courses are unlocked.`,
          }
        : updated.type === "INVESTMENT_FUNDING"
          ? {
              action: "payment.manual_investment_confirmed" as const,
              title: "Investment payment confirmed",
              body: `Your investment funding of ${Number(updated.amount)} ${updated.currency} was confirmed. Your plan is now active.`,
            }
          : {
              action: "payment.manual_deposit_confirmed" as const,
              title: "Deposit confirmed",
              body: `Your deposit of ${Number(updated.amount)} ${updated.currency} was confirmed and credited to your wallet.`,
            };

    await this.audit.log({
      actorId,
      action: notifyCopy.action,
      entityType: "Payment",
      entityId: paymentId,
      ip,
      metadata: {
        amount: Number(updated.amount),
        currency: updated.currency,
        userId: updated.userId,
        type: updated.type,
      },
    });

    await this.notify(updated.userId, "PAYMENT", notifyCopy.title, notifyCopy.body);

    return this.toView(updated);
  }

  // -------------------------------------------------------------------------
  // Wallet deposit — creates a WALLET_DEPOSIT intent; funds land on webhook.
  // -------------------------------------------------------------------------
  async createDeposit(userId: string, input: DepositInput, ip?: string): Promise<PaymentView> {
    if (input.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return this.toView(existing);
    }

    const methods = await this.getDepositMethods();
    if (!methods.onlineEnabled) {
      throw new BadRequestException("Online deposits are disabled by admin");
    }
    if (input.amount < methods.minDeposit.amount) {
      throw new BadRequestException(
        `Minimum deposit is ${methods.minDeposit.amount} minor units (${methods.currency})`,
      );
    }
    if (input.currency !== methods.currency) {
      throw new BadRequestException(`Deposits must use ${methods.currency}`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true, phone: true },
    });
    if (!user) throw new NotFoundException("User not found");

    // Ensure a wallet exists so the eventual CREDIT can post.
    await this.ledger.ensureWallet(userId, input.currency);

    const gatewayId = input.gateway || this.gateways.defaultOnlineGatewayId();
    const gateway = this.gateways.resolve(gatewayId);
    const amount = BigInt(input.amount);
    const reference = `PAY-${input.idempotencyKey ?? randomUUID()}`;

    const payment = await this.prisma.$transaction(async (tx) => {
      return tx.payment.create({
        data: {
          userId,
          type: "WALLET_DEPOSIT",
          status: "INITIATED",
          amount,
          currency: input.currency,
          gateway: gateway.id,
          reference,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });
    });

    try {
      const intent = await gateway.createIntent({
        userId,
        amount,
        currency: input.currency,
        reference,
        type: "WALLET_DEPOSIT",
        customer: { email: user.email, name: user.fullName, phone: user.phone },
      });

      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: intent.providerRef,
          checkoutUrl: intent.checkoutUrl,
          status: "PENDING",
        },
      });

      await this.audit.log({
        actorId: userId,
        action: "payment.deposit_initiated",
        entityType: "Payment",
        entityId: payment.id,
        ip,
        metadata: { amount: input.amount, currency: input.currency, gateway: gateway.id },
      });

      return this.toView(updated);
    } catch (err) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Course checkout — FREE enrolls instantly; WALLET debits atomically; PAYMENT
  // opens a gateway intent and grants access on webhook.
  // -------------------------------------------------------------------------
  async createCourseCheckout(
    userId: string,
    input: CourseCheckoutInput,
    ip?: string,
  ): Promise<CourseCheckoutResult> {
    if (input.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return {
          payment: this.toView(existing),
          enrolled: existing.status === "PAID",
          checkoutUrl: existing.checkoutUrl ?? null,
        };
      }
    }

    const course = await this.prisma.course.findUnique({ where: { id: input.courseId } });
    if (!course) throw new NotFoundException("Course not found");
    if (course.status !== "PUBLISHED") throw new BadRequestException("Course is not available");

    const already = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
    });
    if (already) throw new ConflictException("Already enrolled in this course");

    // FREE courses need no payment at all.
    if (course.accessType === "FREE") {
      await this.prisma.enrollment.create({ data: { userId, courseId: course.id } });
      await this.notify(userId, "COURSE", "Course unlocked", `You now have access to ${course.title}.`);
      return { payment: null, enrolled: true, checkoutUrl: null };
    }

    const { amount, currency } = await this.priceFor(course, input.couponCode);
    const reference = `PAY-${input.idempotencyKey ?? randomUUID()}`;

    if (input.source === "WALLET") {
      await this.ledger.ensureWallet(userId, currency);
      const payment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            userId,
            type: "COURSE_PURCHASE",
            status: "PAID",
            amount,
            currency,
            gateway: "wallet",
            reference,
            idempotencyKey: input.idempotencyKey ?? null,
            courseId: course.id,
            paidAt: new Date(),
          },
        });
        // Debit the wallet (rejected by the ledger if it would overdraw).
        if (amount > 0n) {
          await this.ledger.post(tx, {
            userId,
            direction: "DEBIT",
            type: "COURSE_PURCHASE",
            amount,
            currency,
            reference,
            paymentId: created.id,
          });
        }
        await tx.enrollment.create({ data: { userId, courseId: course.id, paymentId: created.id } });
        return created;
      });

      await this.audit.log({
        actorId: userId,
        action: "payment.course_purchased",
        entityType: "Payment",
        entityId: payment.id,
        ip,
        metadata: { source: "WALLET", courseId: course.id, amount: Number(amount) },
      });
      await this.notify(userId, "COURSE", "Course unlocked", `You now have access to ${course.title}.`);

      return { payment: this.toView(payment), enrolled: true, checkoutUrl: null };
    }

    // source === PAYMENT
    const gateway = this.gateways.resolve(input.gateway);
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        type: "COURSE_PURCHASE",
        status: "INITIATED",
        amount,
        currency,
        gateway: gateway.id,
        reference,
        idempotencyKey: input.idempotencyKey ?? null,
        courseId: course.id,
      },
    });
    const intent = await gateway.createIntent({
      userId,
      amount,
      currency,
      reference,
      type: "COURSE_PURCHASE",
      metadata: { courseId: course.id },
    });
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: intent.providerRef, checkoutUrl: intent.checkoutUrl, status: "PENDING" },
    });

    await this.audit.log({
      actorId: userId,
      action: "payment.course_checkout_initiated",
      entityType: "Payment",
      entityId: payment.id,
      ip,
      metadata: { source: "PAYMENT", courseId: course.id, amount: Number(amount), gateway: gateway.id },
    });

    return { payment: this.toView(updated), enrolled: false, checkoutUrl: intent.checkoutUrl };
  }

  /**
   * Dev-only authenticated helper for mock checkout return page.
   * Never available in production (ALLOW_MOCK_PAYMENTS forced false).
   * Still settles through the signed webhook path — not a client-side confirm.
   */
  async simulateMockPayment(
    userId: string,
    role: UserRole,
    input: MockPaymentSimulateInput,
  ): Promise<{ status: "processed" | "already_processed" | "ignored" }> {
    if (!this.config.get<boolean>("ALLOW_MOCK_PAYMENTS")) {
      throw new ForbiddenException("Mock payment simulation is disabled");
    }

    const payment = await this.prisma.payment.findFirst({
      where: { reference: input.reference },
    });
    if (!payment) throw new NotFoundException("Payment not found");

    const isFinance = role === Role.FINANCE_ADMIN || role === Role.SUPER_ADMIN;
    if (payment.userId !== userId && !isFinance) {
      throw new ForbiddenException("Not allowed to simulate this payment");
    }
    if (payment.gateway !== "mock") {
      throw new BadRequestException("Only mock gateway payments can be simulated");
    }
    if (payment.status === "PAID" || payment.status === "FAILED" || payment.status === "CANCELLED") {
      throw new ConflictException(`Payment already ${payment.status}`);
    }

    const secret = this.config.get<string>("PAYMENT_WEBHOOK_SECRET") ?? "";
    const rawBody = JSON.stringify({
      paymentReference: payment.reference,
      status: input.status,
      eventId: `mock_sim_${payment.reference}_${input.status}_${randomUUID()}`,
    });

    return this.handleWebhook("mock", rawBody, {
      "x-volt-webhook-secret": secret,
    });
  }

  // -------------------------------------------------------------------------
  // Webhook — the ONLY place a payment is confirmed. Idempotent + atomic.
  // -------------------------------------------------------------------------
  async handleWebhook(
    gatewayId: string,
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ status: "processed" | "already_processed" | "ignored" }> {
    // Mock driver is a local/dev tool only — never settle mock events when disabled.
    if (gatewayId === "mock" && !this.config.get<boolean>("ALLOW_MOCK_PAYMENTS")) {
      throw new ForbiddenException("Mock payment gateway is disabled");
    }

    const gateway = this.gateways.resolve(gatewayId);
    const verification = gateway.verifyWebhook(rawBody, headers);
    if (!verification.ok) {
      throw new BadRequestException("Webhook verification failed");
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [{ reference: verification.providerRef }, { providerRef: verification.providerRef }],
      },
    });
    if (!payment) throw new NotFoundException("Payment not found for webhook");

    // Fast path: skip if this provider event was already applied.
    const seen = await this.prisma.processedWebhookEvent.findUnique({
      where: { gateway_eventId: { gateway: gateway.id, eventId: verification.eventId } },
    });
    if (seen) return { status: "already_processed" };

    try {
      await this.prisma.$transaction(async (tx) => {
        // Unique (gateway, eventId): a concurrent processor makes this throw P2002.
        await tx.processedWebhookEvent.create({
          data: { gateway: gateway.id, eventId: verification.eventId, paymentId: payment.id },
        });

        const fresh = await tx.payment.findUnique({ where: { id: payment.id } });
        if (!fresh) throw new NotFoundException("Payment not found");
        if (fresh.status === "PAID") return; // already settled — nothing to do

        if (verification.status === "PAID") {
          await this.applyPaid(tx, fresh);
        } else if (verification.status === "FAILED") {
          await tx.payment.update({ where: { id: fresh.id }, data: { status: "FAILED" } });
        } else {
          await tx.payment.update({ where: { id: fresh.id }, data: { status: "PENDING" } });
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { status: "already_processed" };
      }
      throw e;
    }

    // Best-effort side effects AFTER the money is committed.
    if (verification.status === "PAID") {
      await this.audit.log({
        actorId: payment.userId,
        action: "payment.confirmed",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { gateway: gateway.id, eventId: verification.eventId, type: payment.type },
      });
      await this.notify(
        payment.userId,
        "PAYMENT",
        "Payment confirmed",
        `Your ${payment.type.replace(/_/g, " ").toLowerCase()} of ${Number(payment.amount)} ${payment.currency} was confirmed.`,
      );
    }

    return { status: verification.status === "PENDING" ? "ignored" : "processed" };
  }

  /** Apply the effects of a confirmed payment. MUST run inside a transaction. */
  private async applyPaid(tx: Tx, payment: Payment): Promise<void> {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", paidAt: new Date() },
    });

    if (payment.type === "WALLET_DEPOSIT") {
      await this.ledger.ensureWallet(payment.userId, payment.currency, tx);
      await this.ledger.post(tx, {
        userId: payment.userId,
        direction: "CREDIT",
        type: "DEPOSIT",
        amount: payment.amount,
        currency: payment.currency,
        reference: payment.reference,
        paymentId: payment.id,
      });
      return;
    }

    if (payment.type === "COURSE_PURCHASE" && payment.courseId) {
      const existing = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
      });
      if (!existing) {
        await tx.enrollment.create({
          data: { userId: payment.userId, courseId: payment.courseId, paymentId: payment.id },
        });
      }
      return;
    }

    if (payment.type === "COURSE_PLAN_PURCHASE" && payment.coursePlanId) {
      await tx.coursePlanSubscription.updateMany({
        where: { userId: payment.userId, status: "ACTIVE" },
        data: { status: "CANCELLED", endsAt: new Date() },
      });
      await tx.coursePlanSubscription.create({
        data: {
          userId: payment.userId,
          coursePlanId: payment.coursePlanId,
          status: "ACTIVE",
          paymentId: payment.id,
        },
      });
      const plan = await tx.coursePlan.findUniqueOrThrow({
        where: { id: payment.coursePlanId },
      });
      const courses = await tx.course.findMany({
        where: {
          status: "PUBLISHED",
          coursePlan: { sortOrder: { lte: plan.sortOrder } },
        },
        select: { id: true },
      });
      for (const course of courses) {
        const existing = await tx.enrollment.findUnique({
          where: {
            userId_courseId: { userId: payment.userId, courseId: course.id },
          },
        });
        if (!existing) {
          await tx.enrollment.create({
            data: {
              userId: payment.userId,
              courseId: course.id,
              paymentId: payment.id,
            },
          });
        } else if (existing.status === "REVOKED") {
          await tx.enrollment.update({
            where: { id: existing.id },
            data: { status: "ACTIVE" },
          });
        }
      }
      return;
    }

    if (payment.type === "INVESTMENT_FUNDING") {
      // Activate the PENDING investment funded by this payment.
      const investment = await tx.investment.findFirst({ where: { paymentId: payment.id } });
      if (investment && investment.status === "PENDING") {
        const opportunity = await tx.opportunity.findUnique({
          where: { id: investment.opportunityId },
        });
        await tx.investment.update({
          where: { id: investment.id },
          data: {
            status: "ACTIVE",
            maturesAt: new Date(Date.now() + (opportunity?.durationDays ?? 0) * DAY_MS),
          },
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------
  async listMine(userId: string): Promise<PaymentView[]> {
    const items = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return items.map((p) => this.toView(p));
  }

  async listAll(
    filters: { status?: PaymentStatus; type?: PaymentType },
    page: number,
    pageSize: number,
  ) {
    const where: Prisma.PaymentWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, fullName: true, email: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      data: items.map((p) => ({ ...this.toView(p), user: p.user })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async getById(id: string, userId: string, role: UserRole): Promise<PaymentView> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.userId !== userId && !ADMIN_ROLES.includes(role)) {
      throw new ForbiddenException("Not allowed to view this payment");
    }
    return this.toView(payment);
  }

  // -------------------------------------------------------------------------
  // Admin CRUD (intents only — PAID is webhook-only)
  // -------------------------------------------------------------------------
  async adminCreate(actorId: string, input: AdminCreatePaymentInput, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new NotFoundException("User not found");

    if (input.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      });
      if (existing) return { ...this.toView(existing), user: existing.user };
    }

    if (input.type === "COURSE_PURCHASE" && !input.courseId) {
      throw new BadRequestException("courseId is required for COURSE_PURCHASE");
    }
    if (input.type === "INVESTMENT_FUNDING" && !input.opportunityId) {
      throw new BadRequestException("opportunityId is required for INVESTMENT_FUNDING");
    }

    await this.ledger.ensureWallet(input.userId, input.currency);

    const gateway = this.gateways.resolve(input.gateway);
    const amount = BigInt(input.amount);
    const reference = `PAY-${input.idempotencyKey ?? randomUUID()}`;

    const payment = await this.prisma.payment.create({
      data: {
        userId: input.userId,
        type: input.type,
        status: "INITIATED",
        amount,
        currency: input.currency,
        gateway: gateway.id,
        reference,
        idempotencyKey: input.idempotencyKey ?? null,
        courseId: input.courseId ?? null,
        opportunityId: input.opportunityId ?? null,
      },
    });

    const intent = await gateway.createIntent({
      userId: input.userId,
      amount,
      currency: input.currency,
      reference,
      type: input.type,
    });

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: intent.providerRef,
        checkoutUrl: intent.checkoutUrl,
        status: "PENDING",
      },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });

    await this.audit.log({
      actorId,
      action: "payment.admin_created",
      entityType: "Payment",
      entityId: payment.id,
      ip,
      metadata: {
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        userId: input.userId,
        gateway: gateway.id,
      },
    });

    return { ...this.toView(updated), user: updated.user };
  }

  async adminUpdate(id: string, actorId: string, input: AdminUpdatePaymentInput, ip?: string) {
    const existing = await this.prisma.payment.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (!existing) throw new NotFoundException("Payment not found");

    if (existing.status === "PAID" || existing.status === "REFUNDED") {
      throw new BadRequestException(
        `Cannot update a ${existing.status} payment from admin. Confirmation/refunds are ledger-aware flows.`,
      );
    }

    if (input.status === "PENDING" && !["INITIATED", "UNDER_REVIEW", "FAILED"].includes(existing.status)) {
      throw new BadRequestException(`Cannot move ${existing.status} back to PENDING`);
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.gateway !== undefined ? { gateway: input.gateway } : {}),
      },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });

    await this.audit.log({
      actorId,
      action: "payment.admin_updated",
      entityType: "Payment",
      entityId: id,
      ip,
      metadata: { fields: Object.keys(input), from: existing.status, to: updated.status },
    });

    return { ...this.toView(updated), user: updated.user };
  }

  async adminDelete(id: string, actorId: string, ip?: string) {
    const existing = await this.prisma.payment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Payment not found");

    const deletable: PaymentStatus[] = ["INITIATED", "PENDING", "FAILED", "CANCELLED", "UNDER_REVIEW"];
    if (!deletable.includes(existing.status)) {
      throw new BadRequestException(
        `Cannot delete a ${existing.status} payment. Paid/refunded records stay for audit.`,
      );
    }

    await this.prisma.payment.delete({ where: { id } });

    await this.audit.log({
      actorId,
      action: "payment.admin_deleted",
      entityType: "Payment",
      entityId: id,
      ip,
      metadata: {
        status: existing.status,
        type: existing.type,
        amount: Number(existing.amount),
        reference: existing.reference,
      },
    });

    return { id, deleted: true as const };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private async priceFor(
    course: Course,
    couponCode?: string,
  ): Promise<{ amount: bigint; currency: Course["priceCurrency"] }> {
    let amount = course.priceAmount;
    if (couponCode) {
      const coupon = await this.prisma.coupon.findUnique({ where: { code: couponCode } });
      if (coupon && this.couponUsable(coupon)) {
        if (coupon.percentOff) amount -= (amount * BigInt(coupon.percentOff)) / 100n;
        if (coupon.amountOff) amount -= coupon.amountOff;
        if (amount < 0n) amount = 0n;
      }
    }
    return { amount, currency: course.priceCurrency };
  }

  private couponUsable(coupon: Coupon): boolean {
    if (!coupon.active) return false;
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return false;
    if (coupon.maxRedemptions !== null && coupon.redemptions >= coupon.maxRedemptions) return false;
    return true;
  }

  private async notify(userId: string, type: Parameters<NotificationsService["create"]>[0]["type"], title: string, body: string): Promise<void> {
    try {
      await this.notifications.create({ userId, type, title, body });
    } catch (err) {
      this.logger.warn(`Failed to create notification for ${userId}: ${String(err)}`);
    }
  }
}
