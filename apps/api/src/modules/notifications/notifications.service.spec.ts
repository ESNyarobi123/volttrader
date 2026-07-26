import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService.create", () => {
  it("defaults the type to SYSTEM", async () => {
    const create = jest.fn().mockResolvedValue({ id: "n1" });
    const service = new NotificationsService({
      notification: { create },
    } as never);

    await expect(service.create({ userId: "u1", title: "Hello", body: "World" })).resolves.toEqual({
      id: "n1",
    });

    expect(create).toHaveBeenCalledWith({
      data: { userId: "u1", type: "SYSTEM", title: "Hello", body: "World" },
    });
  });

  it("writes through a supplied transaction client with the requested type", async () => {
    const rootCreate = jest.fn();
    const txCreate = jest.fn().mockResolvedValue({ id: "n2" });
    const service = new NotificationsService({
      notification: { create: rootCreate },
    } as never);

    await service.create(
      {
        userId: "u1",
        type: "PAYMENT",
        title: "Deposit received",
        body: "5,000 TZS",
      },
      { notification: { create: txCreate } } as never,
    );

    expect(rootCreate).not.toHaveBeenCalled();
    expect(txCreate).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        type: "PAYMENT",
        title: "Deposit received",
        body: "5,000 TZS",
      },
    });
  });
});

describe("NotificationsService.listForUser", () => {
  it("lists the user's notifications newest first", async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: "n1" }]);
    const service = new NotificationsService({
      notification: { findMany },
    } as never);

    await expect(service.listForUser("u1")).resolves.toEqual([{ id: "n1" }]);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("NotificationsService.markRead", () => {
  const build = (notification: unknown) => {
    const update = jest.fn().mockResolvedValue({ id: "n1", readAt: new Date() });
    const service = new NotificationsService({
      notification: {
        findUnique: jest.fn().mockResolvedValue(notification),
        update,
      },
    } as never);
    return { update, service };
  };

  it("marks an unread notification as read", async () => {
    const { update, service } = build({ id: "n1", userId: "u1", readAt: null });

    await service.markRead("n1", "u1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { readAt: expect.any(Date) },
    });
  });

  it("is idempotent for an already-read notification", async () => {
    const readAt = new Date("2024-01-01T00:00:00.000Z");
    const { update, service } = build({ id: "n1", userId: "u1", readAt });

    await expect(service.markRead("n1", "u1")).resolves.toEqual({
      id: "n1",
      userId: "u1",
      readAt,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects reading another user's notification", async () => {
    const { update, service } = build({
      id: "n1",
      userId: "someone-else",
      readAt: null,
    });

    await expect(service.markRead("n1", "u1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it("throws NotFound for an unknown notification", async () => {
    const { service } = build(null);

    await expect(service.markRead("nope", "u1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
