import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { JwtAccessPayload, JwtRefreshPayload } from "../../common/types";

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  async issueForUser(user: User, meta?: { userAgent?: string; ip?: string }) {
    // Coerce to Number: ConfigService can surface the raw process.env string,
    // and jsonwebtoken's `expiresIn` treats a bare numeric STRING as milliseconds
    // (so "900" => 0.9s). As a number it is correctly seconds.
    const accessTtl = Number(this.config.get("JWT_ACCESS_TTL"));
    const refreshTtl = Number(this.config.get("JWT_REFRESH_TTL"));

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      type: "access",
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: accessTtl,
    });

    // Opaque refresh token; only its hash is stored.
    const raw = randomBytes(48).toString("hex");
    const record = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.sha256(raw),
        userAgent: meta?.userAgent,
        ip: meta?.ip,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    const refreshPayload: JwtRefreshPayload = { sub: user.id, tokenId: record.id, type: "refresh" };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: refreshTtl,
    });

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  async verifyRefresh(token: string): Promise<JwtRefreshPayload> {
    return this.jwt.verifyAsync<JwtRefreshPayload>(token, {
      secret: this.config.get<string>("JWT_REFRESH_SECRET"),
    });
  }

  async rotate(oldTokenId: string, user: User, meta?: { userAgent?: string; ip?: string }) {
    await this.prisma.refreshToken.update({
      where: { id: oldTokenId },
      data: { revokedAt: new Date() },
    });
    return this.issueForUser(user, meta);
  }

  async revoke(tokenId: string): Promise<void> {
    await this.prisma.refreshToken
      .update({ where: { id: tokenId }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  async isRefreshActive(tokenId: string): Promise<boolean> {
    const record = await this.prisma.refreshToken.findUnique({ where: { id: tokenId } });
    return !!record && !record.revokedAt && record.expiresAt > new Date();
  }
}
