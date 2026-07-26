import { createHash } from "node:crypto";
import { TokensService } from "./tokens.service";

const user = {
  id: "u1",
  role: "USER",
  email: "user@volttrades.local",
} as never;

const configOf = (values: Record<string, string>) => ({
  get: (key: string) => values[key],
});

const CONFIG = configOf({
  JWT_ACCESS_TTL: "900",
  JWT_REFRESH_TTL: "604800",
  JWT_ACCESS_SECRET: "access-secret",
  JWT_REFRESH_SECRET: "refresh-secret",
});

describe("TokensService.issueForUser", () => {
  it("signs the access token with numeric seconds TTL and stores only the refresh hash", async () => {
    const signAsync = jest.fn().mockResolvedValue("signed");
    const create = jest.fn().mockResolvedValue({ id: "rt1" });
    const service = new TokensService(
      { signAsync } as never,
      CONFIG as never,
      { refreshToken: { create } } as never,
    );

    const result = await service.issueForUser(user, {
      userAgent: "jest",
      ip: "10.0.0.1",
    });

    expect(result).toEqual({
      accessToken: "signed",
      refreshToken: "signed",
      expiresIn: 900,
    });

    const [accessPayload, accessOptions] = signAsync.mock.calls[0];
    expect(accessPayload).toEqual({
      sub: "u1",
      role: "USER",
      email: "user@volttrades.local",
      type: "access",
    });
    // A bare numeric string would be read as milliseconds by jsonwebtoken.
    expect(accessOptions).toEqual({ secret: "access-secret", expiresIn: 900 });

    const stored = create.mock.calls[0][0].data;
    expect(stored.userId).toBe("u1");
    expect(stored.tokenHash).toHaveLength(createHash("sha256").update("x").digest("hex").length);
    expect(stored.userAgent).toBe("jest");
    expect(stored.ip).toBe("10.0.0.1");
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const [refreshPayload, refreshOptions] = signAsync.mock.calls[1];
    expect(refreshPayload).toEqual({
      sub: "u1",
      tokenId: "rt1",
      type: "refresh",
    });
    expect(refreshOptions).toEqual({
      secret: "refresh-secret",
      expiresIn: 604_800,
    });
  });

  it("never persists the raw refresh token", async () => {
    const create = jest.fn().mockResolvedValue({ id: "rt1" });
    const service = new TokensService(
      { signAsync: jest.fn().mockResolvedValue("signed") } as never,
      CONFIG as never,
      { refreshToken: { create } } as never,
    );

    await service.issueForUser(user);

    const stored = create.mock.calls[0][0].data;
    expect(stored).not.toHaveProperty("token");
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("TokensService.verifyRefresh", () => {
  it("verifies with the refresh secret", async () => {
    const verifyAsync = jest.fn().mockResolvedValue({ sub: "u1", tokenId: "rt1", type: "refresh" });
    const service = new TokensService({ verifyAsync } as never, CONFIG as never, {} as never);

    await expect(service.verifyRefresh("token")).resolves.toEqual({
      sub: "u1",
      tokenId: "rt1",
      type: "refresh",
    });
    expect(verifyAsync).toHaveBeenCalledWith("token", {
      secret: "refresh-secret",
    });
  });
});

describe("TokensService.rotate", () => {
  it("revokes the old token before issuing a new pair", async () => {
    const calls: string[] = [];
    const update = jest.fn().mockImplementation(async () => {
      calls.push("revoke");
      return {};
    });
    const create = jest.fn().mockImplementation(async () => {
      calls.push("create");
      return { id: "rt2" };
    });
    const service = new TokensService(
      { signAsync: jest.fn().mockResolvedValue("signed") } as never,
      CONFIG as never,
      { refreshToken: { update, create } } as never,
    );

    await service.rotate("rt1", user);

    expect(update).toHaveBeenCalledWith({
      where: { id: "rt1" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(calls).toEqual(["revoke", "create"]);
  });
});

describe("TokensService.revoke", () => {
  it("swallows errors for tokens that no longer exist", async () => {
    const update = jest.fn().mockRejectedValue(new Error("not found"));
    const service = new TokensService(
      {} as never,
      CONFIG as never,
      {
        refreshToken: { update },
      } as never,
    );

    await expect(service.revoke("rt1")).resolves.toBeUndefined();
  });
});

describe("TokensService.isRefreshActive", () => {
  const build = (record: unknown) =>
    new TokensService(
      {} as never,
      CONFIG as never,
      {
        refreshToken: { findUnique: jest.fn().mockResolvedValue(record) },
      } as never,
    );

  it("accepts a live, unrevoked token", async () => {
    const service = build({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.isRefreshActive("rt1")).resolves.toBe(true);
  });

  it("rejects revoked, expired and unknown tokens", async () => {
    await expect(
      build({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      }).isRefreshActive("rt1"),
    ).resolves.toBe(false);
    await expect(
      build({
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      }).isRefreshActive("rt1"),
    ).resolves.toBe(false);
    await expect(build(null).isRefreshActive("rt1")).resolves.toBe(false);
  });
});
