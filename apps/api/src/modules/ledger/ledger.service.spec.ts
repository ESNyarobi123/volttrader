import { BadRequestException } from "@nestjs/common";
import { LedgerService } from "./ledger.service";

describe("LedgerService.post", () => {
  it("locks wallet row before reading balance and rejects overdraft", async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ id: "w1" }]);
    const findUnique = jest.fn().mockResolvedValue({ id: "w1", userId: "u1", currency: "USD" });
    const groupBy = jest.fn().mockResolvedValue([
      { direction: "CREDIT", _sum: { amount: 1000n } },
      { direction: "DEBIT", _sum: { amount: 0n } },
    ]);
    const create = jest.fn();

    const tx = {
      $queryRaw: queryRaw,
      wallet: { findUnique },
      ledgerEntry: { groupBy, create },
    };

    const service = new LedgerService({} as never);

    await expect(
      service.post(tx as never, {
        userId: "u1",
        direction: "DEBIT",
        type: "WITHDRAWAL",
        amount: 5000n,
        currency: "USD",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(queryRaw).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("posts credit after lock when funds are sufficient", async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ id: "w1" }]);
    const findUnique = jest.fn().mockResolvedValue({ id: "w1", userId: "u1", currency: "USD" });
    const groupBy = jest.fn().mockResolvedValue([
      { direction: "CREDIT", _sum: { amount: 10_000n } },
      { direction: "DEBIT", _sum: { amount: 0n } },
    ]);
    const create = jest.fn().mockResolvedValue({ id: "le1" });

    const tx = {
      $queryRaw: queryRaw,
      wallet: { findUnique },
      ledgerEntry: { groupBy, create },
    };

    const service = new LedgerService({} as never);
    const entry = await service.post(tx as never, {
      userId: "u1",
      direction: "DEBIT",
      type: "INVESTMENT_FUNDING",
      amount: 2500n,
      currency: "USD",
    });

    expect(entry).toEqual({ id: "le1" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 2500n,
          direction: "DEBIT",
          balanceAfter: 7500n,
        }),
      }),
    );
  });
});
