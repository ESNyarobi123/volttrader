import { NotFoundException } from "@nestjs/common";
import { ProjectsService } from "./projects.service";

const project = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  slug: "volt-shop",
  title: "Volt Shop",
  category: "COMMERCE",
  status: "PLANNED",
  summary: "Coming soon",
  description: "A marketplace for the Volt community",
  coverKey: null,
  milestones: [{ title: "Design", done: true }],
  order: 0,
  createdAt: new Date("2024-02-01T00:00:00.000Z"),
  ...over,
});

const build = (prisma: Record<string, unknown>) => {
  const log = jest.fn().mockResolvedValue(undefined);
  const service = new ProjectsService({ project: prisma } as never, { log } as never);
  return { log, service };
};

describe("ProjectsService reads", () => {
  it("lists public projects ordered by explicit order then age", async () => {
    const findMany = jest.fn().mockResolvedValue([project()]);
    const { service } = build({ findMany });

    const views = await service.listPublic();

    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    expect(views[0]).toEqual({
      id: "p1",
      slug: "volt-shop",
      title: "Volt Shop",
      category: "COMMERCE",
      status: "PLANNED",
      summary: "Coming soon",
      description: "A marketplace for the Volt community",
      coverUrl: null,
      milestones: [{ title: "Design", done: true }],
    });
  });

  it("coerces a non-array milestones JSON value to an empty list", async () => {
    const { service } = build({
      findUnique: jest
        .fn()
        .mockResolvedValue(project({ milestones: null, coverKey: "covers/p1.png" })),
    });

    const view = await service.getBySlug("volt-shop");

    expect(view.milestones).toEqual([]);
    expect(view.coverUrl).toBe("covers/p1.png");
  });

  it("throws NotFound for an unknown slug", async () => {
    const { service } = build({
      findUnique: jest.fn().mockResolvedValue(null),
    });

    await expect(service.getBySlug("nope")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ProjectsService.create", () => {
  it("defaults status, milestones and order", async () => {
    const create = jest.fn().mockResolvedValue(project());
    const { service } = build({ create });

    await service.create({
      title: "Volt Shop",
      slug: "volt-shop",
      category: "COMMERCE",
      summary: "Coming soon",
      description: "A marketplace",
    } as never);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "PLANNED",
        milestones: [],
        order: 0,
      }),
    });
  });
});

describe("ProjectsService.update", () => {
  it("omits milestones entirely when not supplied", async () => {
    const update = jest.fn().mockResolvedValue(project());
    const { service } = build({
      findUnique: jest.fn().mockResolvedValue(project()),
      update,
    });

    await service.update("p1", { title: "Volt Shop v2" } as never);

    expect(update.mock.calls[0][0].data).not.toHaveProperty("milestones");
    expect(update.mock.calls[0][0].data.title).toBe("Volt Shop v2");
  });

  it("writes supplied milestones", async () => {
    const update = jest.fn().mockResolvedValue(project());
    const { service } = build({
      findUnique: jest.fn().mockResolvedValue(project()),
      update,
    });

    await service.update("p1", {
      milestones: [{ title: "Build", done: false }],
    } as never);

    expect(update.mock.calls[0][0].data.milestones).toEqual([{ title: "Build", done: false }]);
  });

  it("throws NotFound for an unknown project", async () => {
    const update = jest.fn();
    const { service } = build({
      findUnique: jest.fn().mockResolvedValue(null),
      update,
    });

    await expect(service.update("nope", {} as never)).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("ProjectsService.delete", () => {
  it("deletes and audit-logs the slug", async () => {
    const del = jest.fn().mockResolvedValue(project());
    const { log, service } = build({
      findUnique: jest.fn().mockResolvedValue(project()),
      delete: del,
    });

    await expect(service.delete("p1", "admin1")).resolves.toEqual({
      id: "p1",
      deleted: true,
    });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "project.deleted",
        metadata: { slug: "volt-shop" },
      }),
    );
  });

  it("throws NotFound for an unknown project", async () => {
    const del = jest.fn();
    const { service } = build({
      findUnique: jest.fn().mockResolvedValue(null),
      delete: del,
    });

    await expect(service.delete("nope", "admin1")).rejects.toBeInstanceOf(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });
});
