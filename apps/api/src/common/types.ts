import type { UserRole } from "@prisma/client";

/** JWT access-token payload. */
export interface JwtAccessPayload {
  sub: string; // user id
  role: UserRole;
  email: string | null;
  type: "access";
}

/** JWT refresh-token payload. */
export interface JwtRefreshPayload {
  sub: string;
  tokenId: string;
  type: "refresh";
}

/** Shape attached to `request.user` after the auth guard runs. */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string | null;
}
