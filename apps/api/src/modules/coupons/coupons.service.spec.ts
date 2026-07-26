import { ConflictException, NotFoundException } from "@nestjs/common";
import { CouponsService } from "./coupons.service";

const coupon = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  code: "WELCOME10",
  percentOff: 10,
  amountOff: null,
  currency: null,
  maxRedemptions: null,
  redemptions: 0,
  expiresAt: null,
  active: true,
  createdAt: new Date("2024-05-01T00:00:00.000Z"),
  ...over,
});

const build = (prisma: Record<string, unknown>) => {
  const log = jest.fn().mockResolvedValue(undefined);
  const service = new CouponsService({ coupon: prisma } as never, { log } as never);
  return { log, service };
};

describe("CouponsService.list", () => {
  it("serialises BigInt amounts and dates to the wire shape", async () => {
    const { service } = build({
      findMany: jest.fn().mockResolvedValue([
        coupon({
          percentOff: null,
          amountOff: 250_000n,
          currency: "TZS",
          maxRedemptions: 5,
          expiresAt: new Date("2024-06-01T00:00:00.000Z"),
        }),
      ]),
    });

    await expect(service.list()).resolves.toEqual([
      {
        id: "c1",
        code: "WELCOME10",
        percentOff: null,
        amountOff: 250_000,
        currency: "TZS",
        maxRedemptions: 5,
        redemptions: 0,
        expiresAt: "2024-06-01T00:00:00.000Z",
        active: true,
        createdAt: "2024-05-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("CouponsService.create", () => {
  it("stores a percent coupon and clears the amount fields", async () => {
    const create = jest.fn().mockResolvedValue(coupon());
    const { log, service } = build({
      findUnique: jest.fn().mockResolvedValue(null),
      create,
    });

    await service.create({ code: "WELCOME10", percentOff: 10 } as never, "admin1");

    expect(create).toHaveBeenCalledWith({
      data: {
        code: "WELCOME10",
        percentOff: 10,
        amountOff: null,
        currency: null,
        maxRedemptions: null,
        expiresAt: null,
      },
    });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin1",
        action: "coupon.created",
        entityId: "c1",
      }),
    );
  });

  it("stores a fixed-amount coupon as minor units with its currency", async () => {
    const create = jest
      .fn()
      .mockResolvedValue(coupon({ percentOff: null, amountOff: 5_000n, currency: "TZS" }));
    const { service } = build({
      findUnique: jest.fn().mockResolvedValue(null),
      create,
    });

    await service.create({ code: "FLAT5K", amountOff: 5_000, currency: "TZS" } as never, "admin1");

    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        amountOff: 5_000n,
        currency: "TZS",
        percentOff: null,
      }),
    );
  });

  it("rejects a duplicate code", async () => {
    const create = jest.fn();
    const { service } = build({
      findUnique: jest.fn().mockResolvedValue(coupon()),
      create,
    });

    await expect(
      service.create({ code: "WELCOME10", percentOff: 10 } as never, "admin1"),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("CouponsService.update", () => {
  it("prefers percent when both discount types arrive and clears the other", async () => {
    const update = jest.fn().mockResolvedValue(coupon());
    const { service } = build({
      findUnique: jest.fn().mockResolvedValue(coupon({ currency: "TZS" })),
      update,
    });

    await service.update("c1", { percentOff: 25, amountOff: 5_000 }, "admin1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { percentOff: 25, amountOff: null, currency: null },
    });
  });

  it("keeps the existing currency when switching to a fixed amount without one", async () => {
    const update = jest.fn().mockResolvedValue(coupon());
    const { service } = build({
      findUnique: jest.fn().mockResolvedValue(coupon({ currency: "TZS" })),
      update,
    });

    await service.update("c1", { amountOff: 7_500 }, "admin1");

    expect(update.mock.calls[0][0].data).toEqual({
      amountOff: 7_500n,
      percentOff: null,
      currency: "TZS",
    });
  });

  it("applies explicit nulls and metadata-only fields", async () => {
    const update = jest.fn().mockResolvedValue(coupon());
    const expiresAt = new Date("2025-01-01T00:00:00.000Z");
    const { service } = build({
      findUnique: jest.fn().mockResolvedValue(coupon()),
      update,
    });

    await service.update(
      "c1",
      {
        active: false,
        maxRedemptions: 3,
        expiresAt,
        percentOff: null,
        amountOff: null,
      },
      "admin1",
    );

    expect(update.mock.calls[0][0].data).toEqual({
      active: false,
      maxRedemptions: 3,
      expiresAt,
      percentOff: null,
      amountOff: null,
    });
  });

  it("rejects renaming onto an existing code", async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(coupon())
      .mockResolvedValueOnce(coupon({ id: "c2", code: "TAKEN" }));
    const update = jest.fn();
    const { service } = build({ findUnique, update });

    await expect(service.update("c1", { code: "TAKEN" }, "admin1")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("throws NotFound for an unknown coupon", async () => {
    const { service } = build({
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    });

    await expect(service.update("nope", { active: true }, "admin1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("CouponsService.delete", () => {
  it("deletes and audit-logs the removed code", async () => {
    const del = jest.fn().mockResolvedValue(coupon());
    const { log, service } = build({
      findUnique: jest.fn().mockResolvedValue(coupon()),
      delete: del,
    });

    await expect(service.delete("c1", "admin1")).resolves.toEqual({
      id: "c1",
      deleted: true,
    });
    expect(del).toHaveBeenCalledWith({ where: { id: "c1" } });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "coupon.deleted",
        metadata: { code: "WELCOME10" },
      }),
    );
  });

  it("throws NotFound for an unknown coupon", async () => {
    const del = jest.fn();
    const { service } = build({
      findUnique: jest.fn().mockResolvedValue(null),
      delete: del,
    });

    await expect(service.delete("nope", "admin1")).rejects.toBeInstanceOf(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });
});
