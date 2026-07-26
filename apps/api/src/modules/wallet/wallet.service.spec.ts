import { WalletService } from "./wallet.service";

const entry = (over: Record<string, unknown> = {}) => ({
  id: "le1",
  type: "DEPOSIT",
  direction: "CREDIT",
  amount: 5_000n,
  balanceAfter: 5_000n,
  currency: "TZS",
  reference: "PAY-1",
  createdAt: new Date("2024-01-02T03:04:05.000Z"),
  ...over,
});

describe("WalletService.getWallet", () => {
  it("returns the derived ledger balance in the wallet currency", async () => {
    const findUnique = jest.fn().mockResolvedValue({ userId: "u1", currency: "USD" });
    const getBalance = jest.fn().mockResolvedValue(12_345n);

    const service = new WalletService({ wallet: { findUnique } } as never, { getBalance } as never);

    await expect(service.getWallet("u1")).resolves.toEqual({
      balance: { amount: 12_345, currency: "USD" },
      currency: "USD",
    });
    expect(getBalance).toHaveBeenCalledWith("u1");
  });

  it("falls back to TZS when the user has no wallet row yet", async () => {
    const service = new WalletService(
      { wallet: { findUnique: jest.fn().mockResolvedValue(null) } } as never,
      { getBalance: jest.fn().mockResolvedValue(0n) } as never,
    );

    await expect(service.getWallet("u1")).resolves.toEqual({
      balance: { amount: 0, currency: "TZS" },
      currency: "TZS",
    });
  });
});

describe("WalletService.transactions", () => {
  it("maps ledger entries to the wire shape and paginates", async () => {
    const statement = jest.fn().mockResolvedValue({ items: [entry()], total: 25 });
    const service = new WalletService({} as never, { statement } as never);

    const result = await service.transactions("u1", 2, 10);

    expect(statement).toHaveBeenCalledWith("u1", 2, 10);
    expect(result.data).toEqual([
      {
        id: "le1",
        type: "DEPOSIT",
        direction: "CREDIT",
        amount: { amount: 5_000, currency: "TZS" },
        balanceAfter: { amount: 5_000, currency: "TZS" },
        reference: "PAY-1",
        createdAt: "2024-01-02T03:04:05.000Z",
      },
    ]);
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 10,
      total: 25,
      totalPages: 3,
    });
  });

  it("normalises a missing reference to null and never reports fewer than one page", async () => {
    const service = new WalletService(
      {} as never,
      {
        statement: jest.fn().mockResolvedValue({ items: [entry({ reference: null })], total: 0 }),
      } as never,
    );

    const result = await service.transactions("u1", 1, 20);

    expect(result.data[0].reference).toBeNull();
    expect(result.meta.totalPages).toBe(1);
  });
});
