import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Currency, LedgerDirection, LedgerEntry, LedgerEntryType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type Tx = Prisma.TransactionClient;

export interface PostEntryParams {
  userId: string;
  direction: LedgerDirection;
  type: LedgerEntryType;
  amount: bigint; // always positive minor units
  currency: Currency;
  reference?: string;
  paymentId?: string;
  investmentId?: string;
  withdrawalId?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * The financial core. `ledger_entries` is append-only; balances are always
 * derived: SUM(CREDIT) - SUM(DEBIT). Every posting MUST run inside a
 * `prisma.$transaction` so the ledger entry and its side effects are atomic.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ensure the user has a wallet (idempotent). */
  async ensureWallet(userId: string, currency: Currency, client: Tx | PrismaService = this.prisma) {
    const existing = await client.wallet.findUnique({ where: { userId } });
    if (existing) return existing;
    return client.wallet.create({ data: { userId, currency } });
  }

  /** Derived balance for a user, in minor units. */
  async getBalance(userId: string, client: Tx | PrismaService = this.prisma): Promise<bigint> {
    const grouped = await client.ledgerEntry.groupBy({
      by: ["direction"],
      where: { userId },
      _sum: { amount: true },
    });
    let credit = 0n;
    let debit = 0n;
    for (const row of grouped) {
      const sum = row._sum.amount ?? 0n;
      if (row.direction === "CREDIT") credit = sum;
      else debit = sum;
    }
    return credit - debit;
  }

  /**
   * Append a ledger entry inside an existing transaction, computing the running
   * balance. Debits are rejected if they would overdraw the wallet.
   */
  async post(tx: Tx, params: PostEntryParams): Promise<LedgerEntry> {
    if (params.amount <= 0n) {
      throw new BadRequestException("Ledger amount must be positive");
    }

    // Serialize money movements per wallet to prevent concurrent overdraft.
    await tx.$queryRaw`SELECT id FROM wallets WHERE user_id = ${params.userId} FOR UPDATE`;

    const wallet = await tx.wallet.findUnique({ where: { userId: params.userId } });
    if (!wallet) {
      throw new BadRequestException("Wallet not found for user");
    }

    const current = await this.getBalance(params.userId, tx);
    const delta = params.direction === "CREDIT" ? params.amount : -params.amount;
    const balanceAfter = current + delta;

    if (params.direction === "DEBIT" && balanceAfter < 0n) {
      throw new BadRequestException("Insufficient wallet balance");
    }

    return tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        userId: params.userId,
        direction: params.direction,
        type: params.type,
        amount: params.amount,
        currency: params.currency,
        balanceAfter,
        reference: params.reference,
        paymentId: params.paymentId,
        investmentId: params.investmentId,
        withdrawalId: params.withdrawalId,
        metadata: params.metadata,
      },
    });
  }

  /** Paginated statement for a user. */
  async statement(userId: string, page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ledgerEntry.count({ where: { userId } }),
    ]);
    return { items, total };
  }
}
