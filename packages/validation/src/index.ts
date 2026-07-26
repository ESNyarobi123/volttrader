/**
 * @volt/validation — shared Zod schemas used by BOTH the API (DTO validation)
 * and the web app (React Hook Form resolvers). Single source of truth for shapes.
 *
 * Body/DTO object schemas use `.strict()` so unknown fields are rejected
 * (CLAUDE.md / security rules).
 */
import { z } from "zod";
import {
  SUPPORTED_CURRENCIES,
  CourseLevel,
  RiskCategory,
} from "@volt/config";

/** Object schema that rejects unknown keys. */
function strictObject<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

/** Money is always an integer in minor units (e.g. senti/cents) + a currency. */
export const moneySchema = strictObject({
  amount: z.number().int().nonnegative(),
  currency: currencySchema,
});
export type Money = z.infer<typeof moneySchema>;

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[a-z]/, "Must include a lowercase letter")
  .regex(/[A-Z]/, "Must include an uppercase letter")
  .regex(/[0-9]/, "Must include a number");

export const phoneSchema = z
  .string()
  .regex(/^\+?[0-9]{7,15}$/, "Enter a valid phone number");

export const paginationSchema = strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof paginationSchema>;

// ---------------------------------------------------------------------------
// Auth (KYC-light registration: name + email/phone + password only)
// ---------------------------------------------------------------------------
export const registerSchema = strictObject({
  fullName: z.string().min(2).max(120),
  email: z.string().email().optional(),
  phone: phoneSchema.optional(),
  password: passwordSchema,
  country: z.string().min(2).max(60).optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to continue" }),
  }),
}).refine((d) => d.email || d.phone, {
  message: "Provide an email or a phone number",
  path: ["email"],
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = strictObject({
  identifier: z.string().min(3), // email or phone
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = strictObject({ refreshToken: z.string().min(10) });
export const forgotPasswordSchema = strictObject({ identifier: z.string().min(3) });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export const resetPasswordSchema = strictObject({
  token: z.string().min(10),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export const verifyEmailSchema = strictObject({ token: z.string().min(10) });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// ---------------------------------------------------------------------------
// Users / Profile
// ---------------------------------------------------------------------------
export const updateProfileSchema = strictObject({
  fullName: z.string().min(2).max(120).optional(),
  country: z.string().min(2).max(60).optional(),
  phone: phoneSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

const userRoleSchema = z.enum([
  "USER",
  "SUPPORT_AGENT",
  "CONTENT_MANAGER",
  "COMPLIANCE_OFFICER",
  "FINANCE_ADMIN",
  "SUPER_ADMIN",
]);
const userStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "BANNED"]);

/** Admin — create a user (staff or customer) with role + optional password. */
export const adminCreateUserSchema = strictObject({
  fullName: z.string().min(2).max(120),
  email: z.string().email().optional(),
  phone: phoneSchema.optional(),
  password: passwordSchema,
  country: z.string().min(2).max(60).optional(),
  role: userRoleSchema.default("USER"),
  status: userStatusSchema.default("ACTIVE"),
  emailVerified: z.boolean().optional(),
}).refine((d) => d.email || d.phone, {
  message: "Provide an email or a phone number",
  path: ["email"],
});
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

/** Admin — update profile, role, status, or reset password. */
export const adminUpdateUserSchema = strictObject({
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email().nullable().optional(),
  phone: phoneSchema.nullable().optional(),
  password: passwordSchema.optional(),
  country: z.string().min(2).max(60).nullable().optional(),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
  emailVerified: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, {
  message: "Provide at least one field to update",
});
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------
export const kycSubmissionSchema = strictObject({
  documentType: z.enum(["NATIONAL_ID", "PASSPORT", "DRIVER_LICENSE"]),
  documentNumber: z.string().min(3).max(60),
  frontImageKey: z.string().min(3), // object-storage key, uploaded via presigned URL
  backImageKey: z.string().min(3).optional(),
  selfieKey: z.string().min(3).optional(),
});
export type KycSubmissionInput = z.infer<typeof kycSubmissionSchema>;

// ---------------------------------------------------------------------------
// Courses (admin authoring)
// ---------------------------------------------------------------------------
export const courseUpsertSchema = strictObject({
  title: z.string().min(3).max(160),
  slug: z.string().min(3).max(160).regex(/^[a-z0-9-]+$/),
  level: z.nativeEnum(CourseLevel),
  shortDescription: z.string().max(300),
  description: z.string().max(5000),
  learningOutcomes: z.array(z.string()).default([]),
  price: moneySchema,
  accessType: z.enum(["FREE", "PAID"]).default("PAID"),
  durationMinutes: z.number().int().nonnegative().default(0),
  thumbnailKey: z.string().optional(),
  categoryId: z.string().optional(),
  /** Forex plan tier that unlocks this course (required for published academy content). */
  coursePlanId: z.string().min(1).nullable().optional(),
});
export type CourseUpsertInput = z.infer<typeof courseUpsertSchema>;

export const coursePlanSubscribeSchema = strictObject({
  coursePlanId: z.string().min(1),
  source: z.enum(["WALLET", "PAYMENT"]).default("WALLET"),
  gateway: z.string().min(1).max(40).optional(),
  idempotencyKey: z.string().uuid().optional(),
});
export type CoursePlanSubscribeInput = z.infer<typeof coursePlanSubscribeSchema>;

export const investmentPlanActivateSchema = strictObject({
  investmentPlanId: z.string().min(1),
});
export type InvestmentPlanActivateInput = z.infer<typeof investmentPlanActivateSchema>;

export const lessonUpsertSchema = strictObject({
  courseId: z.string(),
  title: z.string().min(3).max(160),
  order: z.number().int().nonnegative(),
  videoKey: z.string().optional(),
  content: z.string().max(20000).optional(),
  isPreview: z.boolean().default(false),
});
export type LessonUpsertInput = z.infer<typeof lessonUpsertSchema>;

export const lessonProgressSchema = strictObject({
  lessonId: z.string(),
  completed: z.boolean(),
  positionSeconds: z.number().int().nonnegative().optional(),
});

export const quizQuestionSchema = strictObject({
  id: z.string().min(1).max(64),
  prompt: z.string().min(3).max(500),
  choices: z.array(z.string().min(1).max(200)).min(2).max(6),
  correctIndex: z.number().int().nonnegative(),
}).refine((q) => q.correctIndex < q.choices.length, {
  message: "correctIndex must point to a choice",
  path: ["correctIndex"],
});
export type QuizQuestionInput = z.infer<typeof quizQuestionSchema>;

export const quizUpsertSchema = strictObject({
  title: z.string().min(3).max(160),
  passScore: z.number().int().min(1).max(100).default(70),
  questions: z.array(quizQuestionSchema).min(1).max(50),
});
export type QuizUpsertInput = z.infer<typeof quizUpsertSchema>;

export const quizSubmitSchema = strictObject({
  answers: z
    .array(
      strictObject({
        questionId: z.string().min(1),
        choiceIndex: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(50),
});
export type QuizSubmitInput = z.infer<typeof quizSubmitSchema>;

export const storagePresignUploadSchema = strictObject({
  purpose: z.enum(["lesson_video", "course_thumbnail", "certificate", "kyc"]),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(120),
});
export type StoragePresignUploadInput = z.infer<typeof storagePresignUploadSchema>;

// ---------------------------------------------------------------------------
// Opportunities (Trading Floor) — projections only, never guarantees
// ---------------------------------------------------------------------------
export const opportunityUpsertSchema = strictObject({
  name: z.string().min(3).max(160),
  slug: z.string().min(3).max(160).regex(/^[a-z0-9-]+$/),
  summary: z.string().max(300),
  description: z.string().max(5000),
  currency: currencySchema,
  minAmount: z.number().int().positive(),
  maxAmount: z.number().int().positive().optional(),
  durationDays: z.number().int().positive(),
  /** Configurable projection multiplier (e.g. 5 for "x5"). NOT a guarantee. */
  projectionMultiplier: z.number().positive().max(1000).default(1),
  projectionLabel: z
    .enum(["PROJECTED_OUTCOME", "TARGET_PERFORMANCE", "HISTORICAL_PERFORMANCE"])
    .default("PROJECTED_OUTCOME"),
  riskCategory: z.nativeEnum(RiskCategory),
  riskDisclosure: z.string().min(20, "A risk disclosure is required"),
  terms: z.string().min(20, "Terms are required"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  /** Management plan tier that unlocks this opportunity. */
  investmentPlanId: z.string().min(1).nullable().optional(),
});
export type OpportunityUpsertInput = z.infer<typeof opportunityUpsertSchema>;

// ---------------------------------------------------------------------------
// Investments
// ---------------------------------------------------------------------------
export const createInvestmentSchema = strictObject({
  opportunityId: z.string(),
  amount: z.number().int().positive(),
  /** funding source: wallet balance or a fresh payment intent */
  source: z.enum(["WALLET", "PAYMENT"]).default("WALLET"),
  acceptedRisk: z.literal(true, {
    errorMap: () => ({ message: "You must accept the risk disclosure" }),
  }),
  idempotencyKey: z.string().uuid().optional(),
});
export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;

// ---------------------------------------------------------------------------
// Wallet / Payments / Withdrawals
// ---------------------------------------------------------------------------
export const depositSchema = strictObject({
  amount: z.number().int().positive(),
  currency: currencySchema,
  /** Omit to use PAYMENT_DEFAULT_GATEWAY from server env. */
  gateway: z.string().min(1).max(40).optional(),
  idempotencyKey: z.string().uuid().optional(),
});
export type DepositInput = z.infer<typeof depositSchema>;

/**
 * Dev-only mock checkout confirmation. Server requires auth + ALLOW_MOCK_PAYMENTS;
 * never used as a production payment confirm path.
 */
export const mockPaymentSimulateSchema = strictObject({
  reference: z.string().min(3).max(120),
  status: z.enum(["PAID", "FAILED"]),
});
export type MockPaymentSimulateInput = z.infer<typeof mockPaymentSimulateSchema>;

/** User reports a bank/MM transfer against admin-published deposit details. */
export const manualDepositSchema = strictObject({
  amount: z.number().int().positive(),
  currency: currencySchema,
  channel: z.enum(["MOBILE_MONEY", "BANK_TRANSFER"]),
  /** Transaction id / phone / name the user used when paying. */
  payerReference: z.string().min(3).max(120),
  idempotencyKey: z.string().uuid().optional(),
});
export type ManualDepositInput = z.infer<typeof manualDepositSchema>;

/** Admin creates a payment intent on behalf of a user (still confirmed via webhook). */
export const adminCreatePaymentSchema = strictObject({
  userId: z.string().min(1),
  type: z.enum(["WALLET_DEPOSIT", "COURSE_PURCHASE", "INVESTMENT_FUNDING", "SHOP_PURCHASE"]),
  amount: z.number().int().positive(),
  currency: currencySchema,
  gateway: z.string().default("mock"),
  courseId: z.string().optional(),
  opportunityId: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),
});
export type AdminCreatePaymentInput = z.infer<typeof adminCreatePaymentSchema>;

/**
 * Admin may cancel / fail / flag open intents. Status PAID is never set here —
 * only a verified gateway webhook confirms payment.
 */
export const adminUpdatePaymentSchema = strictObject({
  status: z.enum(["PENDING", "FAILED", "CANCELLED", "UNDER_REVIEW"]).optional(),
  gateway: z.string().min(1).max(40).optional(),
}).refine((d) => Object.keys(d).length > 0, {
  message: "Provide at least one field to update",
});
export type AdminUpdatePaymentInput = z.infer<typeof adminUpdatePaymentSchema>;

export const courseCheckoutSchema = strictObject({
  courseId: z.string(),
  source: z.enum(["WALLET", "PAYMENT"]).default("PAYMENT"),
  gateway: z.string().default("mock"),
  couponCode: z.string().max(40).optional(),
  idempotencyKey: z.string().uuid().optional(),
});
export type CourseCheckoutInput = z.infer<typeof courseCheckoutSchema>;

export const withdrawalRequestSchema = strictObject({
  amount: z.number().int().positive(),
  currency: currencySchema,
  method: z.enum(["MOBILE_MONEY", "BANK_TRANSFER"]),
  destination: z.string().min(3).max(120), // masked account/phone
  /** Required when the member has 2FA enabled (always for self-serve withdraw). */
  totpCode: z.string().regex(/^\d{6}$/, "Enter the 6-digit authenticator code").optional(),
  idempotencyKey: z.string().uuid().optional(),
});
export type WithdrawalRequestInput = z.infer<typeof withdrawalRequestSchema>;

/** Admin creates a withdrawal on behalf of a user (holds funds via ledger). */
export const adminCreateWithdrawalSchema = withdrawalRequestSchema.extend({
  userId: z.string().min(1),
  skipKycCheck: z.boolean().optional(),
  skip2faCheck: z.boolean().optional(),
});
export type AdminCreateWithdrawalInput = z.infer<typeof adminCreateWithdrawalSchema>;

export const twoFactorCodeSchema = strictObject({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit authenticator code"),
});
export type TwoFactorCodeInput = z.infer<typeof twoFactorCodeSchema>;

export const twoFactorDisableSchema = strictObject({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit authenticator code"),
  password: z.string().min(8).max(128),
});
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;

/**
 * Admin may update destination/method/note while the request is still open.
 * Amount is immutable after the ledger hold is posted.
 */
export const adminUpdateWithdrawalSchema = strictObject({
  method: z.enum(["MOBILE_MONEY", "BANK_TRANSFER"]).optional(),
  destination: z.string().min(3).max(120).optional(),
  reviewerNote: z.string().max(1000).nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, {
  message: "Provide at least one field to update",
});
export type AdminUpdateWithdrawalInput = z.infer<typeof adminUpdateWithdrawalSchema>;

// ---------------------------------------------------------------------------
// Community (Volt Society) / Support
// ---------------------------------------------------------------------------
export const joinCommunitySchema = strictObject({
  motivation: z.string().max(500).optional(),
});
export type JoinCommunityInput = z.infer<typeof joinCommunitySchema>;

/** Admin adds a member (or re-queues) by user id. */
export const adminCreateCommunityMemberSchema = strictObject({
  userId: z.string().min(1),
  status: z.enum(["WAITLIST", "ACTIVE", "SUSPENDED"]).default("WAITLIST"),
  motivation: z.string().max(500).optional(),
});
export type AdminCreateCommunityMemberInput = z.infer<typeof adminCreateCommunityMemberSchema>;

export const adminUpdateCommunityMemberSchema = strictObject({
  status: z.enum(["WAITLIST", "ACTIVE", "SUSPENDED"]).optional(),
  motivation: z.string().max(500).nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, {
  message: "Provide at least one field to update",
});
export type AdminUpdateCommunityMemberInput = z.infer<typeof adminUpdateCommunityMemberSchema>;

export const supportTicketSchema = strictObject({
  subject: z.string().min(3).max(160),
  message: z.string().min(5).max(5000),
  category: z.enum(["GENERAL", "PAYMENTS", "COURSES", "INVESTMENTS", "KYC"]).default("GENERAL"),
});
export type SupportTicketInput = z.infer<typeof supportTicketSchema>;

export const contactSchema = strictObject({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  message: z.string().min(5).max(2000),
});

// ---------------------------------------------------------------------------
// Forex course plans (landing pricing cards — admin)
// ---------------------------------------------------------------------------
export const coursePlanUpsertSchema = strictObject({
  name: z.string().min(2).max(80),
  subtitle: z.string().min(2).max(160),
  price: moneySchema,
  billingPeriod: z.enum(["month", "year", "once"]),
  features: z.array(z.string().min(1).max(160)).min(1).max(20),
  ctaLabel: z.string().min(2).max(60).default("Get Started"),
  ctaHref: z.string().min(1).max(200).default("/register"),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
  published: z.boolean().default(false),
});
export type CoursePlanUpsertInput = z.infer<typeof coursePlanUpsertSchema>;

export const coursePlanUpdateSchema = coursePlanUpsertSchema.partial();
export type CoursePlanUpdateInput = z.infer<typeof coursePlanUpdateSchema>;

// ---------------------------------------------------------------------------
// Investment plans (landing pricing cards — admin)
// ---------------------------------------------------------------------------
export const investmentPlanUpsertSchema = strictObject({
  name: z.string().min(2).max(80),
  subtitle: z.string().min(2).max(160),
  minAmount: moneySchema,
  durationDays: z.number().int().positive().max(3650),
  projectionLabel: z.enum([
    "PROJECTED_OUTCOME",
    "TARGET_PERFORMANCE",
    "HISTORICAL_PERFORMANCE",
  ]),
  projectionHighlight: z.string().min(1).max(80),
  riskCategory: z.nativeEnum(RiskCategory),
  features: z.array(z.string().min(1).max(160)).min(1).max(20),
  ctaLabel: z.string().min(2).max(60).default("Explore floor"),
  ctaHref: z.string().min(1).max(200).default("/trading-floor"),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
  published: z.boolean().default(false),
});
export type InvestmentPlanUpsertInput = z.infer<typeof investmentPlanUpsertSchema>;

export const investmentPlanUpdateSchema = investmentPlanUpsertSchema.partial();
export type InvestmentPlanUpdateInput = z.infer<typeof investmentPlanUpdateSchema>;

// ---------------------------------------------------------------------------
// Coupons (admin)
// ---------------------------------------------------------------------------
export const couponUpsertSchema = strictObject({
  code: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, "Code must be uppercase letters, numbers, - or _"),
  percentOff: z.number().int().min(1).max(100).optional(),
  amountOff: z.number().int().positive().optional(), // minor units
  currency: currencySchema.optional(),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.coerce.date().optional(),
}).refine((d) => d.percentOff !== undefined || d.amountOff !== undefined, {
  message: "Provide percentOff or amountOff",
  path: ["percentOff"],
});
export type CouponUpsertInput = z.infer<typeof couponUpsertSchema>;

// ---------------------------------------------------------------------------
// Platform settings (admin)
// ---------------------------------------------------------------------------
export const platformSettingsUpdateSchema = strictObject({
  supportEmail: z.string().email().max(160).nullable().optional(),
  supportPhone: z.string().min(5).max(32).nullable().optional(),
  supportHours: z.string().max(120).nullable().optional(),
  maintenanceMode: z.boolean().optional(),
  registrationOpen: z.boolean().optional(),
  communityOpen: z.boolean().optional(),
  /** Integer minor units (e.g. cents / senti). */
  minDepositMinor: z.number().int().min(0).max(1_000_000_000_000).optional(),
  minWithdrawalMinor: z.number().int().min(0).max(1_000_000_000_000).optional(),
  depositMobileProvider: z.string().max(60).nullable().optional(),
  depositMobileNumber: z.string().max(40).nullable().optional(),
  depositMobileName: z.string().max(120).nullable().optional(),
  depositBankName: z.string().max(120).nullable().optional(),
  depositBankAccount: z.string().max(60).nullable().optional(),
  depositBankAccountName: z.string().max(120).nullable().optional(),
  depositInstructions: z.string().max(2000).nullable().optional(),
  depositManualEnabled: z.boolean().optional(),
  depositOnlineEnabled: z.boolean().optional(),
});
export type PlatformSettingsUpdateInput = z.infer<typeof platformSettingsUpdateSchema>;

// ---------------------------------------------------------------------------
// Landing page content (admin)
// ---------------------------------------------------------------------------
export const landingStatSchema = strictObject({
  value: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
});

/** Accepts a YouTube watch/embed/share URL or a bare 11-char video id. */
export const youtubeVideoInputSchema = z
  .string()
  .min(6)
  .max(200)
  .refine((value) => {
    const trimmed = value.trim();
    if (/^[\w-]{11}$/.test(trimmed)) return true;
    if (/youtu\.be\/([\w-]{11})/.test(trimmed)) return true;
    if (/[?&]v=([\w-]{11})/.test(trimmed)) return true;
    if (/youtube(?:-nocookie)?\.com\/(?:embed|shorts)\/([\w-]{11})/.test(trimmed)) return true;
    return false;
  }, "Enter a valid YouTube URL or video id");

export const landingPageUpdateSchema = strictObject({
  /** Full YouTube URL or 11-char id — API stores the id only. */
  heroYoutubeUrl: youtubeVideoInputSchema.optional(),
  heroEyebrow: z.string().min(2).max(80).optional(),
  heroHeadline: z.string().min(4).max(200).optional(),
  heroHeadlineAccent: z.string().max(160).nullable().optional(),
  heroSubcopy: z.string().min(10).max(800).optional(),
  ctaPrimaryLabel: z.string().min(2).max(60).optional(),
  ctaPrimaryHref: z.string().min(1).max(200).optional(),
  ctaSecondaryLabel: z.string().min(2).max(60).optional(),
  ctaSecondaryHref: z.string().min(1).max(200).optional(),
  stats: z.array(landingStatSchema).min(1).max(8).optional(),
  closingHeadline: z.string().min(4).max(240).optional(),
  closingSubcopy: z.string().min(4).max(500).optional(),
  closingCtaLabel: z.string().min(2).max(60).optional(),
  closingCtaHref: z.string().min(1).max(200).optional(),
});
export type LandingPageUpdateInput = z.infer<typeof landingPageUpdateSchema>;

