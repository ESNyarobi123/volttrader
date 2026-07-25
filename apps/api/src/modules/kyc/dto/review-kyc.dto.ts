import { z } from "zod";
import { KycStatus } from "@prisma/client";

/**
 * A compliance officer's decision on a KYC submission.
 * Only terminal/review outcomes are allowed — not NOT_STARTED / PENDING.
 */
export const reviewKycSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "NEEDS_MORE_INFO"]),
  reviewerNote: z.string().max(2000).optional(),
});
export type ReviewKycInput = z.infer<typeof reviewKycSchema>;

/** Optional status filter for the admin KYC queue. */
export const kycListQuerySchema = z.object({
  status: z.nativeEnum(KycStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type KycListQuery = z.infer<typeof kycListQuerySchema>;
