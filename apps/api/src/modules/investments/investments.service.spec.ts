import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InvestmentsService } from "./investments.service";

const OPPORTUNITY = {
  id: "o1",
  slug: "fx-growth",
  name: "FX Growth",
  summary: "Managed FX strategy",
  currency: "TZS",
  minAmount: 10_000n,
  maxAmount: 1_000_000n,
  durationDays: 30,
  projectionMultiplier: "5",
  projectionLabel: "Target performance",
  riskCategory: "HIGH",
  status: "OPEN",
};

const USER = { id: "u1", kycStatus: "APPROVED" };

const investment = (over: Record<string, unknown> = {}) => ({
  id: "i1",
  userId: "u1",
  opportunity: OPPORTUNITY,
  opportunityId: "o1",
  principalAmount: 100_000n,
  currency: "TZS",
  projectedValue: 500_000n,
  status: "ACTIVE",
  reference: "INV-k1",
  paymentId: null,
  createdAt: new Date("2024-03-01T00:00:00.000Z"),
  maturesAt: null,
  settledAt: null,
  settledValue: null,
  ...over,
});

const payment = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  type: "INVESTMENT_FUNDING",
  status: "PENDING",
  amount: 100_000n,
  currency: "TZS",
  gateway: "mock",
  reference: "PAY-k1",
  checkoutUrl: "https://pay.example/checkout",
  createdAt: new Date("2024-03-01T00:00:00.000Z"),
  ...over,
});

const harness = (
  over: {
    featureEnabled?: boolean;
    user?: unknown;
    opportunity?: unknown;
  } = {},
) => {
  const txInvestment = {
    create: jest.fn().mockResolvedValue(investment()),
    update: jest.fn().mockResolvedValue(investment({ paymentId: "p1", status: "PENDING" })),
  };
  const txPayment = {
    create: jest.fn().mockResolvedValue(payment({ status: "INITIATED" })),
  };
  const tx = { investment: txInvestment, payment: txPayment };

  const prisma = {
    investment: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([investment()]),
      count: jest.fn().mockResolvedValue(1),
      create: txInvestment.create,
      update: txInvestment.update,
    },
    payment: {
      findUnique: jest.fn().mockResolvedValue(payment()),
      update: jest.fn().mockResolvedValue(payment()),
    },
    opportunity: {
      findUnique: jest
        .fn()
        .mockResolvedValue(over.opportunity === undefined ? OPPORTUNITY : over.opportunity),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(over.user === undefined ? USER : over.user),
    },
    wallet: { findUnique: jest.fn().mockResolvedValue({ currency: "TZS" }) },
    $transaction: jest.fn().mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx)),
  };
  const ledger = {
    getBalance: jest.fn().mockResolvedValue(500_000n),
    post: jest.fn().mockResolvedValue({ id: "le1" }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const gateway = {
    id: "mock",
    createIntent: jest.fn().mockResolvedValue({
      providerRef: "prov-1",
      checkoutUrl: "https://pay.example/checkout",
    }),
  };
  const gateways = { resolve: jest.fn().mockReturnValue(gateway) };
  const config = {
    get: jest.fn().mockReturnValue(over.featureEnabled ?? true),
  };

  return {
    prisma,
    ledger,
    audit,
    gateway,
    gateways,
    tx,
    txPayment,
    service: new InvestmentsService(
      prisma as never,
      ledger as never,
      audit as never,
      gateways as never,
      config as never,
    ),
  };
};

const WALLET_INPUT = {
  opportunityId: "o1",
  amount: 100_000,
  source: "WALLET",
} as never;

describe("InvestmentsService.create — guards", () => {
  it("is blocked while the real-money feature flag is off", async () => {
    const h = harness({ featureEnabled: false });

    await expect(h.service.create("u1", WALLET_INPUT)).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires an existing, OPEN opportunity", async () => {
    await expect(
      harness({ opportunity: null }).service.create("u1", WALLET_INPUT),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      harness({
        opportunity: { ...OPPORTUNITY, status: "CLOSED" },
      }).service.create("u1", WALLET_INPUT),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("enforces the opportunity min and max amounts", async () => {
    const h = harness();

    await expect(
      h.service.create("u1", {
        opportunityId: "o1",
        amount: 1_000,
        source: "WALLET",
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      h.service.create("u1", {
        opportunityId: "o1",
        amount: 2_000_000,
        source: "WALLET",
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires a known user with APPROVED KYC", async () => {
    await expect(harness({ user: null }).service.create("u1", WALLET_INPUT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      harness({ user: { id: "u1", kycStatus: "PENDING" } }).service.create("u1", WALLET_INPUT),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("InvestmentsService.create — WALLET source", () => {
  it("activates the investment and debits the ledger atomically", async () => {
    const h = harness();

    const view = await h.service.create("u1", WALLET_INPUT, "10.0.0.1");

    expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(h.prisma.investment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          principalAmount: 100_000n,
          projectedValue: 500_000n,
          maturesAt: expect.any(Date),
        }),
      }),
    );
    expect(h.ledger.post).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        direction: "DEBIT",
        type: "INVESTMENT_FUNDING",
        amount: 100_000n,
        investmentId: "i1",
      }),
    );
    expect(h.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "investment.created",
        metadata: expect.objectContaining({ source: "WALLET" }),
      }),
    );
    expect(view).toEqual(
      expect.objectContaining({
        principal: { amount: 100_000, currency: "TZS" },
        projectedValue: { amount: 500_000, currency: "TZS" },
        status: "ACTIVE",
      }),
    );
  });

  it("snapshots the projection multiplier onto the row", async () => {
    const h = harness();

    await h.service.create("u1", WALLET_INPUT);

    expect(h.prisma.investment.create.mock.calls[0][0].data.multiplierSnapshot).toBe("5");
  });

  it("replays an idempotent wallet investment instead of re-debiting", async () => {
    const h = harness();
    h.prisma.investment.findUnique.mockResolvedValue(investment());

    const view = await h.service.create("u1", {
      ...(WALLET_INPUT as object),
      idempotencyKey: "k1",
    } as never);

    expect(h.prisma.investment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reference: "INV-k1" } }),
    );
    expect(h.ledger.post).not.toHaveBeenCalled();
    expect(view).toEqual(expect.objectContaining({ id: "i1" }));
  });

  it("replays an idempotent payment-funded investment with its payment", async () => {
    const h = harness();
    h.prisma.investment.findUnique.mockResolvedValue(
      investment({ status: "PENDING", paymentId: "p1" }),
    );

    const result = (await h.service.create("u1", {
      ...(WALLET_INPUT as object),
      idempotencyKey: "k1",
    } as never)) as { investment: unknown; payment: { id: string } };

    expect(result.payment.id).toBe("p1");
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("InvestmentsService.create — PAYMENT source", () => {
  it("creates a PENDING investment plus a gateway intent, then stores the checkout URL", async () => {
    const h = harness();

    const result = (await h.service.create("u1", {
      opportunityId: "o1",
      amount: 100_000,
      source: "PAYMENT",
      idempotencyKey: "k1",
    } as never)) as {
      investment: { status: string };
      payment: { checkoutUrl: string | null };
    };

    expect(h.prisma.investment.create.mock.calls[0][0].data.status).toBe("PENDING");
    expect(h.txPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "INVESTMENT_FUNDING",
          status: "INITIATED",
          gateway: "mock",
          reference: "PAY-k1",
          idempotencyKey: "k1",
        }),
      }),
    );
    expect(h.gateway.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "PAY-k1", amount: 100_000n }),
    );
    expect(h.prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: {
        providerRef: "prov-1",
        checkoutUrl: "https://pay.example/checkout",
        status: "PENDING",
      },
    });
    // The ledger is only touched once a verified webhook confirms the payment.
    expect(h.ledger.post).not.toHaveBeenCalled();
    expect(result.payment.checkoutUrl).toBe("https://pay.example/checkout");
  });
});

describe("InvestmentsService reads", () => {
  it("returns the caller's own investment", async () => {
    const h = harness();
    h.prisma.investment.findUnique.mockResolvedValue(investment());

    await expect(h.service.getMine("u1", "i1")).resolves.toEqual(
      expect.objectContaining({ id: "i1" }),
    );
  });

  it("hides another user's investment", async () => {
    const h = harness();
    h.prisma.investment.findUnique.mockResolvedValue(investment({ userId: "someone-else" }));

    await expect(h.service.getMine("u1", "i1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws NotFound for an unknown investment", async () => {
    const h = harness();

    await expect(h.service.getMine("u1", "nope")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lists the caller's investments newest first", async () => {
    const h = harness();

    await h.service.listMine("u1");

    expect(h.prisma.investment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("paginates the admin list and keeps the user summary", async () => {
    const h = harness();
    h.prisma.investment.findMany.mockResolvedValue([
      investment({ user: { id: "u1", fullName: "Asha", email: "asha@x.io" } }),
    ]);

    const result = await h.service.listAll(2, 5);

    expect(h.prisma.investment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
    expect(result.meta).toEqual({ page: 2, pageSize: 5, total: 1 });
    expect(result.data[0].user).toEqual({
      id: "u1",
      fullName: "Asha",
      email: "asha@x.io",
    });
  });
});

describe("InvestmentsService.portfolio", () => {
  it("aggregates open positions in the wallet currency", async () => {
    const h = harness();
    h.prisma.investment.findMany.mockResolvedValue([
      investment(),
      investment({
        id: "i2",
        status: "MATURED",
        principalAmount: 50_000n,
        projectedValue: 250_000n,
      }),
    ]);

    await expect(h.service.portfolio("u1")).resolves.toEqual({
      walletBalance: { amount: 500_000, currency: "TZS" },
      totalInvested: { amount: 150_000, currency: "TZS" },
      activeInvestments: 1,
      projectedPortfolioValue: { amount: 750_000, currency: "TZS" },
    });
  });

  it("defaults to TZS when the user has no wallet row", async () => {
    const h = harness();
    h.prisma.wallet.findUnique.mockResolvedValue(null);
    h.prisma.investment.findMany.mockResolvedValue([]);

    const summary = await h.service.portfolio("u1");

    expect(summary.totalInvested).toEqual({ amount: 0, currency: "TZS" });
    expect(summary.activeInvestments).toBe(0);
  });
});

describe("InvestmentsService.settle", () => {
  it("credits the settled value to the wallet inside the settlement transaction", async () => {
    const h = harness();
    h.prisma.investment.findUnique.mockResolvedValue(investment());
    h.prisma.investment.update.mockResolvedValue(
      investment({ status: "SETTLED", settledValue: 480_000n }),
    );

    const view = await h.service.settle("i1", 480_000, "admin1", "10.0.0.1");

    expect(h.ledger.post).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        direction: "CREDIT",
        type: "INVESTMENT_SETTLEMENT",
        amount: 480_000n,
      }),
    );
    expect(view.settledValue).toEqual({ amount: 480_000, currency: "TZS" });
    expect(h.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "investment.settled",
        metadata: { settledValue: 480_000 },
      }),
    );
  });

  it("posts no ledger entry for a total loss", async () => {
    const h = harness();
    h.prisma.investment.findUnique.mockResolvedValue(investment());
    h.prisma.investment.update.mockResolvedValue(
      investment({ status: "SETTLED", settledValue: 0n }),
    );

    await h.service.settle("i1", 0, "admin1");

    expect(h.ledger.post).not.toHaveBeenCalled();
  });

  it("refuses to settle twice", async () => {
    const h = harness();
    h.prisma.investment.findUnique.mockResolvedValue(investment({ status: "SETTLED" }));

    await expect(h.service.settle("i1", 1_000, "admin1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("only settles active or matured investments", async () => {
    const h = harness();
    h.prisma.investment.findUnique.mockResolvedValue(investment({ status: "PENDING" }));

    await expect(h.service.settle("i1", 1_000, "admin1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("throws NotFound for an unknown investment", async () => {
    const h = harness();

    await expect(h.service.settle("nope", 1_000, "admin1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
