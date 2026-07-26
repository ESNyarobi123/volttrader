/**
 * @volt/types — shared API contract types (response envelopes + DTOs)
 * consumed by the web client. Money is always { amount, currency }.
 */
import type {
  Role,
  CourseLevel,
  CourseStatus,
  EnrollmentStatus,
  OpportunityStatus,
  RiskCategory,
  InvestmentStatus,
  PaymentStatus,
  PaymentType,
  WithdrawalStatus,
  KycStatus,
  ProjectStatus,
  ProjectCategory,
  Currency,
} from "@volt/config";

// Re-export shared enums/types so web can import from one package.
export type {
  Role,
  CourseLevel,
  CourseStatus,
  EnrollmentStatus,
  OpportunityStatus,
  RiskCategory,
  InvestmentStatus,
  PaymentStatus,
  PaymentType,
  WithdrawalStatus,
  KycStatus,
  ProjectStatus,
  ProjectCategory,
  Currency,
};

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------
export interface ApiSuccess<T> {
  data: T;
  meta?: PageMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Money {
  amount: number; // integer minor units
  currency: Currency;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: Role;
  emailVerified: boolean;
  kycStatus: KycStatus;
  /** Authenticator TOTP enabled — required for member withdrawals. */
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface TwoFactorSetupView {
  /** otpauth:// URI for authenticator apps / QR. */
  otpauthUrl: string;
  /** Manual entry secret (base32). Shown once during setup. */
  secret: string;
}

export interface AuthResponse {
  user: SessionUser;
  tokens: AuthTokens;
}

// ---------------------------------------------------------------------------
// Academy
// ---------------------------------------------------------------------------
export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  level: CourseLevel;
  shortDescription: string;
  price: Money;
  accessType: "FREE" | "PAID";
  durationMinutes: number;
  lessonsCount: number;
  thumbnailUrl: string | null;
  status: CourseStatus;
  coursePlanId?: string | null;
}

export interface CourseDetail extends CourseSummary {
  description: string;
  learningOutcomes: string[];
  lessons: LessonSummary[];
  enrolled: boolean;
  hasQuiz: boolean;
  certificate: CertificateView | null;
}

/** Public landing hero + closing CTA copy (admin-managed singleton). */
export interface LandingPageView {
  heroYoutubeId: string;
  heroEyebrow: string;
  heroHeadline: string;
  heroHeadlineAccent: string | null;
  heroSubcopy: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  stats: Array<{ value: string; label: string }>;
  closingHeadline: string;
  closingSubcopy: string;
  closingCtaLabel: string;
  closingCtaHref: string;
  updatedAt: string;
}

/** Landing-page Forex course pricing tier (admin-managed). */
export interface CoursePlanView {
  id: string;
  name: string;
  subtitle: string;
  price: Money;
  billingPeriod: "month" | "year" | "once";
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  featured: boolean;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Landing-page investment pricing tier (admin-managed). */
export interface InvestmentPlanView {
  id: string;
  name: string;
  subtitle: string;
  minAmount: Money;
  durationDays: number;
  projectionLabel: "PROJECTED_OUTCOME" | "TARGET_PERFORMANCE" | "HISTORICAL_PERFORMANCE";
  /** Target multiple on min entry — UI shows money total, never as a guarantee. */
  projectionMultiplier: number;
  /** Projected total at min entry = minAmount × multiplier (display helper). */
  projectedTotal: Money;
  projectionHighlight: string;
  riskCategory: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  featured: boolean;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LessonSummary {
  id: string;
  title: string;
  order: number;
  isPreview: boolean;
  durationSeconds: number;
  locked: boolean;
  /** Present when unlocked and lesson has text content. */
  content?: string | null;
  hasVideo?: boolean;
}

export interface EnrollmentView {
  id: string;
  course: CourseSummary;
  status: EnrollmentStatus;
  progressPercent: number;
  startedAt: string;
  completedAt: string | null;
  certificate: CertificateView | null;
}

export interface QuizQuestionView {
  id: string;
  prompt: string;
  choices: string[];
}

export interface QuizView {
  id: string;
  courseId: string;
  title: string;
  passScore: number;
  questions: QuizQuestionView[];
  /** Latest attempt for the current learner, if any. */
  latestResult?: QuizResultView | null;
}

export interface QuizResultView {
  id: string;
  score: number;
  passed: boolean;
  createdAt: string;
}

export interface CertificateView {
  id: string;
  courseId: string;
  courseTitle: string;
  certificateNumber: string;
  issuedAt: string;
  downloadUrl: string | null;
}

export interface LessonPlaybackView {
  lessonId: string;
  videoUrl: string | null;
  content: string | null;
  expiresInSeconds: number;
}

export interface StoragePresignView {
  key: string;
  uploadUrl: string;
  publicUrl: string | null;
  expiresInSeconds: number;
}

// ---------------------------------------------------------------------------
// Trading Floor
// ---------------------------------------------------------------------------
export interface OpportunitySummary {
  id: string;
  slug: string;
  name: string;
  summary: string;
  currency: Currency;
  minAmount: number;
  maxAmount: number | null;
  durationDays: number;
  projectionMultiplier: number;
  projectionLabel: "PROJECTED_OUTCOME" | "TARGET_PERFORMANCE" | "HISTORICAL_PERFORMANCE";
  riskCategory: RiskCategory;
  status: OpportunityStatus;
  investmentPlanId?: string | null;
}

export interface OpportunityDetail extends OpportunitySummary {
  description: string;
  riskDisclosure: string;
  terms: string;
  startDate: string | null;
  endDate: string | null;
}

export interface CoursePlanMembershipView {
  plan: CoursePlanView | null;
  plans: CoursePlanView[];
  courses: Array<CourseSummary & { locked: boolean; enrolled: boolean }>;
}

/** Published management plan with its investable opportunity (1:1 for members). */
export interface InvestmentPlanCatalogItem extends InvestmentPlanView {
  opportunityId: string | null;
  opportunitySlug: string | null;
}

/**
 * Member invest catalog: each plan is a package you can fund.
 * Users may hold multiple concurrent investments across plans.
 */
export interface InvestmentPlanMembershipView {
  plans: InvestmentPlanCatalogItem[];
}

export interface InvestmentView {
  id: string;
  opportunity: OpportunitySummary;
  principal: Money;
  projectedValue: Money; // principal * multiplier — a PROJECTION, not a guarantee
  status: InvestmentStatus;
  createdAt: string;
  maturesAt: string | null;
  settledValue: Money | null;
}

export interface PortfolioSummary {
  walletBalance: Money;
  totalInvested: Money;
  activeInvestments: number;
  projectedPortfolioValue: Money;
}

// ---------------------------------------------------------------------------
// Wallet / Payments / Withdrawals
// ---------------------------------------------------------------------------
export interface WalletView {
  balance: Money; // computed from ledger
  currency: Currency;
}

export interface LedgerEntryView {
  id: string;
  type: string;
  direction: "CREDIT" | "DEBIT";
  amount: Money;
  balanceAfter: Money;
  reference: string | null;
  createdAt: string;
}

export interface PaymentView {
  id: string;
  type: PaymentType;
  status: PaymentStatus;
  amount: Money;
  gateway: string;
  reference: string;
  checkoutUrl: string | null;
  createdAt: string;
  /** Present for manual deposits (channel + payer reference). */
  metadata?: Record<string, unknown> | null;
}

/** Admin-published deposit channels + which UX paths are enabled. */
export interface DepositMethodsView {
  manualEnabled: boolean;
  onlineEnabled: boolean;
  mobile: {
    provider: string;
    number: string;
    accountName: string;
  } | null;
  bank: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null;
  instructions: string | null;
  minDeposit: Money;
  currency: Currency;
  online: {
    gateway: string;
    available: boolean;
    label: string;
  } | null;
}

export interface WithdrawalView {
  id: string;
  amount: Money;
  method: "MOBILE_MONEY" | "BANK_TRANSFER";
  destinationMasked: string;
  status: WithdrawalStatus;
  createdAt: string;
  processedAt: string | null;
}

// ---------------------------------------------------------------------------
// Projects & Community
// ---------------------------------------------------------------------------
export interface ProjectView {
  id: string;
  slug: string;
  title: string;
  category: ProjectCategory;
  status: ProjectStatus;
  summary: string;
  description: string;
  coverUrl: string | null;
  milestones: { title: string; done: boolean }[];
}

export interface DashboardOverview {
  portfolio: PortfolioSummary;
  activeInvestments: InvestmentView[];
  courseProgress: EnrollmentView[];
  recentTransactions: LedgerEntryView[];
  unreadNotifications: number;
}
