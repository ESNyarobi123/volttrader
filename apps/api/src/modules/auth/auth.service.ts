import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
  TwoFactorCodeInput,
  TwoFactorDisableInput,
} from "@volt/validation";
import type { AuthResponse, SessionUser, TwoFactorSetupView } from "@volt/types";
import { hashPassword } from "../../common/password";
import { toSessionUser } from "../../common/session-user";
import { PrismaService } from "../../prisma/prisma.service";
import { LedgerService } from "../ledger/ledger.service";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import { TokensService } from "./tokens.service";
import { TwoFactorService } from "./two-factor.service";

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  /** Start TOTP enrollment — returns otpauth URL + secret for the authenticator app. */
  async setupTwoFactor(userId: string): Promise<TwoFactorSetupView> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("User not found");
    if (user.twoFactorEnabled) {
      throw new BadRequestException("Two-factor authentication is already enabled");
    }

    const label = user.email ?? user.phone ?? user.fullName;
    const { secret, otpauthUrl } = this.twoFactor.generateSecret(label);

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: this.twoFactor.encryptSecret(secret) },
    });

    await this.audit.log({
      actorId: userId,
      action: "auth.2fa_setup_started",
      entityType: "User",
      entityId: userId,
    });

    return { secret, otpauthUrl };
  }

  /** Confirm first TOTP code and enable 2FA. */
  async enableTwoFactor(userId: string, input: TwoFactorCodeInput): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("User not found");
    if (user.twoFactorEnabled) {
      throw new BadRequestException("Two-factor authentication is already enabled");
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestException("Start 2FA setup first");
    }
    if (!this.twoFactor.verifyEncrypted(user.twoFactorSecret, input.code)) {
      throw new UnauthorizedException("Invalid authenticator code");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorEnabledAt: new Date() },
    });

    await this.audit.log({
      actorId: userId,
      action: "auth.2fa_enabled",
      entityType: "User",
      entityId: userId,
    });

    return toSessionUser(updated);
  }

  async disableTwoFactor(userId: string, input: TwoFactorDisableInput): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("User not found");
    if (!user.twoFactorEnabled) {
      throw new BadRequestException("Two-factor authentication is not enabled");
    }

    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException("Invalid password");
    if (!this.twoFactor.verifyEncrypted(user.twoFactorSecret, input.code)) {
      throw new UnauthorizedException("Invalid authenticator code");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorEnabledAt: null,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: "auth.2fa_disabled",
      entityType: "User",
      entityId: userId,
    });

    return toSessionUser(updated);
  }

  /** Used by withdrawals and other high-risk actions. */
  assertTotp(user: User, code: string | undefined): void {
    if (!user.twoFactorEnabled) {
      throw new ForbiddenException(
        "Two-factor authentication is required for withdrawals. Enable 2FA in Profile → Security.",
      );
    }
    if (!code) {
      throw new BadRequestException("Authenticator code is required");
    }
    if (!this.twoFactor.verifyEncrypted(user.twoFactorSecret, code)) {
      throw new UnauthorizedException("Invalid authenticator code");
    }
  }

  async register(input: RegisterInput, meta?: { userAgent?: string; ip?: string }): Promise<AuthResponse> {
    // Fail fast on duplicates before spending time on bcrypt.
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(input.email ? [{ email: input.email }] : []),
          ...(input.phone ? [{ phone: input.phone }] : []),
        ],
      },
      select: { id: true },
    });
    if (existing) throw new ConflictException("An account with these details already exists");

    const passwordHash = await hashPassword(input.password, this.config);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email ?? null,
          phone: input.phone ?? null,
          country: input.country ?? null,
          passwordHash,
          acceptedTermsAt: new Date(),
        },
      });
      // Every user gets a wallet at signup (default currency); balance stays 0 via ledger.
      await this.ledger.ensureWallet(created.id, "TZS", tx);
      return created;
    });

    // Issue tokens first so the client can navigate; audit is non-blocking for UX.
    const tokens = await this.tokens.issueForUser(user, meta);
    void this.audit
      .log({ actorId: user.id, action: "auth.register", entityType: "User", entityId: user.id, ip: meta?.ip })
      .catch(() => undefined);

    if (user.email) {
      void this.sendEmailVerification(user).catch(() => undefined);
    }

    return { user: toSessionUser(user), tokens };
  }

  async login(input: LoginInput, meta?: { userAgent?: string; ip?: string }): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.identifier }, { phone: input.identifier }] },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    if (user.status !== "ACTIVE") throw new UnauthorizedException("Account is not active");

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    const tokens = await this.tokens.issueForUser(user, meta);
    await this.audit.log({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, ip: meta?.ip });
    return { user: toSessionUser(user), tokens };
  }

  async refresh(refreshToken: string, meta?: { userAgent?: string; ip?: string }) {
    let payload;
    try {
      payload = await this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (payload.type !== "refresh") throw new UnauthorizedException("Invalid refresh token");
    if (!(await this.tokens.isRefreshActive(payload.tokenId))) {
      throw new UnauthorizedException("Refresh token expired or revoked");
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException("User no longer exists");

    const tokens = await this.tokens.rotate(payload.tokenId, user, meta);
    return { user: toSessionUser(user), tokens };
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.tokens.verifyRefresh(refreshToken);
      await this.tokens.revoke(payload.tokenId);
    } catch {
      // ignore — logout is best-effort
    }
  }

  async me(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("User not found");
    return toSessionUser(user);
  }

  /**
   * Always returns the same message — do not reveal whether the identifier exists.
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.identifier }, { phone: input.identifier }] },
    });

    if (user?.email) {
      const raw = await this.issueVerificationToken(user.id, "PASSWORD_RESET", PASSWORD_RESET_TTL_MS);
      const siteUrl = this.siteUrl();
      const link = `${siteUrl}/reset-password?token=${encodeURIComponent(raw)}`;
      await this.mail.send({
        to: user.email,
        subject: "Reset your Volt Trades password",
        text: `Reset your password (expires in 1 hour):\n\n${link}\n\nIf you did not request this, ignore this email.`,
        html: `<p>Reset your password (expires in 1 hour):</p><p><a href="${link}">${link}</a></p><p>If you did not request this, ignore this email.</p>`,
      });
      void this.audit
        .log({
          actorId: user.id,
          action: "auth.password_reset_requested",
          entityType: "User",
          entityId: user.id,
        })
        .catch(() => undefined);
    }

    return {
      message: "If an account exists for that identifier, password reset instructions were sent.",
    };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    const record = await this.consumeVerificationToken(input.token, "PASSWORD_RESET");
    const passwordHash = await hashPassword(input.password, this.config);

    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });

    // Revoke all refresh sessions after a password change.
    await this.prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    void this.audit
      .log({
        actorId: record.userId,
        action: "auth.password_reset",
        entityType: "User",
        entityId: record.userId,
      })
      .catch(() => undefined);

    return { message: "Password updated. You can sign in with your new password." };
  }

  async verifyEmail(input: VerifyEmailInput): Promise<{ message: string }> {
    const record = await this.consumeVerificationToken(input.token, "EMAIL_VERIFY");
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    });
    void this.audit
      .log({
        actorId: record.userId,
        action: "auth.email_verified",
        entityType: "User",
        entityId: record.userId,
      })
      .catch(() => undefined);
    return { message: "Email verified. Thank you." };
  }

  async resendVerification(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("User not found");
    if (!user.email) throw new BadRequestException("No email on this account");
    if (user.emailVerified) return { message: "Email is already verified." };
    await this.sendEmailVerification(user);
    return { message: "Verification email sent." };
  }

  private siteUrl(): string {
    return (
      this.config.get<string>("SITE_URL") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3001"
    );
  }

  private sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private async issueVerificationToken(
    userId: string,
    purpose: "EMAIL_VERIFY" | "PASSWORD_RESET",
    ttlMs: number,
  ): Promise<string> {
    const raw = randomBytes(32).toString("base64url");
    const tokenHash = this.sha256(raw);
    // Invalidate unused tokens of the same purpose.
    await this.prisma.verificationToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.prisma.verificationToken.create({
      data: {
        userId,
        purpose,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return raw;
  }

  private async consumeVerificationToken(
    raw: string,
    purpose: "EMAIL_VERIFY" | "PASSWORD_RESET",
  ): Promise<{ userId: string }> {
    const tokenHash = this.sha256(raw);
    const record = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.purpose !== purpose) {
      throw new BadRequestException("Invalid or expired token");
    }
    if (record.usedAt) throw new BadRequestException("This link has already been used");
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("This link has expired");
    }
    await this.prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return { userId: record.userId };
  }

  private async sendEmailVerification(user: User): Promise<void> {
    if (!user.email) return;
    const raw = await this.issueVerificationToken(user.id, "EMAIL_VERIFY", EMAIL_VERIFY_TTL_MS);
    const link = `${this.siteUrl()}/verify-email?token=${encodeURIComponent(raw)}`;
    await this.mail.send({
      to: user.email,
      subject: "Verify your Volt Trades email",
      text: `Verify your email (expires in 24 hours):\n\n${link}`,
      html: `<p>Verify your email (expires in 24 hours):</p><p><a href="${link}">${link}</a></p>`,
    });
  }
}
