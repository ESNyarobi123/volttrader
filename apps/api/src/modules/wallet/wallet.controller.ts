import { Controller, Get, Query } from "@nestjs/common";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { WalletService } from "./wallet.service";

@Controller("wallet")
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  /** Derived balance for the signed-in user. */
  @Get()
  @Auth()
  get(@CurrentUser("id") userId: string) {
    return this.wallet.getWallet(userId);
  }

  /** Paginated ledger statement (recent transactions). */
  @Get("transactions")
  @Auth()
  transactions(
    @CurrentUser("id") userId: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    return this.wallet.transactions(userId, pageNum, size);
  }
}
