import { applyDecorators, UseGuards } from "@nestjs/common";
import type { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { RolesGuard } from "../guards/roles.guard";
import { Roles } from "./roles.decorator";

/**
 * Require authentication, optionally restricted to specific roles.
 * `@Auth()` → any logged-in user. `@Auth(Role.FINANCE_ADMIN)` → finance admins only.
 */
export function Auth(...roles: UserRole[]) {
  return applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), Roles(...roles));
}
