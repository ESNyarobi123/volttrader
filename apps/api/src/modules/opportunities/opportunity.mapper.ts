import type { Opportunity } from "@prisma/client";
import type { OpportunitySummary } from "@volt/types";

/**
 * Shared opportunity projection used by opportunities + investments.
 * projectionMultiplier is a PROJECTION, never a guarantee.
 */
export function toOpportunitySummary(o: Opportunity): OpportunitySummary {
  return {
    id: o.id,
    slug: o.slug,
    name: o.name,
    summary: o.summary,
    currency: o.currency,
    minAmount: Number(o.minAmount),
    maxAmount: o.maxAmount !== null ? Number(o.maxAmount) : null,
    durationDays: o.durationDays,
    projectionMultiplier: Number(o.projectionMultiplier),
    projectionLabel: o.projectionLabel,
    riskCategory: o.riskCategory,
    status: o.status,
    investmentPlanId: o.investmentPlanId ?? null,
  };
}
