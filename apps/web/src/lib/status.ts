import type { BadgeProps } from "@/components/ui/badge";

type Variant = NonNullable<BadgeProps["variant"]>;

/** Map any domain status string to a Badge variant + human label. */
const STATUS_VARIANT: Record<string, Variant> = {
  // generic / shared
  ACTIVE: "success",
  OPEN: "success",
  PUBLISHED: "success",
  APPROVED: "success",
  COMPLETED: "success",
  PAID: "success",
  SETTLED: "success",
  // pending-ish
  PENDING: "warning",
  REQUESTED: "warning",
  UNDER_REVIEW: "warning",
  PROCESSING: "info",
  INITIATED: "info",
  COMING_SOON: "info",
  IN_DEVELOPMENT: "info",
  NEEDS_MORE_INFO: "warning",
  WAITLIST: "info",
  MATURED: "info",
  // negative
  FAILED: "danger",
  REJECTED: "danger",
  CANCELLED: "danger",
  SUSPENDED: "danger",
  BANNED: "danger",
  REVOKED: "danger",
  REFUNDED: "default",
  // neutral
  DRAFT: "default",
  ARCHIVED: "default",
  CLOSED: "default",
  PLANNED: "default",
  NOT_STARTED: "default",
};

export function statusVariant(status: string): Variant {
  return STATUS_VARIANT[status] ?? "default";
}

/** "UNDER_REVIEW" -> "Under review" */
export function humanize(value: string): string {
  const lower = value.replace(/_/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Risk category -> badge variant. */
export function riskVariant(risk: string): Variant {
  switch (risk) {
    case "LOW":
      return "success";
    case "MEDIUM":
      return "warning";
    case "HIGH":
    case "VERY_HIGH":
      return "danger";
    default:
      return "default";
  }
}

/** The compliant label for a projection metric. */
export const PROJECTION_LABELS: Record<string, string> = {
  PROJECTED_OUTCOME: "Projected outcome",
  TARGET_PERFORMANCE: "Target performance",
  HISTORICAL_PERFORMANCE: "Historical performance",
};
