import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";

/** Admin status change for a user account. */
export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

/** Super-admin role change for a user account. */
export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
