import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { Investment, Opportunity, Payment } from "@prisma/client";
import type { CreateInvestmentInput } from "@volt/validation";
import type { InvestmentView, PaymentView, PortfolioSummary } from "@volt/types";
import { PrismaService } from "../../prisma/prisma.service";
import { LedgerService } from "../ledger/ledger.service";
import { AuditService } from "../audit/audit.service";
import { GatewayRegistry } from "../payments/gateways/gateway.registry";
import { toOpportunitySummary } from "../opportunities/opportunity.mapper";
import { applyMultiplier, toMoney } from "../../common/money";

type InvestmentWithOpportunity = Investment & { opportunity: Opportunity };

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InvestmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly gateways: GatewayRegistry,
    private readonly config: ConfigService,
  ) {}

  private toView(inv: InvestmentWithOpportunity): InvestmentView {
    return {
      id: inv.id,
      opportunity: toOpportunitySummary(inv.opportunity),
      principal: toMoney(inv.principalAmount, inv.currency),
      projectedValue: toMoney(inv.projectedValue, inv.currency),
      status: inv.status,
      createdAt: inv.createdAt.toISOString(),
      maturesAt: inv.maturesAt ? inv.maturesAt.toISOString() : null,
      settledValue: inv.settledValue !== null ? toMoney(inv.settledValue, inv.currency) : null,
    };
  }

  private toPaymentView(payment: Payment): PaymentView {
    return {
      id: payment.id,
      type: payment.type,
      status: payment.status,
      amount: toMoney(payment.amount, payment.currency),
      gateway: payment.gateway,
      reference: payment.reference,
      checkoutUrl: payment.checkoutUrl ?? null,
      createdAt: payment.createdAt.toISOString(),
    };
  }

  /**
   * Create an investment. WALLET source debits the ledger and activates the
   * investment atomically; PAYMENT source creates a PENDING investment + a
   * funding payment (activated later by the payments webhook).
   * The projectionMultiplier is a target, never a guarantee.
   */
  async create(
    userId: string,
    input: CreateInvestmentInput,
    ip?: string,
  ): Promise<InvestmentView | { investment: InvestmentView; payment: PaymentView }> {
    if (!this.config.get<boolean>("FEATURE_REAL_MONEY_INVESTMENTS")) {
      throw new ForbiddenException(
        "Real-money investments are disabled until compliance review. Set FEATURE_REAL_MONEY_INVESTMENTS=true to enable.",
      );
    }

    // Idempotency: a replayed request must not double-process.
    if (input.idempotencyKey) {
      const existing = await this.prisma.investment.findUnique({
        where: { reference: `INV-${input.idempotencyKey}` },
        include: { opportunity: true },
      });
      if (existing) {
        if (existing.paymentId) {
          const payment = await this.prisma.payment.findUnique({
            where: { id: existing.paymentId },
          });
          return {
            investment: this.toView(existing),
            payment: payment ? this.toPaymentView(payment) : (undefined as never),
          };
        }
        return this.toView(existing);
      }
    }

    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: input.opportunityId },
    });
    if (!opportunity) throw new NotFoundException("Opportunity not found");
    if (opportunity.status !== "OPEN") {
      throw new BadRequestException("This opportunity is not open for investment");
    }

    const amount = BigInt(input.amount);
    if (amount < opportunity.minAmount) {
      throw new BadRequestException(
        `Amount is below the minimum of ${Number(opportunity.minAmount)}`,
      );
    }
    if (opportunity.maxAmount !== null && amount > opportunity.maxAmount) {
      throw new BadRequestException(
        `Amount exceeds the maximum of ${Number(opportunity.maxAmount)}`,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.kycStatus !== "APPROVED") {
      throw new ForbiddenException("KYC verification required");
    }

    const multiplier = Number(opportunity.projectionMultiplier);
    const projectedValue = applyMultiplier(amount, multiplier);
    const reference = `INV-${input.idempotencyKey ?? randomUUID()}`;
    const currency = opportunity.currency;

    if (input.source === "WALLET") {
      const investment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.investment.create({
          data: {
            userId,
            opportunityId: opportunity.id,
            principalAmount: amount,
            currency,
            multiplierSnapshot: opportunity.projectionMultiplier,
            projectedValue,
            status: "ACTIVE",
            reference,
            maturesAt: new Date(Date.now() + opportunity.durationDays * DAY_MS),
          },
          include: { opportunity: true },
        });
        // Debits are rejected by the ledger if they would overdraw the wallet.
        await this.ledger.post(tx, {
          userId,
          direction: "DEBIT",
          type: "INVESTMENT_FUNDING",
          amount,
          currency,
          reference,
          investmentId: created.id,
        });
        return created;
      });

      await this.audit.log({
        actorId: userId,
        action: "investment.created",
        entityType: "Investment",
        entityId: investment.id,
        ip,
        metadata: { source: "WALLET", opportunityId: opportunity.id, amount: input.amount },
      });

      return this.toView(investment);
    }

    // source === PAYMENT — funding via a fresh payment intent (confirmed by webhook).
    const paymentReference = `PAY-${input.idempotencyKey ?? randomUUID()}`;
    const gateway = this.gateways.resolve();
    const result = await this.prisma.$transaction(async (tx) => {
      const investment = await tx.investment.create({
        data: {
          userId,
          opportunityId: opportunity.id,
          principalAmount: amount,
          currency,
          multiplierSnapshot: opportunity.projectionMultiplier,
          projectedValue,
          status: "PENDING",
          reference,
        },
        include: { opportunity: true },
      });
      const payment = await tx.payment.create({
        data: {
          userId,
          type: "INVESTMENT_FUNDING",
          status: "INITIATED",
          amount,
          currency,
          gateway: gateway.id,
          reference: paymentReference,
          idempotencyKey: input.idempotencyKey ?? null,
          opportunityId: opportunity.id,
          metadata: { investmentId: investment.id },
        },
      });
      const linked = await tx.investment.update({
        where: { id: investment.id },
        data: { paymentId: payment.id },
        include: { opportunity: true },
      });
      return { investment: linked, payment };
    });

    const intent = await gateway.createIntent({
      userId,
      amount,
      currency,
      reference: paymentReference,
      type: "INVESTMENT_FUNDING",
    });
    const payment = await this.prisma.payment.update({
      where: { id: result.payment.id },
      data: {
        providerRef: intent.providerRef,
        checkoutUrl: intent.checkoutUrl,
        status: "PENDING",
      },
    });

    await this.audit.log({
      actorId: userId,
      action: "investment.created",
      entityType: "Investment",
      entityId: result.investment.id,
      ip,
      metadata: { source: "PAYMENT", opportunityId: opportunity.id, amount: input.amount },
    });

    return {
      investment: this.toView(result.investment),
      payment: this.toPaymentView(payment),
    };
  }

  async getMine(userId: string, id: string): Promise<InvestmentView> {
    const investment = await this.prisma.investment.findUnique({
      where: { id },
      include: { opportunity: true },
    });
    if (!investment) throw new NotFoundException("Investment not found");
    if (investment.userId !== userId) {
      throw new ForbiddenException("You do not have access to this investment");
    }
    return this.toView(investment);
  }

  async listMine(userId: string): Promise<InvestmentView[]> {
    const items = await this.prisma.investment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { opportunity: true },
    });
    return items.map((i) => this.toView(i));
  }

  /** Portfolio summary. Aggregated in the wallet currency. */
  async portfolio(userId: string): Promise<PortfolioSummary> {
    const [balance, wallet, open] = await Promise.all([
      this.ledger.getBalance(userId),
      this.prisma.wallet.findUnique({ where: { userId } }),
      this.prisma.investment.findMany({
        where: { userId, status: { in: ["ACTIVE", "MATURED"] } },
      }),
    ]);

    const currency = wallet?.currency ?? "TZS";
    let totalInvested = 0n;
    let projected = 0n;
    let activeCount = 0;
    for (const inv of open) {
      totalInvested += inv.principalAmount;
      projected += inv.projectedValue;
      if (inv.status === "ACTIVE") activeCount += 1;
    }

    return {
      walletBalance: toMoney(balance, currency),
      totalInvested: toMoney(totalInvested, currency),
      activeInvestments: activeCount,
      projectedPortfolioValue: toMoney(projected, currency),
    };
  }

  /** Admin — every investment, paginated. */
  async listAll(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.investment.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          opportunity: true,
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.investment.count(),
    ]);
    return {
      data: items.map((i) => ({ ...this.toView(i), user: i.user })),
      meta: { page, pageSize, total },
    };
  }

  /** Admin — settle an investment: set SETTLED + credit the settled value to the wallet. */
  async settle(id: string, settledValue: number, actorId: string, ip?: string): Promise<InvestmentView> {
    const investment = await this.prisma.investment.findUnique({ where: { id } });
    if (!investment) throw new NotFoundException("Investment not found");
    if (investment.status === "SETTLED") {
      throw new ConflictException("Investment is already settled");
    }
    if (investment.status !== "ACTIVE" && investment.status !== "MATURED") {
      throw new BadRequestException("Only active investments can be settled");
    }

    const settledBig = BigInt(settledValue);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.investment.update({
        where: { id },
        data: {
          status: "SETTLED",
          settledValue: settledBig,
          settledAt: new Date(),
        },
        include: { opportunity: true },
      });
      // A settled value of 0 (total loss) posts no credit — the ledger rejects zero amounts.
      if (settledBig > 0n) {
        await this.ledger.post(tx, {
          userId: investment.userId,
          direction: "CREDIT",
          type: "INVESTMENT_SETTLEMENT",
          amount: settledBig,
          currency: investment.currency,
          reference: investment.reference,
          investmentId: investment.id,
        });
      }
      return result;
    });

    await this.audit.log({
      actorId,
      action: "investment.settled",
      entityType: "Investment",
      entityId: id,
      ip,
      metadata: { settledValue },
    });

    return this.toView(updated);
  }
}
