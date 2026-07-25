import { z } from "zod";

/** Admin review action for a withdrawal request. */
export const withdrawalReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "PROCESS", "COMPLETE", "FAIL"]),
  reviewerNote: z.string().max(1000).optional(),
});
export type WithdrawalReviewInput = z.infer<typeof withdrawalReviewSchema>;
