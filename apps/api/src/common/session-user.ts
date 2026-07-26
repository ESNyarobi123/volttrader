import type { User } from "@prisma/client";
import type { SessionUser } from "@volt/types";

/** Wire projection of an account for the authenticated client — never includes secrets. */
export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    emailVerified: user.emailVerified,
    kycStatus: user.kycStatus,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}
