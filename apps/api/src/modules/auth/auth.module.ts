import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokensService } from "./tokens.service";
import { TwoFactorService } from "./two-factor.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

@Module({
  imports: [
    // Registered globally so JwtAuthGuard can resolve JwtService in any module.
    JwtModule.register({ global: true }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    TwoFactorService,
    JwtAuthGuard,
    // Fail-closed: every route requires JWT unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, TokensService, TwoFactorService],
})
export class AuthModule {}
