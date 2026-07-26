import { NotFoundException } from "@nestjs/common";
import { AuditService } from "./audit.service";

describe("AuditService.log", () => {
  it("normalises optional fields to null", async () => {
    const create = jest.fn().mockResolvedValue({ id: "a1" });
    const service = new AuditService({ auditLog: { create } } as never);

    await service.log({ action: "payment.confirmed", entityType: "Payment" });

    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: null,
        action: "payment.confirmed",
        entityType: "Payment",
        entityId: null,
        ip: null,
        metadata: undefined,
      },
    });
  });

  it("writes through a supplied transaction client instead of the root client", async () => {
    const rootCreate = jest.fn();
    const txCreate = jest.fn().mockResolvedValue({ id: "a1" });
    const service = new AuditService({
      auditLog: { create: rootCreate },
    } as never);

    await service.log(
      {
        actorId: "admin1",
        action: "withdrawal.approved",
        entityType: "Withdrawal",
        entityId: "w1",
        ip: "10.0.0.1",
        metadata: { from: "REQUESTED" },
      },
      { auditLog: { create: txCreate } } as never,
    );

    expect(rootCreate).not.toHaveBeenCalled();
    expect(txCreate).toHaveBeenCalledWith({
      data: {
        actorId: "admin1",
        action: "withdrawal.approved",
        entityType: "Withdrawal",
        entityId: "w1",
        ip: "10.0.0.1",
        metadata: { from: "REQUESTED" },
      },
    });
  });
});

describe("AuditService.list", () => {
  const build = () => {
    const findMany = jest.fn().mockResolvedValue([{ id: "a1" }]);
    const count = jest.fn().mockResolvedValue(1);
    return {
      findMany,
      count,
      service: new AuditService({ auditLog: { findMany, count } } as never),
    };
  };

  it("passes an empty filter when nothing is requested", async () => {
    const { findMany, count, service } = build();

    await expect(service.list()).resolves.toEqual({
      items: [{ id: "a1" }],
      total: 1,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 50 }),
    );
    expect(count).toHaveBeenCalledWith({ where: {} });
  });

  it("combines entityType, action and domain filters with AND", async () => {
    const { findMany, service } = build();

    await service.list(3, 10, {
      entityType: "Withdrawal",
      action: "withdrawal.approved",
      domain: "withdrawal",
    });

    const args = findMany.mock.calls[0][0];
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
    expect(args.where).toEqual({
      AND: [
        { entityType: "Withdrawal" },
        { action: "withdrawal.approved" },
        { action: { startsWith: "withdrawal." } },
      ],
    });
  });

  it("builds a case-insensitive OR search for a free-text query and ignores blank ones", async () => {
    const { findMany, service } = build();

    await service.list(1, 50, { q: "  admin@volt  " });
    const searched = findMany.mock.calls[0][0].where.AND[0];
    expect(searched.OR).toContainEqual({
      action: { contains: "admin@volt", mode: "insensitive" },
    });
    expect(searched.OR).toContainEqual({
      actor: { email: { contains: "admin@volt", mode: "insensitive" } },
    });

    findMany.mockClear();
    await service.list(1, 50, { q: "   " });
    expect(findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("AuditService.getById", () => {
  it("returns the event with its actor", async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: "a1", actor: { id: "admin1" } });
    const service = new AuditService({ auditLog: { findUnique } } as never);

    await expect(service.getById("a1")).resolves.toEqual({
      id: "a1",
      actor: { id: "admin1" },
    });
  });

  it("throws NotFound for an unknown id", async () => {
    const service = new AuditService({
      auditLog: { findUnique: jest.fn().mockResolvedValue(null) },
    } as never);

    await expect(service.getById("nope")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("AuditService.stats", () => {
  it("counts totals per window and de-duplicates actors", async () => {
    const count = jest
      .fn()
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(20);
    const findMany = jest.fn().mockResolvedValue([{ actorId: "a" }, { actorId: "b" }]);
    const service = new AuditService({
      auditLog: { count, findMany },
    } as never);

    await expect(service.stats()).resolves.toEqual({
      total: 100,
      today: 5,
      week: 20,
      uniqueActors: 2,
    });

    const todayFilter = count.mock.calls[1][0].where.createdAt.gte as Date;
    expect(todayFilter.getHours()).toBe(0);
    expect(todayFilter.getMinutes()).toBe(0);

    const weekFilter = count.mock.calls[2][0].where.createdAt.gte as Date;
    expect(weekFilter.getTime()).toBeLessThan(Date.now());
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: ["actorId"],
        where: { actorId: { not: null } },
      }),
    );
  });
});
