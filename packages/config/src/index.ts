/**
 * @volt/config — shared constants, enums and domain vocabulary.
 * These string-literal enums are mirrored exactly in prisma/schema.prisma.
 * Keep them in sync: this package is the single source of truth for the app layer.
 */

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------
export const BRAND = {
  name: "Volt Trades",
  tagline: "LEARN. INVEST. BUILD.",
  positioning: "Learn Forex. Manage Capital. Explore Opportunities. Build the Future.",
} as const;

// ---------------------------------------------------------------------------
// Roles & RBAC
// ---------------------------------------------------------------------------
export const Role = {
  USER: "USER",
  SUPPORT_AGENT: "SUPPORT_AGENT",
  CONTENT_MANAGER: "CONTENT_MANAGER",
  COMPLIANCE_OFFICER: "COMPLIANCE_OFFICER",
  FINANCE_ADMIN: "FINANCE_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ADMIN_ROLES: Role[] = [
  Role.SUPPORT_AGENT,
  Role.CONTENT_MANAGER,
  Role.COMPLIANCE_OFFICER,
  Role.FINANCE_ADMIN,
  Role.SUPER_ADMIN,
];

// ---------------------------------------------------------------------------
// Course / Academy
// ---------------------------------------------------------------------------
export const CourseLevel = {
  BEGINNER: "BEGINNER",
  INTERMEDIATE: "INTERMEDIATE",
  ADVANCED: "ADVANCED",
  PREMIUM: "PREMIUM",
} as const;
export type CourseLevel = (typeof CourseLevel)[keyof typeof CourseLevel];

export const CourseStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus];

export const AccessType = { FREE: "FREE", PAID: "PAID" } as const;
export type AccessType = (typeof AccessType)[keyof typeof AccessType];

export const EnrollmentStatus = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  REVOKED: "REVOKED",
} as const;
export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

// ---------------------------------------------------------------------------
// Trading Floor / Opportunities & Investments
// ---------------------------------------------------------------------------
export const OpportunityStatus = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  SUSPENDED: "SUSPENDED",
  CLOSED: "CLOSED",
} as const;
export type OpportunityStatus = (typeof OpportunityStatus)[keyof typeof OpportunityStatus];

export const RiskCategory = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  VERY_HIGH: "VERY_HIGH",
} as const;
export type RiskCategory = (typeof RiskCategory)[keyof typeof RiskCategory];

export const InvestmentStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  MATURED: "MATURED",
  SETTLED: "SETTLED",
  CANCELLED: "CANCELLED",
} as const;
export type InvestmentStatus = (typeof InvestmentStatus)[keyof typeof InvestmentStatus];

// ---------------------------------------------------------------------------
// Wallet / Ledger / Payments
// ---------------------------------------------------------------------------
export const LedgerDirection = { CREDIT: "CREDIT", DEBIT: "DEBIT" } as const;
export type LedgerDirection = (typeof LedgerDirection)[keyof typeof LedgerDirection];

export const LedgerEntryType = {
  DEPOSIT: "DEPOSIT",
  COURSE_PURCHASE: "COURSE_PURCHASE",
  INVESTMENT_FUNDING: "INVESTMENT_FUNDING",
  INVESTMENT_SETTLEMENT: "INVESTMENT_SETTLEMENT",
  WITHDRAWAL: "WITHDRAWAL",
  WITHDRAWAL_REVERSAL: "WITHDRAWAL_REVERSAL",
  REFUND: "REFUND",
  ADJUSTMENT: "ADJUSTMENT",
} as const;
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType];

export const PaymentType = {
  COURSE_PURCHASE: "COURSE_PURCHASE",
  WALLET_DEPOSIT: "WALLET_DEPOSIT",
  INVESTMENT_FUNDING: "INVESTMENT_FUNDING",
  WITHDRAWAL: "WITHDRAWAL",
  SHOP_PURCHASE: "SHOP_PURCHASE",
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const PaymentStatus = {
  INITIATED: "INITIATED",
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
  UNDER_REVIEW: "UNDER_REVIEW",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const WithdrawalStatus = {
  REQUESTED: "REQUESTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  FAILED: "FAILED",
} as const;
export type WithdrawalStatus = (typeof WithdrawalStatus)[keyof typeof WithdrawalStatus];

export const PaymentGatewayId = {
  MOCK: "mock",
  FLUTTERWAVE: "flutterwave",
  PESAPAL: "pesapal",
  STRIPE: "stripe",
  MANUAL: "manual",
} as const;
export type PaymentGatewayId = (typeof PaymentGatewayId)[keyof typeof PaymentGatewayId];

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------
export const KycStatus = {
  NOT_STARTED: "NOT_STARTED",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  NEEDS_MORE_INFO: "NEEDS_MORE_INFO",
} as const;
export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];

// ---------------------------------------------------------------------------
// Projects & Community
// ---------------------------------------------------------------------------
export const ProjectStatus = {
  PLANNED: "PLANNED",
  COMING_SOON: "COMING_SOON",
  IN_DEVELOPMENT: "IN_DEVELOPMENT",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const ProjectCategory = {
  SHOP: "SHOP",
  COMMUNITY: "COMMUNITY",
  TECHNOLOGY: "TECHNOLOGY",
  EDUCATION: "EDUCATION",
  EVENTS: "EVENTS",
  FUTURE_VENTURES: "FUTURE_VENTURES",
} as const;
export type ProjectCategory = (typeof ProjectCategory)[keyof typeof ProjectCategory];

export const MembershipStatus = {
  WAITLIST: "WAITLIST",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

// ---------------------------------------------------------------------------
// Support / Notifications
// ---------------------------------------------------------------------------
export const TicketStatus = {
  OPEN: "OPEN",
  PENDING: "PENDING",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const NotificationType = {
  SYSTEM: "SYSTEM",
  PAYMENT: "PAYMENT",
  INVESTMENT: "INVESTMENT",
  COURSE: "COURSE",
  SECURITY: "SECURITY",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------
export const SUPPORTED_CURRENCIES = ["TZS", "USD", "KES", "UGX"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** Minor units per major unit. TZS/UGX have no minor unit in practice; use 100 for consistency of storage. */
export const CURRENCY_MINOR_UNITS: Record<Currency, number> = {
  TZS: 100,
  USD: 100,
  KES: 100,
  UGX: 100,
};

// ---------------------------------------------------------------------------
// API route groups (mirror the spec's Core API groups)
// ---------------------------------------------------------------------------
export const API_ROUTES = {
  auth: "auth",
  users: "users",
  kyc: "kyc",
  courses: "courses",
  enrollments: "enrollments",
  opportunities: "opportunities",
  investments: "investments",
  wallet: "wallet",
  payments: "payments",
  withdrawals: "withdrawals",
  projects: "projects",
  community: "community",
  notifications: "notifications",
  support: "support",
  admin: "admin",
} as const;
