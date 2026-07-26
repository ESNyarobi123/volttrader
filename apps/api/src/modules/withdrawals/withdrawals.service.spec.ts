import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { WithdrawalsService } from "./withdrawals.service";

const USER = {
  id: "u1",
  fullName: "Asha Mwita",
  email: "asha@volttrades.local",
  kycStatus: "APPROVED",
};

const withdrawal = (over: Record<string, unknown> = {}) => ({
  id: "w1",
  userId: "u1",
  amount: 50_000n,
  currency: "TZS",
  method: "BANK_TRANSFER",
  destinationMasked: "*******789",
  status: "REQUESTED",
  reference: "WDL-ref",
  reviewerNote: null,
  createdAt: new Date("2024-04-01T00:00:00.000Z"),
  processedAt: null,
  user: { id: "u1", fullName: USER.fullName, email: USER.email },
  ...over,
});

interface Harness {
  prisma: {
    user: { findUnique: jest.Mock };
    withdrawal: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  ledger: { getBalance: jest.Mock; post: jest.Mock };
  audit: { log: jest.Mock };
  auth: { assertTotp: jest.Mock };
  tx: unknown;
}

const harness = (
  over: { user?: unknown; balance?: bigint } = {},
): Harness & {
  service: WithdrawalsService;
} => {
  const txWithdrawal = {
    create: jest.fn().mockResolvedValue(withdrawal()),
    update: jest.fn().mockResolvedValue(withdrawal({ status: "APPROVED" })),
    delete: jest.fn().mockResolvedValue(withdrawal()),
  };
  const tx = { withdrawal: txWithdrawal };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(over.user === undefined ? USER : over.user),
    },
    withdrawal: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([withdrawal()]),
      count: jest.fn().mockResolvedValue(1),
      create: txWithdrawal.create,
      update: txWithdrawal.update,
      delete: txWithdrawal.delete,
    },
    $transaction: jest.fn().mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx)),
  };
  const ledger = {
    getBalance: jest.fn().mockResolvedValue(over.balance ?? 100_000n),
    post: jest.fn().mockResolvedValue({ id: "le1" }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const auth = { assertTotp: jest.fn() };

  return {
    prisma,
    ledger,
    audit,
    auth,
    tx,
    service: new WithdrawalsService(
      prisma as never,
      ledger as never,
      audit as never,
      auth as never,
    ),
  };
};

const REQUEST = {
  amount: 50_000,
  currency: "TZS",
  method: "BANK_TRANSFER",
  destination: "0123456789",
  totpCode: "123456",
} as never;

describe("WithdrawalsService.request", () => {
  it("holds the funds with a DEBIT ledger entry inside the same transaction", async () => {
    const h = harness();

    const view = await h.service.request("u1", REQUEST, { ip: "10.0.0.1" });

    expect(h.auth.assertTotp).toHaveBeenCalledWith(USER, "123456");
    expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(h.prisma.withdrawal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          amount: 50_000n,
          status: "REQUESTED",
          destinationMasked: "*******789",
        }),
      }),
    );
    expect(h.ledger.post).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        direction: "DEBIT",
        type: "WITHDRAWAL",
        amount: 50_000n,
        withdrawalId: "w1",
      }),
    );
    expect(h.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "withdrawal.requested",
        ip: "10.0.0.1",
      }),
    );
    expect(view.amount).toEqual({ amount: 50_000, currency: "TZS" });
    expect(view.destinationMasked).toBe("*******789");
  });

  it("rejects a request that exceeds the derived balance without creating anything", async () => {
    const h = harness({ balance: 10_000n });

    await expect(h.service.request("u1", REQUEST)).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.withdrawal.create).not.toHaveBeenCalled();
    expect(h.ledger.post).not.toHaveBeenCalled();
    expect(h.audit.log).not.toHaveBeenCalled();
  });

  it("requires APPROVED KYC", async () => {
    const h = harness({ user: { ...USER, kycStatus: "PENDING" } });

    await expect(h.service.request("u1", REQUEST)).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.auth.assertTotp).not.toHaveBeenCalled();
  });

  it("throws NotFound for an unknown user", async () => {
    const h = harness({ user: null });

    await expect(h.service.request("u1", REQUEST)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("replays an idempotent request without a second hold", async () => {
    const h = harness();
    h.prisma.withdrawal.findUnique.mockResolvedValue(withdrawal({ status: "APPROVED" }));

    const view = await h.service.request("u1", {
      ...(REQUEST as object),
      idempotencyKey: "k1",
    } as never);

    expect(view.status).toBe("APPROVED");
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.ledger.post).not.toHaveBeenCalled();
  });
});

describe("WithdrawalsService.adminCreate", () => {
  it("skips KYC and 2FA by default and audits the actor acting on behalf of the user", async () => {
    const h = harness({ user: { ...USER, kycStatus: "PENDING" } });

    await h.service.adminCreate("admin1", {
      userId: "u1",
      ...(REQUEST as object),
    } as never);

    expect(h.auth.assertTotp).not.toHaveBeenCalled();
    expect(h.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin1",
        metadata: expect.objectContaining({ onBehalfOf: "u1" }),
      }),
    );
  });

  it("still enforces KYC and 2FA when the admin opts in", async () => {
    const h = harness({ user: { ...USER, kycStatus: "PENDING" } });

    await expect(
      h.service.adminCreate("admin1", {
        userId: "u1",
        ...(REQUEST as object),
        skipKycCheck: false,
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("WithdrawalsService listing", () => {
  it("returns the user's own withdrawals in the customer view", async () => {
    const h = harness();

    const items = await h.service.listMine("u1");

    expect(h.prisma.withdrawal.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { createdAt: "desc" },
    });
    expect(items[0]).not.toHaveProperty("reviewerNote");
  });

  it("paginates the admin queue and filters by status", async () => {
    const h = harness();

    const result = await h.service.listAll("REQUESTED" as never, 3, 10);

    expect(h.prisma.withdrawal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "REQUESTED" },
        skip: 20,
        take: 10,
      }),
    );
    expect(result.meta).toEqual({ page: 3, pageSize: 10, total: 1 });
    expect(result.data[0].user).toEqual({
      id: "u1",
      fullName: USER.fullName,
      email: USER.email,
    });
  });

  it("omits the status filter when none is given", async () => {
    const h = harness();

    await h.service.listAll(undefined, 1, 20);

    expect(h.prisma.withdrawal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});

describe("WithdrawalsService.adminUpdate", () => {
  it("re-masks a new destination and only patches supplied fields", async () => {
    const h = harness();
    h.prisma.withdrawal.findUnique.mockResolvedValue(withdrawal({ status: "UNDER_REVIEW" }));

    await h.service.adminUpdate("w1", "admin1", {
      destination: "9876543210",
    } as never);

    expect(h.prisma.withdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { destinationMasked: "*******210" } }),
    );
  });

  it("refuses to edit a withdrawal that left the review queue", async () => {
    const h = harness();
    h.prisma.withdrawal.findUnique.mockResolvedValue(withdrawal({ status: "COMPLETED" }));

    await expect(
      h.service.adminUpdate("w1", "admin1", { reviewerNote: "note" } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.withdrawal.update).not.toHaveBeenCalled();
  });

  it("throws NotFound for an unknown withdrawal", async () => {
    const h = harness();

    await expect(
      h.service.adminUpdate("nope", "admin1", {
        reviewerNote: "note",
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("WithdrawalsService.adminDelete", () => {
  it("reverses the ledger hold before deleting an open request", async () => {
    const h = harness();
    h.prisma.withdrawal.findUnique.mockResolvedValue(withdrawal({ status: "REQUESTED" }));

    await expect(h.service.adminDelete("w1", "admin1")).resolves.toEqual({
      id: "w1",
      deleted: true,
    });
    expect(h.ledger.post).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        direction: "CREDIT",
        type: "WITHDRAWAL_REVERSAL",
        amount: 50_000n,
      }),
    );
    expect(h.prisma.withdrawal.delete).toHaveBeenCalledWith({
      where: { id: "w1" },
    });
  });

  it("deletes an already-reversed closed request without touching the ledger", async () => {
    const h = harness();
    h.prisma.withdrawal.findUnique.mockResolvedValue(withdrawal({ status: "REJECTED" }));

    await h.service.adminDelete("w1", "admin1");

    expect(h.ledger.post).not.toHaveBeenCalled();
    expect(h.prisma.withdrawal.delete).toHaveBeenCalled();
  });

  it("blocks deleting a withdrawal that is mid-payout", async () => {
    const h = harness();
    h.prisma.withdrawal.findUnique.mockResolvedValue(withdrawal({ status: "PROCESSING" }));

    await expect(h.service.adminDelete("w1", "admin1")).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.withdrawal.delete).not.toHaveBeenCalled();
    expect(h.audit.log).not.toHaveBeenCalled();
  });

  it("throws NotFound for an unknown withdrawal", async () => {
    const h = harness();

    await expect(h.service.adminDelete("nope", "admin1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("WithdrawalsService.review", () => {
  it.each([
    ["APPROVE", "REQUESTED", "APPROVED"],
    ["PROCESS", "APPROVED", "PROCESSING"],
    ["COMPLETE", "PROCESSING", "COMPLETED"],
  ])("advances %s from %s to %s without a reversal", async (action, from, to) => {
    const h = harness();
    h.prisma.withdrawal.findUnique.mockResolvedValue(withdrawal({ status: from }));

    await h.service.review("w1", "admin1", { action } as never);

    expect(h.ledger.post).not.toHaveBeenCalled();
    expect(h.prisma.withdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: to, reviewedById: "admin1" }),
      }),
    );
    expect(h.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: `withdrawal.${to.toLowerCase()}` }),
    );
  });

  it.each([
    ["REJECT", "REQUESTED"],
    ["FAIL", "PROCESSING"],
  ])("%s reverses the hold with a compensating CREDIT entry", async (action, from) => {
    const h = harness();
    h.prisma.withdrawal.findUnique.mockResolvedValue(withdrawal({ status: from }));

    await h.service.review("w1", "admin1", {
      action,
      reviewerNote: "bad details",
    } as never);

    expect(h.ledger.post).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        direction: "CREDIT",
        type: "WITHDRAWAL_REVERSAL",
        amount: 50_000n,
        reference: "WDL-ref",
      }),
    );
    expect(h.prisma.withdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewerNote: "bad details",
          processedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("stamps processedAt only for terminal transitions", async () => {
    const h = harness();
    h.prisma.withdrawal.findUnique.mockResolvedValue(withdrawal({ status: "REQUESTED" }));

    await h.service.review("w1", "admin1", { action: "APPROVE" } as never);

    expect(h.prisma.withdrawal.update.mock.calls[0][0].data.processedAt).toBeNull();
  });

  it("rejects an illegal transition", async () => {
    const h = harness();
    h.prisma.withdrawal.findUnique.mockResolvedValue(withdrawal({ status: "COMPLETED" }));

    await expect(
      h.service.review("w1", "admin1", { action: "APPROVE" } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws NotFound for an unknown withdrawal", async () => {
    const h = harness();

    await expect(
      h.service.review("nope", "admin1", { action: "APPROVE" } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
