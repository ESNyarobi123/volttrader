import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
  twoFactorDisableSchema,
  verifyEmailSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  type TwoFactorCodeInput,
  type TwoFactorDisableInput,
  type VerifyEmailInput,
} from "@volt/validation";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Public } from "../../common/decorators/public.decorator";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private meta(req: FastifyRequest) {
    return { userAgent: req.headers["user-agent"], ip: req.ip };
  }

  @Post("register")
  @Public()
  register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput, @Req() req: FastifyRequest) {
    return this.auth.register(dto, this.meta(req));
  }

  @Post("login")
  @Public()
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginInput, @Req() req: FastifyRequest) {
    return this.auth.login(dto, this.meta(req));
  }

  @Post("refresh")
  @Public()
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) dto: { refreshToken: string },
    @Req() req: FastifyRequest,
  ) {
    return this.auth.refresh(dto.refreshToken, this.meta(req));
  }

  @Post("logout")
  @Public()
  async logout(@Body(new ZodValidationPipe(refreshSchema)) dto: { refreshToken: string }) {
    await this.auth.logout(dto.refreshToken);
    return { success: true };
  }

  @Post("forgot-password")
  @Public()
  forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordInput) {
    return this.auth.forgotPassword(dto);
  }

  @Post("reset-password")
  @Public()
  resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordInput) {
    return this.auth.resetPassword(dto);
  }

  @Post("verify-email")
  @Public()
  verifyEmail(@Body(new ZodValidationPipe(verifyEmailSchema)) dto: VerifyEmailInput) {
    return this.auth.verifyEmail(dto);
  }

  @Post("resend-verification")
  @Auth()
  resendVerification(@CurrentUser("id") userId: string) {
    return this.auth.resendVerification(userId);
  }

  @Get("me")
  @Auth()
  me(@CurrentUser("id") userId: string) {
    return this.auth.me(userId);
  }

  /** Begin TOTP enrollment — returns otpauth URL + manual secret. */
  @Post("2fa/setup")
  @Auth()
  setup2fa(@CurrentUser("id") userId: string) {
    return this.auth.setupTwoFactor(userId);
  }

  /** Confirm first code and enable 2FA. */
  @Post("2fa/enable")
  @Auth()
  enable2fa(
    @CurrentUser("id") userId: string,
    @Body(new ZodValidationPipe(twoFactorCodeSchema)) dto: TwoFactorCodeInput,
  ) {
    return this.auth.enableTwoFactor(userId, dto);
  }

  /** Disable 2FA — requires current password + authenticator code. */
  @Post("2fa/disable")
  @Auth()
  disable2fa(
    @CurrentUser("id") userId: string,
    @Body(new ZodValidationPipe(twoFactorDisableSchema)) dto: TwoFactorDisableInput,
  ) {
    return this.auth.disableTwoFactor(userId, dto);
  }
}
