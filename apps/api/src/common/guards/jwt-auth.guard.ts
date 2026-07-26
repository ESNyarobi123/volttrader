import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthenticatedUser, JwtAccessPayload } from "../types";
import { errorMessage } from "../errors";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();

    const token = this.extractToken(request.headers.authorization);

    // Public routes stay open, but still attach the user when a valid bearer is present
    // (needed for enrolled/locked lesson state on catalogue detail pages).
    if (isPublic) {
      if (token) {
        try {
          request.user = await this.verifyAccess(token);
        } catch (err) {
          // Invalid tokens on public routes are treated as anonymous, but a
          // silently downgraded request is confusing without a trace.
          this.logger.debug(`Ignoring invalid bearer token on public route: ${errorMessage(err)}`);
        }
      }
      return true;
    }

    if (!token) throw new UnauthorizedException("Missing bearer token");

    try {
      request.user = await this.verifyAccess(token);
      return true;
    } catch (err) {
      this.logger.debug(`Rejected bearer token: ${errorMessage(err)}`);
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private async verifyAccess(token: string): Promise<AuthenticatedUser> {
    const payload = await this.jwt.verifyAsync<JwtAccessPayload>(token, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
    });
    if (payload.type !== "access") throw new Error("wrong token type");
    return { id: payload.sub, role: payload.role, email: payload.email };
  }

  private extractToken(header?: string): string | null {
    if (!header) return null;
    const [scheme, value] = header.split(" ");
    return scheme?.toLowerCase() === "bearer" && value ? value : null;
  }
}
