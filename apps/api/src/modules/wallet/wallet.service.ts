import { Injectable } from "@nestjs/common";
import type { Currency, LedgerEntry } from "@prisma/client";
import { DEFAULT_CURRENCY } from "@volt/config";
import type { LedgerEntryView, WalletView } from "@volt/types";
import { PrismaService } from "../../prisma/prisma.service";
import { LedgerService } from "../ledger/ledger.service";
import { toMoney } from "../../common/money";

/**
 * Read-side of the wallet. The balance is ALWAYS derived from the append-only
 * ledger (SUM(credit) - SUM(debit)) — there is no stored balance column.
 * All money movement happens in the ledger/payments/withdrawals services.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  private toEntryView(e: LedgerEntry): LedgerEntryView {
    return {
      id: e.id,
      type: e.type,
      direction: e.direction,
      amount: toMoney(e.amount, e.currency),
      balanceAfter: toMoney(e.balanceAfter, e.currency),
      reference: e.reference ?? null,
      createdAt: e.createdAt.toISOString(),
    };
  }

  /** Current wallet view: derived balance + wallet currency. */
  async getWallet(userId: string): Promise<WalletView> {
    const [wallet, balance] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { userId } }),
      this.ledger.getBalance(userId),
    ]);
    const currency = (wallet?.currency ?? DEFAULT_CURRENCY) as Currency;
    return { balance: toMoney(balance, currency), currency };
  }

  /** Paginated ledger statement for the user's wallet. */
  async transactions(userId: string, page: number, pageSize: number) {
    const { items, total } = await this.ledger.statement(userId, page, pageSize);
    return {
      data: items.map((e) => this.toEntryView(e)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
}
