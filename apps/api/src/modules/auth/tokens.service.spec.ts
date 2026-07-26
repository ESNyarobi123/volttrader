import { Prisma } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { TokensService } from "./tokens.service";
import { PrismaService } from "../../prisma/prisma.service";

function buildService(update: jest.Mock): TokensService {
  const prisma = { refreshToken: { update } } as unknown as PrismaService;
  return new TokensService(
    {} as unknown as JwtService,
    { get: () => undefined } as unknown as ConfigService,
    prisma,
  );
}

describe("TokensService.revoke", () => {
  it("treats an unknown token id as already revoked", async () => {
    const update = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("not found", {
        code: "P2025",
        clientVersion: "5.22.0",
      }),
    );
    await expect(buildService(update).revoke("missing")).resolves.toBeUndefined();
  });

  it("propagates any other database failure", async () => {
    const update = jest.fn().mockRejectedValue(new Error("connection refused"));
    await expect(buildService(update).revoke("tok_1")).rejects.toThrow("connection refused");
  });
});
