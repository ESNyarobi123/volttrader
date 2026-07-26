import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSIONS = [
  ["users.manage", "Create, suspend and edit users"],
  ["kyc.review", "Review and approve/reject KYC submissions"],
  ["courses.manage", "Create and edit courses, lessons and categories"],
  ["opportunities.manage", "Create and edit trading-floor opportunities"],
  ["payments.view", "View payments and transactions"],
  ["withdrawals.approve", "Approve or reject withdrawal requests"],
  ["investments.settle", "Settle matured investments"],
  ["projects.manage", "Manage projects and roadmap"],
  ["reports.view", "View reports and KPIs"],
  ["audit.view", "View audit logs"],
] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p[0]),
  FINANCE_ADMIN: ["payments.view", "withdrawals.approve", "investments.settle", "reports.view"],
  CONTENT_MANAGER: ["courses.manage", "projects.manage"],
  COMPLIANCE_OFFICER: ["kyc.review", "audit.view", "reports.view"],
  SUPPORT_AGENT: ["users.manage"],
};

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Demo credentials. Dev keeps fixed passwords for convenience; production must
 * supply its own (see {@link assertSeedAllowed}) so no deployment ends up with a
 * super admin whose password is published in this repository.
 */
function seedPassword(envKey: string, devDefault: string): string {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  if (IS_PRODUCTION) throw new Error(`${envKey} must be set when seeding a production database`);
  return devDefault;
}

/**
 * This script writes demo users, payments and ledger entries. Running it against
 * a live database is destructive-by-accident, so production requires an explicit
 * opt-in on top of the per-account passwords above.
 */
function assertSeedAllowed(): void {
  if (!IS_PRODUCTION) return;
  if (process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error(
      "Refusing to seed demo data with NODE_ENV=production. Set SEED_ALLOW_PRODUCTION=true (plus SEED_ADMIN_PASSWORD / SEED_STAFF_PASSWORD / SEED_DEMO_PASSWORD) if this is really intended.",
    );
  }
}

const RISK =
  "Trading and investment involve substantial risk of loss. Projected outcomes are targets, NOT guarantees. Past performance does not guarantee future results. Only invest what you can afford to lose.";
const TERMS =
  "By investing you accept the Volt Trades terms, the risk disclosure, and confirm the funds are your own.";

type DemoUserSeed = {
  key: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  kycStatus: "NOT_STARTED" | "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";
};

const DEMO_USERS: DemoUserSeed[] = [
  {
    key: "01",
    fullName: "Amina Juma",
    email: "amina.juma@volttrades.local",
    phone: "+255710000001",
    country: "Tanzania",
    kycStatus: "APPROVED",
  },
  {
    key: "02",
    fullName: "Joseph Mwangi",
    email: "joseph.mwangi@volttrades.local",
    phone: "+255710000002",
    country: "Kenya",
    kycStatus: "APPROVED",
  },
  {
    key: "03",
    fullName: "Fatma Hassan",
    email: "fatma.hassan@volttrades.local",
    phone: "+255710000003",
    country: "Tanzania",
    kycStatus: "PENDING",
  },
  {
    key: "04",
    fullName: "Daniel Okello",
    email: "daniel.okello@volttrades.local",
    phone: "+255710000004",
    country: "Uganda",
    kycStatus: "APPROVED",
  },
  {
    key: "05",
    fullName: "Neema Kimaro",
    email: "neema.kimaro@volttrades.local",
    phone: "+255710000005",
    country: "Tanzania",
    kycStatus: "NEEDS_MORE_INFO",
  },
  {
    key: "06",
    fullName: "Brian Otieno",
    email: "brian.otieno@volttrades.local",
    phone: "+255710000006",
    country: "Kenya",
    kycStatus: "APPROVED",
  },
  {
    key: "07",
    fullName: "Grace Mushi",
    email: "grace.mushi@volttrades.local",
    phone: "+255710000007",
    country: "Tanzania",
    kycStatus: "NOT_STARTED",
  },
  {
    key: "08",
    fullName: "Samuel Adeyemi",
    email: "samuel.adeyemi@volttrades.local",
    phone: "+255710000008",
    country: "Nigeria",
    kycStatus: "REJECTED",
  },
  {
    key: "09",
    fullName: "Halima Said",
    email: "halima.said@volttrades.local",
    phone: "+255710000009",
    country: "Tanzania",
    kycStatus: "APPROVED",
  },
  {
    key: "10",
    fullName: "Peter Chanda",
    email: "peter.chanda@volttrades.local",
    phone: "+255710000010",
    country: "Zambia",
    kycStatus: "PENDING",
  },
];

async function getBalance(userId: string): Promise<bigint> {
  const rows = await prisma.ledgerEntry.groupBy({
    by: ["direction"],
    where: { userId },
    _sum: { amount: true },
  });
  let credit = 0n;
  let debit = 0n;
  for (const row of rows) {
    const sum = row._sum.amount ?? 0n;
    if (row.direction === "CREDIT") credit = sum;
    else debit = sum;
  }
  return credit - debit;
}

async function postLedger(params: {
  userId: string;
  walletId: string;
  direction: "CREDIT" | "DEBIT";
  type:
    | "DEPOSIT"
    | "COURSE_PURCHASE"
    | "INVESTMENT_FUNDING"
    | "INVESTMENT_SETTLEMENT"
    | "WITHDRAWAL"
    | "WITHDRAWAL_REVERSAL"
    | "REFUND"
    | "ADJUSTMENT";
  amount: bigint;
  reference: string;
  paymentId?: string;
  investmentId?: string;
  withdrawalId?: string;
  metadata?: Prisma.InputJsonValue;
  /** Backdate for cashflow charts in showcase seeds. */
  createdAt?: Date;
}) {
  const existing = await prisma.ledgerEntry.findFirst({
    where: { reference: params.reference, type: params.type },
  });
  if (existing) return existing;

  const current = await getBalance(params.userId);
  const delta = params.direction === "CREDIT" ? params.amount : -params.amount;
  const balanceAfter = current + delta;
  if (params.direction === "DEBIT" && balanceAfter < 0n) {
    throw new Error(`Seed ledger would go negative for ${params.reference}`);
  }

  return prisma.ledgerEntry.create({
    data: {
      walletId: params.walletId,
      userId: params.userId,
      direction: params.direction,
      type: params.type,
      amount: params.amount,
      currency: "TZS",
      balanceAfter,
      reference: params.reference,
      paymentId: params.paymentId,
      investmentId: params.investmentId,
      withdrawalId: params.withdrawalId,
      metadata: params.metadata,
      ...(params.createdAt ? { createdAt: params.createdAt } : {}),
    },
  });
}

async function upsertPayment(data: {
  reference: string;
  userId: string;
  type: "COURSE_PURCHASE" | "WALLET_DEPOSIT" | "INVESTMENT_FUNDING";
  status: "INITIATED" | "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  amount: bigint;
  courseId?: string;
  opportunityId?: string;
  paidAt?: Date | null;
}) {
  return prisma.payment.upsert({
    where: { reference: data.reference },
    update: {
      status: data.status,
      paidAt: data.paidAt ?? undefined,
    },
    create: {
      userId: data.userId,
      type: data.type,
      status: data.status,
      amount: data.amount,
      currency: "TZS",
      gateway: "mock",
      reference: data.reference,
      idempotencyKey: `idem-${data.reference}`,
      courseId: data.courseId,
      opportunityId: data.opportunityId,
      paidAt: data.paidAt ?? null,
      checkoutUrl: `https://pay.mock.local/checkout/${data.reference}`,
    },
  });
}

async function main() {
  assertSeedAllowed();
  const ADMIN_PASSWORD = seedPassword("SEED_ADMIN_PASSWORD", "Admin@12345");
  const STAFF_PASSWORD = seedPassword("SEED_STAFF_PASSWORD", "Staff@12345");
  const DEMO_USER_PASSWORD = seedPassword("SEED_DEMO_PASSWORD", "User@12345");

  console.log("Seeding Volt Trades demo data…");

  // --- Permissions + role mappings ---
  for (const [key, description] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }
  for (const [role, keys] of Object.entries(ROLE_PERMISSIONS)) {
    for (const key of keys) {
      const perm = await prisma.permission.findUnique({ where: { key } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role: role as never, permissionId: perm.id } },
        update: {},
        create: { role: role as never, permissionId: perm.id },
      });
    }
  }

  // --- Platform settings ---
  await prisma.platformSettings.upsert({
    where: { id: "default" },
    update: {
      depositMobileProvider: "M-Pesa",
      depositMobileNumber: "255700000001",
      depositMobileName: "Volt Trades Ltd",
      depositBankName: "CRDB Bank",
      depositBankAccount: "0150123456789",
      depositBankAccountName: "Volt Trades Ltd",
      depositInstructions:
        "Send the exact amount, then submit your deposit with the transaction ID. Finance confirms before wallet credit.",
    },
    create: {
      id: "default",
      supportEmail: "support@volttrades.local",
      supportPhone: "+255700000000",
      supportHours: "Mon–Fri 09:00–17:00 EAT",
      maintenanceMode: false,
      registrationOpen: true,
      communityOpen: true,
      minDepositMinor: 100000n,
      minWithdrawalMinor: 500000n,
      depositMobileProvider: "M-Pesa",
      depositMobileNumber: "255700000001",
      depositMobileName: "Volt Trades Ltd",
      depositBankName: "CRDB Bank",
      depositBankAccount: "0150123456789",
      depositBankAccountName: "Volt Trades Ltd",
      depositInstructions:
        "Send the exact amount, then submit your deposit with the transaction ID. Finance confirms before wallet credit.",
    },
  });

  // --- Super admin ---
  const adminEmail = "admin@volttrades.local";
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      fullName: "Volt Super Admin",
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: "SUPER_ADMIN",
      emailVerified: true,
      kycStatus: "APPROVED",
      acceptedTermsAt: new Date(),
      country: "Tanzania",
    },
  });
  await prisma.wallet.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, currency: "TZS" },
  });

  // Light staff accounts for admin RBAC demos
  const staffPassword = await bcrypt.hash(STAFF_PASSWORD, 12);
  const finance = await prisma.user.upsert({
    where: { email: "finance@volttrades.local" },
    update: {},
    create: {
      fullName: "Finance Admin",
      email: "finance@volttrades.local",
      passwordHash: staffPassword,
      role: "FINANCE_ADMIN",
      emailVerified: true,
      acceptedTermsAt: new Date(),
      country: "Tanzania",
    },
  });
  await prisma.wallet.upsert({
    where: { userId: finance.id },
    update: {},
    create: { userId: finance.id, currency: "TZS" },
  });

  const supportAgent = await prisma.user.upsert({
    where: { email: "support@volttrades.local" },
    update: {},
    create: {
      fullName: "Support Agent",
      email: "support@volttrades.local",
      passwordHash: staffPassword,
      role: "SUPPORT_AGENT",
      emailVerified: true,
      acceptedTermsAt: new Date(),
      country: "Tanzania",
    },
  });
  await prisma.wallet.upsert({
    where: { userId: supportAgent.id },
    update: {},
    create: { userId: supportAgent.id, currency: "TZS" },
  });

  // --- Categories + courses ---
  const forex = await prisma.category.upsert({
    where: { slug: "forex" },
    update: {},
    create: { name: "Forex", slug: "forex" },
  });
  const riskCat = await prisma.category.upsert({
    where: { slug: "risk-management" },
    update: {},
    create: { name: "Risk Management", slug: "risk-management" },
  });

  const coursesSeed = [
    {
      slug: "forex-foundation",
      title: "Forex Foundation",
      level: "BEGINNER" as const,
      shortDescription: "Start here: the language, mechanics and mindset of the Forex market.",
      price: 0n,
      accessType: "FREE" as const,
      categoryId: forex.id,
    },
    {
      slug: "technical-analysis",
      title: "Technical Analysis",
      level: "INTERMEDIATE" as const,
      shortDescription: "Read charts, structure and indicators to time the market.",
      price: 4900000n,
      accessType: "PAID" as const,
      categoryId: forex.id,
    },
    {
      slug: "professional-trading-strategy",
      title: "Professional Trading & Strategy",
      level: "ADVANCED" as const,
      shortDescription: "Build, backtest and manage a professional trading strategy.",
      price: 9900000n,
      accessType: "PAID" as const,
      categoryId: forex.id,
    },
    {
      slug: "complete-forex-mastery",
      title: "Complete Forex Mastery",
      level: "PREMIUM" as const,
      shortDescription: "The full path from beginner to consistently disciplined trader.",
      price: 19900000n,
      accessType: "PAID" as const,
      categoryId: forex.id,
    },
    {
      slug: "risk-and-psychology",
      title: "Risk & Trading Psychology",
      level: "INTERMEDIATE" as const,
      shortDescription: "Protect capital and stay disciplined under pressure.",
      price: 3900000n,
      accessType: "PAID" as const,
      categoryId: riskCat.id,
    },
    {
      slug: "price-action-essentials",
      title: "Price Action Essentials",
      level: "BEGINNER" as const,
      shortDescription: "Trade structure, candles and levels without indicator clutter.",
      price: 2900000n,
      accessType: "PAID" as const,
      categoryId: forex.id,
    },
  ];

  const courses: { id: string; slug: string; price: bigint }[] = [];
  for (const c of coursesSeed) {
    const course = await prisma.course.upsert({
      where: { slug: c.slug },
      update: {
        title: c.title,
        shortDescription: c.shortDescription,
        priceAmount: c.price,
        status: "PUBLISHED",
      },
      create: {
        slug: c.slug,
        title: c.title,
        level: c.level,
        shortDescription: c.shortDescription,
        description: `${c.title}. Delivered by the Volt Trades Forex Academy.`,
        learningOutcomes: ["Understand the market", "Manage risk", "Practice with discipline"],
        priceAmount: c.price,
        priceCurrency: "TZS",
        accessType: c.accessType,
        durationMinutes: 240,
        status: "PUBLISHED",
        categoryId: c.categoryId,
      },
    });
    courses.push({ id: course.id, slug: course.slug, price: c.price });
    const lessonCount = await prisma.lesson.count({ where: { courseId: course.id } });
    if (lessonCount === 0) {
      await prisma.lesson.createMany({
        data: [
          {
            courseId: course.id,
            title: "Introduction",
            order: 1,
            isPreview: true,
            durationSeconds: 600,
            content: "Welcome to the course.",
          },
          {
            courseId: course.id,
            title: "Core concepts",
            order: 2,
            durationSeconds: 900,
            content: "Key ideas you will use every session.",
          },
          {
            courseId: course.id,
            title: "Practice & review",
            order: 3,
            durationSeconds: 900,
            content: "Apply what you learned with guided practice.",
          },
        ],
      });
    }

    if (course.slug === "forex-foundation") {
      await prisma.quiz.upsert({
        where: { courseId: course.id },
        create: {
          courseId: course.id,
          title: "Forex Foundation check",
          passScore: 70,
          questions: [
            {
              id: "q1",
              prompt: "What does PIP typically measure in Forex?",
              choices: ["Price interest point / smallest common price move", "Broker fee", "Leverage ratio", "Account currency"],
              correctIndex: 0,
            },
            {
              id: "q2",
              prompt: "Risk management primarily helps you:",
              choices: ["Guarantee profits", "Control loss size per trade", "Predict news", "Avoid charts"],
              correctIndex: 1,
            },
            {
              id: "q3",
              prompt: "A projected outcome on Volt Trades means:",
              choices: ["A guaranteed return", "A target/projection, not a guarantee", "A bank interest rate", "A tax refund"],
              correctIndex: 1,
            },
          ],
        },
        update: {
          title: "Forex Foundation check",
          passScore: 70,
        },
      });
    }
  }

  // --- Opportunities ---
  const opportunitiesSeed = [
    {
      slug: "growth-managed-account",
      name: "Growth Managed Account",
      summary: "A managed Forex allocation with a projected growth target.",
      minAmount: 10000000n,
      multiplier: "5",
      risk: "HIGH" as const,
      durationDays: 90,
    },
    {
      slug: "starter-allocation",
      name: "Starter Allocation",
      summary: "A lower-entry allocation for first-time participants.",
      minAmount: 2000000n,
      multiplier: "2",
      risk: "MEDIUM" as const,
      durationDays: 60,
    },
    {
      slug: "balanced-floor",
      name: "Balanced Floor",
      summary: "A mid-risk managed allocation with a moderate projected outcome.",
      minAmount: 5000000n,
      multiplier: "3",
      risk: "MEDIUM" as const,
      durationDays: 75,
    },
    {
      slug: "conservative-preserve",
      name: "Conservative Preserve",
      summary: "Lower-risk allocation focused on capital discipline.",
      minAmount: 3000000n,
      multiplier: "1.5",
      risk: "LOW" as const,
      durationDays: 45,
    },
    {
      slug: "momentum-sprint",
      name: "Momentum Sprint",
      summary: "Shorter-duration allocation with a higher projected target.",
      minAmount: 7500000n,
      multiplier: "4",
      risk: "VERY_HIGH" as const,
      durationDays: 30,
    },
  ];

  const opportunities: { id: string; slug: string; minAmount: bigint; multiplier: string }[] = [];
  for (const o of opportunitiesSeed) {
    const row = await prisma.opportunity.upsert({
      where: { slug: o.slug },
      update: { status: "OPEN", summary: o.summary },
      create: {
        slug: o.slug,
        name: o.name,
        summary: o.summary,
        description: `${o.name}. Managed by Volt Trades Trading Floor.`,
        currency: "TZS",
        minAmount: o.minAmount,
        durationDays: o.durationDays,
        projectionMultiplier: o.multiplier,
        projectionLabel: "PROJECTED_OUTCOME",
        riskCategory: o.risk,
        riskDisclosure: RISK,
        terms: TERMS,
        status: "OPEN",
      },
    });
    opportunities.push({
      id: row.id,
      slug: row.slug,
      minAmount: o.minAmount,
      multiplier: o.multiplier,
    });
  }

  // --- Projects (incl. Volt Society / Shop) ---
  const projectsSeed = [
    {
      slug: "volt-shop",
      title: "Volt Shop",
      category: "SHOP" as const,
      status: "COMING_SOON" as const,
      order: 1,
    },
    {
      slug: "volt-society",
      title: "Volt Society",
      category: "COMMUNITY" as const,
      status: "IN_DEVELOPMENT" as const,
      order: 2,
    },
    {
      slug: "academy-live-desk",
      title: "Academy Live Desk",
      category: "EDUCATION" as const,
      status: "ACTIVE" as const,
      order: 3,
    },
    {
      slug: "member-events",
      title: "Member Events",
      category: "EVENTS" as const,
      status: "PLANNED" as const,
      order: 4,
    },
    {
      slug: "trading-tools-lab",
      title: "Trading Tools Lab",
      category: "TECHNOLOGY" as const,
      status: "IN_DEVELOPMENT" as const,
      order: 5,
    },
    {
      slug: "future-ventures-hub",
      title: "Future Ventures Hub",
      category: "FUTURE_VENTURES" as const,
      status: "PLANNED" as const,
      order: 6,
    },
  ];
  for (const p of projectsSeed) {
    await prisma.project.upsert({
      where: { slug: p.slug },
      update: { title: p.title, status: p.status, order: p.order },
      create: {
        slug: p.slug,
        title: p.title,
        category: p.category,
        status: p.status,
        order: p.order,
        summary: `${p.title} — part of the Volt Trades ecosystem roadmap.`,
        description: `${p.title} is a venture within the Volt Trades ecosystem (Learn · Invest · Build).`,
        milestones: [
          { title: "Concept", done: true },
          { title: "Design", done: p.status !== "PLANNED" },
          { title: "Build", done: p.status === "ACTIVE" },
          { title: "Launch", done: false },
        ],
      },
    });
  }

  // --- Forex course plans (landing pricing cards) ---
  const coursePlansSeed = [
    {
      name: "Starter",
      subtitle: "Best for beginners exploring Forex",
      priceAmount: 0n,
      billingPeriod: "month",
      featured: false,
      sortOrder: 0,
      features: [
        "Foundation course access",
        "Community waitlist invite",
        "Weekly market notes",
        "Email support",
      ],
      ctaLabel: "Start free",
    },
    {
      name: "Essential",
      subtitle: "Best for personal skill building",
      priceAmount: 80_000_00n, // 80,000 TZS
      billingPeriod: "month",
      featured: false,
      sortOrder: 1,
      features: [
        "All Starter benefits",
        "Core academy catalogue",
        "Quizzes & progress tracking",
        "Certificate on completion",
        "Priority lesson updates",
      ],
      ctaLabel: "Get started",
    },
    {
      name: "Pro",
      subtitle: "Best for serious traders",
      priceAmount: 150_000_00n, // 150,000 TZS
      billingPeriod: "month",
      featured: true,
      sortOrder: 2,
      features: [
        "All Essential benefits",
        "Advanced strategy tracks",
        "Live session recordings",
        "Mentor Q&A access",
        "Trading Floor preview",
        "Priority support",
      ],
      ctaLabel: "Choose Pro",
    },
    {
      name: "Mastery",
      subtitle: "Best for teams & power users",
      priceAmount: 250_000_00n, // 250,000 TZS
      billingPeriod: "month",
      featured: false,
      sortOrder: 3,
      features: [
        "All Pro benefits",
        "Full academy library",
        "1:1 onboarding call",
        "Custom learning path",
        "Early access to new courses",
        "Dedicated success manager",
      ],
      ctaLabel: "Go Mastery",
    },
  ];
  for (const plan of coursePlansSeed) {
    const existing = await prisma.coursePlan.findFirst({ where: { name: plan.name } });
    const data = {
      subtitle: plan.subtitle,
      priceAmount: plan.priceAmount,
      priceCurrency: "TZS" as const,
      billingPeriod: plan.billingPeriod,
      features: plan.features,
      ctaLabel: plan.ctaLabel,
      ctaHref: "/register",
      featured: plan.featured,
      sortOrder: plan.sortOrder,
      published: true,
    };
    if (existing) {
      await prisma.coursePlan.update({ where: { id: existing.id }, data });
    } else {
      await prisma.coursePlan.create({ data: { name: plan.name, ...data } });
    }
  }

  // --- Investment plans (landing pricing cards) ---
  const investmentPlansSeed = [
    {
      name: "Spark",
      subtitle: "Best for first-time capital allocation",
      minAmount: 50_000_00n,
      durationDays: 30,
      projectionLabel: "TARGET_PERFORMANCE" as const,
      projectionHighlight: "1.3× target",
      riskCategory: "LOW" as const,
      featured: false,
      sortOrder: 0,
      features: [
        "Lower entry amount",
        "Short 30-day cycle",
        "Ledger-tracked funding",
        "Risk disclosure before invest",
        "Portfolio status tracking",
      ],
      ctaLabel: "Start on floor",
    },
    {
      name: "Momentum",
      subtitle: "Best for balanced growth seekers",
      minAmount: 150_000_00n,
      durationDays: 60,
      projectionLabel: "PROJECTED_OUTCOME" as const,
      projectionHighlight: "1.8× projected",
      riskCategory: "MEDIUM" as const,
      featured: false,
      sortOrder: 1,
      features: [
        "All Spark benefits",
        "60-day structured window",
        "Curated opportunity access",
        "Dashboard performance view",
        "Priority floor alerts",
      ],
      ctaLabel: "View Momentum",
    },
    {
      name: "Velocity",
      subtitle: "Best for active capital managers",
      minAmount: 500_000_00n,
      durationDays: 90,
      projectionLabel: "TARGET_PERFORMANCE" as const,
      projectionHighlight: "2.5× target",
      riskCategory: "HIGH" as const,
      featured: true,
      sortOrder: 2,
      features: [
        "All Momentum benefits",
        "Higher capacity slots",
        "Extended 90-day horizon",
        "Settlement via immutable ledger",
        "Terms & risk acceptance flow",
        "Dedicated invest support path",
      ],
      ctaLabel: "Choose Velocity",
    },
    {
      name: "Summit",
      subtitle: "Best for experienced allocators",
      minAmount: 1_000_000_00n,
      durationDays: 120,
      projectionLabel: "HISTORICAL_PERFORMANCE" as const,
      projectionHighlight: "3.0× historical",
      riskCategory: "VERY_HIGH" as const,
      featured: false,
      sortOrder: 3,
      features: [
        "All Velocity benefits",
        "Premium opportunity tiers",
        "Longer settlement window",
        "Full portfolio analytics",
        "Early access to new packages",
        "Compliance-first disclosures",
      ],
      ctaLabel: "Go Summit",
    },
  ];
  for (const plan of investmentPlansSeed) {
    const existing = await prisma.investmentPlan.findFirst({ where: { name: plan.name } });
    const data = {
      subtitle: plan.subtitle,
      minAmount: plan.minAmount,
      currency: "TZS" as const,
      durationDays: plan.durationDays,
      projectionLabel: plan.projectionLabel,
      projectionHighlight: plan.projectionHighlight,
      riskCategory: plan.riskCategory,
      features: plan.features,
      ctaLabel: plan.ctaLabel,
      ctaHref: "/trading-floor",
      featured: plan.featured,
      sortOrder: plan.sortOrder,
      published: true,
    };
    if (existing) {
      await prisma.investmentPlan.update({ where: { id: existing.id }, data });
    } else {
      await prisma.investmentPlan.create({ data: { name: plan.name, ...data } });
    }
  }

  // --- Coupons ---
  const coupons = [
    { code: "WELCOME10", percentOff: 10, maxRedemptions: 200 },
    { code: "ACADEMY20", percentOff: 20, maxRedemptions: 100 },
    { code: "VOLT5000", amountOff: 500000n, maxRedemptions: 50 },
    { code: "SOCIETY15", percentOff: 15, maxRedemptions: 75 },
    { code: "FLASH25", percentOff: 25, maxRedemptions: 25 },
    { code: "LOYALTY8", percentOff: 8, maxRedemptions: 500 },
    { code: "NEWYEAR30", percentOff: 30, maxRedemptions: 30 },
    { code: "TZS10000", amountOff: 1000000n, maxRedemptions: 40 },
  ];
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 6);
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { active: true, expiresAt },
      create: {
        code: c.code,
        percentOff: c.percentOff ?? null,
        amountOff: c.amountOff ?? null,
        currency: c.amountOff ? "TZS" : null,
        maxRedemptions: c.maxRedemptions,
        expiresAt,
        active: true,
        redemptions: Math.floor(Math.random() * 5),
      },
    });
  }

  // --- 10 demo members + related data ---
  const userPasswordHash = await bcrypt.hash(DEMO_USER_PASSWORD, 12);
  const createdUsers: { id: string; key: string; walletId: string; kycStatus: DemoUserSeed["kycStatus"] }[] =
    [];

  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        phone: u.phone,
        country: u.country,
        kycStatus: u.kycStatus,
        emailVerified: true,
        status: "ACTIVE",
      },
      create: {
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        country: u.country,
        passwordHash: userPasswordHash,
        role: "USER",
        emailVerified: true,
        kycStatus: u.kycStatus,
        acceptedTermsAt: new Date(),
        status: "ACTIVE",
      },
    });
    const wallet = await prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, currency: "TZS" },
    });
    createdUsers.push({
      id: user.id,
      key: u.key,
      walletId: wallet.id,
      kycStatus: u.kycStatus,
    });
  }

  // KYC submissions
  for (const u of createdUsers) {
    if (u.kycStatus === "NOT_STARTED") continue;
    const existing = await prisma.kycSubmission.findFirst({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      await prisma.kycSubmission.update({
        where: { id: existing.id },
        data: {
          status: u.kycStatus,
          reviewerNote:
            u.kycStatus === "APPROVED"
              ? "Documents verified."
              : u.kycStatus === "REJECTED"
                ? "Document photo unclear."
                : u.kycStatus === "NEEDS_MORE_INFO"
                  ? "Please re-upload a clearer selfie."
                  : null,
          reviewedById:
            u.kycStatus === "PENDING" ? null : admin.id,
          reviewedAt: u.kycStatus === "PENDING" ? null : new Date(),
        },
      });
      continue;
    }
    await prisma.kycSubmission.create({
      data: {
        userId: u.id,
        documentType: Number(u.key) % 2 === 0 ? "PASSPORT" : "NATIONAL_ID",
        documentNumber: `NIDA-SEED-${u.key}`,
        frontImageKey: `kyc/seed/${u.key}/front.jpg`,
        backImageKey: `kyc/seed/${u.key}/back.jpg`,
        selfieKey: `kyc/seed/${u.key}/selfie.jpg`,
        status: u.kycStatus,
        reviewerNote:
          u.kycStatus === "APPROVED"
            ? "Documents verified."
            : u.kycStatus === "REJECTED"
              ? "Document photo unclear."
              : u.kycStatus === "NEEDS_MORE_INFO"
                ? "Please re-upload a clearer selfie."
                : null,
        reviewedById: u.kycStatus === "PENDING" ? null : admin.id,
        reviewedAt: u.kycStatus === "PENDING" ? null : new Date(),
      },
    });
  }

  // Wallet deposits + ledger (each member gets funded)
  for (const [i, u] of createdUsers.entries()) {
    const depositAmount = BigInt(2_000_000 + i * 1_500_000) * 100n; // major*100 → minor
    const payRef = `SEED-DEP-${u.key}`;
    const payment = await upsertPayment({
      reference: payRef,
      userId: u.id,
      type: "WALLET_DEPOSIT",
      status: "PAID",
      amount: depositAmount,
      paidAt: new Date(Date.now() - (10 - i) * 86_400_000),
    });
    await postLedger({
      userId: u.id,
      walletId: u.walletId,
      direction: "CREDIT",
      type: "DEPOSIT",
      amount: depositAmount,
      reference: payRef,
      paymentId: payment.id,
      metadata: { seed: true },
    });

    // Extra pending/failed payments for admin UI variety
    if (i % 3 === 0) {
      await upsertPayment({
        reference: `SEED-DEP-PENDING-${u.key}`,
        userId: u.id,
        type: "WALLET_DEPOSIT",
        status: "PENDING",
        amount: 25000000n,
      });
    }
    if (i % 4 === 0) {
      await upsertPayment({
        reference: `SEED-DEP-FAILED-${u.key}`,
        userId: u.id,
        type: "WALLET_DEPOSIT",
        status: "FAILED",
        amount: 10000000n,
      });
    }
  }

  // Course purchases + enrollments
  const freeCourse = courses.find((c) => c.slug === "forex-foundation")!;
  const paidCourse = courses.find((c) => c.slug === "technical-analysis")!;
  const premiumCourse = courses.find((c) => c.slug === "complete-forex-mastery")!;

  for (const [i, u] of createdUsers.entries()) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: u.id, courseId: freeCourse.id } },
      update: { progressPercent: 20 + i * 7 },
      create: {
        userId: u.id,
        courseId: freeCourse.id,
        status: i % 5 === 0 ? "COMPLETED" : "ACTIVE",
        progressPercent: Math.min(100, 20 + i * 7),
        completedAt: i % 5 === 0 ? new Date() : null,
      },
    });

    if (i < 6) {
      const payRef = `SEED-COURSE-${u.key}`;
      const payment = await upsertPayment({
        reference: payRef,
        userId: u.id,
        type: "COURSE_PURCHASE",
        status: "PAID",
        amount: paidCourse.price,
        courseId: paidCourse.id,
        paidAt: new Date(Date.now() - (8 - i) * 86_400_000),
      });
      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: u.id, courseId: paidCourse.id } },
        update: {},
        create: {
          userId: u.id,
          courseId: paidCourse.id,
          status: "ACTIVE",
          progressPercent: 10 + i * 5,
          paymentId: payment.id,
        },
      });
    }

    if (i < 2) {
      const payRef = `SEED-COURSE-PREM-${u.key}`;
      const payment = await upsertPayment({
        reference: payRef,
        userId: u.id,
        type: "COURSE_PURCHASE",
        status: "PAID",
        amount: premiumCourse.price,
        courseId: premiumCourse.id,
        paidAt: new Date(),
      });
      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: u.id, courseId: premiumCourse.id } },
        update: {},
        create: {
          userId: u.id,
          courseId: premiumCourse.id,
          status: "ACTIVE",
          progressPercent: 5,
          paymentId: payment.id,
        },
      });
    }
  }

  // Investments (wallet-funded ACTIVE) + a few PENDING payment-funded
  const starter = opportunities.find((o) => o.slug === "starter-allocation")!;
  const growth = opportunities.find((o) => o.slug === "growth-managed-account")!;
  const balanced = opportunities.find((o) => o.slug === "balanced-floor")!;

  for (const [i, u] of createdUsers.entries()) {
    if (i >= 7) continue;
    const opp = i % 3 === 0 ? growth : i % 3 === 1 ? starter : balanced;
    const principal = opp.minAmount;
    const multiplier = Number(opp.multiplier);
    const projected = BigInt(Math.round(Number(principal) * multiplier));
    const ref = `SEED-INV-${u.key}`;
    const existing = await prisma.investment.findUnique({ where: { reference: ref } });
    if (existing) continue;

    const maturesAt = new Date();
    maturesAt.setDate(maturesAt.getDate() + 60 + i);

    const investment = await prisma.investment.create({
      data: {
        userId: u.id,
        opportunityId: opp.id,
        principalAmount: principal,
        currency: "TZS",
        multiplierSnapshot: opp.multiplier,
        projectedValue: projected,
        status: i === 0 ? "MATURED" : "ACTIVE",
        reference: ref,
        maturesAt,
      },
    });

    await postLedger({
      userId: u.id,
      walletId: u.walletId,
      direction: "DEBIT",
      type: "INVESTMENT_FUNDING",
      amount: principal,
      reference: ref,
      investmentId: investment.id,
      metadata: { seed: true, opportunity: opp.slug },
    });
  }

  // One pending investment via payment intent
  {
    const u = createdUsers[8];
    const ref = `SEED-INV-PENDING-${u.key}`;
    const existing = await prisma.investment.findUnique({ where: { reference: ref } });
    if (!existing) {
      const principal = starter.minAmount;
      const investment = await prisma.investment.create({
        data: {
          userId: u.id,
          opportunityId: starter.id,
          principalAmount: principal,
          currency: "TZS",
          multiplierSnapshot: starter.multiplier,
          projectedValue: principal * 2n,
          status: "PENDING",
          reference: ref,
        },
      });
      const payment = await upsertPayment({
        reference: `SEED-INV-PAY-${u.key}`,
        userId: u.id,
        type: "INVESTMENT_FUNDING",
        status: "INITIATED",
        amount: principal,
        opportunityId: starter.id,
      });
      await prisma.investment.update({
        where: { id: investment.id },
        data: { paymentId: payment.id },
      });
    }
  }

  // Withdrawals (with ledger holds for open ones)
  const withdrawalStatuses = [
    "REQUESTED",
    "UNDER_REVIEW",
    "APPROVED",
    "PROCESSING",
    "COMPLETED",
    "REJECTED",
  ] as const;

  for (const [i, u] of createdUsers.entries()) {
    if (i >= 6) continue;
    const ref = `SEED-WDL-${u.key}`;
    const existing = await prisma.withdrawal.findUnique({ where: { reference: ref } });
    if (existing) continue;

    const amount = BigInt(50_000 + i * 25_000) * 100n;
    const status = withdrawalStatuses[i % withdrawalStatuses.length];
    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId: u.id,
        amount,
        currency: "TZS",
        method: i % 2 === 0 ? "MOBILE_MONEY" : "BANK_TRANSFER",
        destinationMasked: i % 2 === 0 ? "+255***001" : "****1234",
        status,
        reference: ref,
        idempotencyKey: `idem-${ref}`,
        reviewerNote: status === "REJECTED" ? "Destination details incomplete." : null,
        reviewedById: ["APPROVED", "PROCESSING", "COMPLETED", "REJECTED"].includes(status)
          ? finance.id
          : null,
        processedAt: status === "COMPLETED" ? new Date() : null,
      },
    });

    // Hold funds for non-rejected withdrawals (completed already settled as debit)
    if (status !== "REJECTED") {
      await postLedger({
        userId: u.id,
        walletId: u.walletId,
        direction: "DEBIT",
        type: "WITHDRAWAL",
        amount,
        reference: ref,
        withdrawalId: withdrawal.id,
        metadata: { seed: true, status },
      });
    }
  }

  // Volt Society / community members
  const membershipStatuses = ["ACTIVE", "WAITLIST", "ACTIVE", "SUSPENDED", "WAITLIST", "ACTIVE"] as const;
  for (const [i, u] of createdUsers.entries()) {
    if (i >= membershipStatuses.length + 2) continue;
    const status = membershipStatuses[i % membershipStatuses.length];
    await prisma.communityMember.upsert({
      where: { userId: u.id },
      update: { status, motivation: `Excited to learn and build with Volt Society (#${u.key}).` },
      create: {
        userId: u.id,
        status,
        motivation: `Excited to learn and build with Volt Society (#${u.key}).`,
      },
    });
  }

  // Support tickets + messages
  const ticketSpecs = [
    { key: "01", subject: "Deposit not reflecting", category: "PAYMENTS", status: "OPEN" as const },
    { key: "02", subject: "KYC document rejected", category: "KYC", status: "PENDING" as const },
    { key: "03", subject: "Course video buffering", category: "COURSES", status: "RESOLVED" as const },
    { key: "04", subject: "Investment maturity date", category: "INVESTMENTS", status: "OPEN" as const },
    { key: "05", subject: "How do I join Volt Society?", category: "GENERAL", status: "CLOSED" as const },
    { key: "06", subject: "Withdrawal still processing", category: "PAYMENTS", status: "PENDING" as const },
    { key: "09", subject: "Coupon code not applying", category: "COURSES", status: "OPEN" as const },
    { key: "10", subject: "Update phone number", category: "GENERAL", status: "RESOLVED" as const },
  ];

  for (const t of ticketSpecs) {
    const user = createdUsers.find((u) => u.key === t.key);
    if (!user) continue;
    const marker = `SEED-TICKET-${t.key}`;
    const existing = await prisma.supportTicket.findFirst({
      where: { userId: user.id, subject: t.subject },
    });
    if (existing) continue;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: t.subject,
        category: t.category,
        status: t.status,
        messages: {
          create: [
            {
              authorId: user.id,
              body: `[${marker}] Hello, I need help with: ${t.subject}.`,
            },
            ...(t.status !== "OPEN"
              ? [
                  {
                    authorId: supportAgent.id,
                    body: "Thanks for reaching out — we are looking into this for you.",
                  },
                ]
              : []),
          ],
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: supportAgent.id,
        action: "support.ticket_created",
        entityType: "SupportTicket",
        entityId: ticket.id,
        ip: "127.0.0.1",
        metadata: { seed: true, category: t.category },
      },
    });
  }

  // Notifications
  for (const [i, u] of createdUsers.entries()) {
    const title = i % 2 === 0 ? "Welcome to Volt Trades" : "Wallet deposit confirmed";
    const existing = await prisma.notification.findFirst({
      where: { userId: u.id, title },
    });
    if (existing) continue;
    await prisma.notification.create({
      data: {
        userId: u.id,
        type: i % 2 === 0 ? "SYSTEM" : "PAYMENT",
        title,
        body:
          i % 2 === 0
            ? "Learn · Invest · Build. Your academy and trading floor await."
            : "Your seeded demo deposit has been credited to your wallet.",
        readAt: i % 3 === 0 ? new Date() : null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Showcase member: msume@gmail.com — full desk data for UI demos
  // ---------------------------------------------------------------------------
  {
    const showcaseEmail = "msume@gmail.com";
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

    const showcase = await prisma.user.upsert({
      where: { email: showcaseEmail },
      update: {
        fullName: "Msume Cassim",
        phone: "+255712345678",
        country: "Tanzania",
        passwordHash: userPasswordHash,
        role: "USER",
        emailVerified: true,
        kycStatus: "APPROVED",
        status: "ACTIVE",
      },
      create: {
        fullName: "Msume Cassim",
        email: showcaseEmail,
        phone: "+255712345678",
        country: "Tanzania",
        passwordHash: userPasswordHash,
        role: "USER",
        emailVerified: true,
        kycStatus: "APPROVED",
        acceptedTermsAt: new Date(),
        status: "ACTIVE",
      },
    });

    const showcaseWallet = await prisma.wallet.upsert({
      where: { userId: showcase.id },
      update: {},
      create: { userId: showcase.id, currency: "TZS" },
    });

    const kycExisting = await prisma.kycSubmission.findFirst({
      where: { userId: showcase.id },
      orderBy: { createdAt: "desc" },
    });
    if (kycExisting) {
      await prisma.kycSubmission.update({
        where: { id: kycExisting.id },
        data: {
          status: "APPROVED",
          reviewerNote: "Showcase KYC verified.",
          reviewedById: admin.id,
          reviewedAt: daysAgo(20),
        },
      });
    } else {
      await prisma.kycSubmission.create({
        data: {
          userId: showcase.id,
          documentType: "NATIONAL_ID",
          documentNumber: "NIDA-SHOWCASE-MSUME",
          frontImageKey: "kyc/seed/msume/front.jpg",
          backImageKey: "kyc/seed/msume/back.jpg",
          selfieKey: "kyc/seed/msume/selfie.jpg",
          status: "APPROVED",
          reviewerNote: "Showcase KYC verified.",
          reviewedById: admin.id,
          reviewedAt: daysAgo(20),
        },
      });
    }

    // Staggered deposits → rich 14-day cashflow
    const deposits: Array<{ ref: string; major: number; daysAgo: number }> = [
      { ref: "SEED-MSUME-DEP-01", major: 5_000_000, daysAgo: 13 },
      { ref: "SEED-MSUME-DEP-02", major: 2_500_000, daysAgo: 10 },
      { ref: "SEED-MSUME-DEP-03", major: 1_800_000, daysAgo: 7 },
      { ref: "SEED-MSUME-DEP-04", major: 3_200_000, daysAgo: 4 },
      { ref: "SEED-MSUME-DEP-05", major: 1_200_000, daysAgo: 1 },
    ];
    for (const d of deposits) {
      const amount = BigInt(d.major) * 100n;
      const payment = await upsertPayment({
        reference: d.ref,
        userId: showcase.id,
        type: "WALLET_DEPOSIT",
        status: "PAID",
        amount,
        paidAt: daysAgo(d.daysAgo),
      });
      await postLedger({
        userId: showcase.id,
        walletId: showcaseWallet.id,
        direction: "CREDIT",
        type: "DEPOSIT",
        amount,
        reference: d.ref,
        paymentId: payment.id,
        createdAt: daysAgo(d.daysAgo),
        metadata: { seed: true, showcase: true },
      });
    }

    await upsertPayment({
      reference: "SEED-MSUME-DEP-PENDING",
      userId: showcase.id,
      type: "WALLET_DEPOSIT",
      status: "PENDING",
      amount: 50000000n,
    });

    // Enroll in every published course + lesson progress
    const allCourses = await prisma.course.findMany({
      where: { status: "PUBLISHED" },
      include: { lessons: { orderBy: { order: "asc" } } },
    });
    for (const [ci, course] of allCourses.entries()) {
      const progress = Math.min(100, 35 + ci * 12);
      let paymentId: string | undefined;
      if (course.accessType !== "FREE" && course.priceAmount > 0n) {
        const payRef = `SEED-MSUME-COURSE-${course.slug}`;
        const payment = await upsertPayment({
          reference: payRef,
          userId: showcase.id,
          type: "COURSE_PURCHASE",
          status: "PAID",
          amount: course.priceAmount,
          courseId: course.id,
          paidAt: daysAgo(12 - ci),
        });
        paymentId = payment.id;
        // Course purchase from wallet (ledger) when not free
        await postLedger({
          userId: showcase.id,
          walletId: showcaseWallet.id,
          direction: "DEBIT",
          type: "COURSE_PURCHASE",
          amount: course.priceAmount,
          reference: payRef,
          paymentId: payment.id,
          createdAt: daysAgo(12 - ci),
          metadata: { seed: true, showcase: true, course: course.slug },
        });
      }

      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: showcase.id, courseId: course.id } },
        update: {
          progressPercent: progress,
          status: progress >= 100 ? "COMPLETED" : "ACTIVE",
          completedAt: progress >= 100 ? daysAgo(2) : null,
          ...(paymentId ? { paymentId } : {}),
        },
        create: {
          userId: showcase.id,
          courseId: course.id,
          status: progress >= 100 ? "COMPLETED" : "ACTIVE",
          progressPercent: progress,
          completedAt: progress >= 100 ? daysAgo(2) : null,
          paymentId,
        },
      });

      for (const [li, lesson] of course.lessons.entries()) {
        const done = li < Math.ceil(course.lessons.length * (progress / 100));
        await prisma.lessonProgress.upsert({
          where: { userId_lessonId: { userId: showcase.id, lessonId: lesson.id } },
          update: {
            completed: done,
            positionSeconds: done ? lesson.durationSeconds : Math.floor(lesson.durationSeconds / 2),
          },
          create: {
            userId: showcase.id,
            lessonId: lesson.id,
            completed: done,
            positionSeconds: done ? lesson.durationSeconds : Math.floor(lesson.durationSeconds / 2),
          },
        });
      }
    }

    // Investments across opportunities
    const allOpps = await prisma.opportunity.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
    });
    const investSpecs = [
      { slug: "starter-allocation", status: "ACTIVE" as const, daysAgo: 11, durationBump: 45 },
      { slug: "growth-managed-account", status: "ACTIVE" as const, daysAgo: 8, durationBump: 70 },
      { slug: "balanced-floor", status: "ACTIVE" as const, daysAgo: 5, durationBump: 55 },
      { slug: "momentum-sprint", status: "MATURED" as const, daysAgo: 40, durationBump: -2 },
      { slug: "conservative-preserve", status: "SETTLED" as const, daysAgo: 50, durationBump: -10 },
    ];

    for (const spec of investSpecs) {
      const opp = allOpps.find((o) => o.slug === spec.slug) ?? allOpps[0];
      if (!opp) continue;
      const ref = `SEED-MSUME-INV-${spec.slug}`;
      const existing = await prisma.investment.findUnique({ where: { reference: ref } });
      if (existing) continue;

      const principal = opp.minAmount;
      const multiplier = Number(opp.projectionMultiplier);
      const projected = BigInt(Math.round(Number(principal) * multiplier));
      const maturesAt = daysAgo(-spec.durationBump);
      const settledValue =
        spec.status === "SETTLED"
          ? BigInt(Math.round(Number(principal) * Math.max(1.1, multiplier * 0.85)))
          : null;

      const investment = await prisma.investment.create({
        data: {
          userId: showcase.id,
          opportunityId: opp.id,
          principalAmount: principal,
          currency: "TZS",
          multiplierSnapshot: opp.projectionMultiplier,
          projectedValue: projected,
          status: spec.status,
          reference: ref,
          maturesAt,
          settledValue,
          settledAt: spec.status === "SETTLED" ? daysAgo(3) : null,
          createdAt: daysAgo(spec.daysAgo),
        },
      });

      await postLedger({
        userId: showcase.id,
        walletId: showcaseWallet.id,
        direction: "DEBIT",
        type: "INVESTMENT_FUNDING",
        amount: principal,
        reference: ref,
        investmentId: investment.id,
        createdAt: daysAgo(spec.daysAgo),
        metadata: { seed: true, showcase: true, opportunity: opp.slug },
      });

      if (settledValue && settledValue > 0n) {
        await postLedger({
          userId: showcase.id,
          walletId: showcaseWallet.id,
          direction: "CREDIT",
          type: "INVESTMENT_SETTLEMENT",
          amount: settledValue,
          reference: `${ref}-SETTLE`,
          investmentId: investment.id,
          createdAt: daysAgo(3),
          metadata: { seed: true, showcase: true },
        });
      }
    }

    // Pending payment-funded investment
    {
      const opp = allOpps.find((o) => o.slug === "starter-allocation") ?? allOpps[0];
      if (opp) {
        const ref = "SEED-MSUME-INV-PENDING";
        const existing = await prisma.investment.findUnique({ where: { reference: ref } });
        if (!existing) {
          const principal = opp.minAmount;
          const investment = await prisma.investment.create({
            data: {
              userId: showcase.id,
              opportunityId: opp.id,
              principalAmount: principal,
              currency: "TZS",
              multiplierSnapshot: opp.projectionMultiplier,
              projectedValue: BigInt(Math.round(Number(principal) * Number(opp.projectionMultiplier))),
              status: "PENDING",
              reference: ref,
            },
          });
          const payment = await upsertPayment({
            reference: "SEED-MSUME-INV-PAY",
            userId: showcase.id,
            type: "INVESTMENT_FUNDING",
            status: "PENDING",
            amount: principal,
            opportunityId: opp.id,
          });
          await prisma.investment.update({
            where: { id: investment.id },
            data: { paymentId: payment.id },
          });
        }
      }
    }

    // Withdrawals
    const wdlSpecs = [
      {
        ref: "SEED-MSUME-WDL-DONE",
        major: 350_000,
        status: "COMPLETED" as const,
        daysAgo: 6,
      },
      {
        ref: "SEED-MSUME-WDL-REVIEW",
        major: 150_000,
        status: "UNDER_REVIEW" as const,
        daysAgo: 2,
      },
    ];
    for (const w of wdlSpecs) {
      const existing = await prisma.withdrawal.findUnique({ where: { reference: w.ref } });
      if (existing) continue;
      const amount = BigInt(w.major) * 100n;
      const withdrawal = await prisma.withdrawal.create({
        data: {
          userId: showcase.id,
          amount,
          currency: "TZS",
          method: "MOBILE_MONEY",
          destinationMasked: "+255***5678",
          status: w.status,
          reference: w.ref,
          idempotencyKey: `idem-${w.ref}`,
          reviewedById: w.status === "COMPLETED" ? finance.id : null,
          processedAt: w.status === "COMPLETED" ? daysAgo(w.daysAgo) : null,
          createdAt: daysAgo(w.daysAgo + 1),
        },
      });
      await postLedger({
        userId: showcase.id,
        walletId: showcaseWallet.id,
        direction: "DEBIT",
        type: "WITHDRAWAL",
        amount,
        reference: w.ref,
        withdrawalId: withdrawal.id,
        createdAt: daysAgo(w.daysAgo + 1),
        metadata: { seed: true, showcase: true, status: w.status },
      });
    }

    await prisma.communityMember.upsert({
      where: { userId: showcase.id },
      update: {
        status: "ACTIVE",
        motivation: "Building with Volt Society — learn, invest, and ship projects.",
      },
      create: {
        userId: showcase.id,
        status: "ACTIVE",
        motivation: "Building with Volt Society — learn, invest, and ship projects.",
      },
    });

    const ticketSubject = "Showcase: maturity schedule question";
    const ticketExisting = await prisma.supportTicket.findFirst({
      where: { userId: showcase.id, subject: ticketSubject },
    });
    if (!ticketExisting) {
      await prisma.supportTicket.create({
        data: {
          userId: showcase.id,
          subject: ticketSubject,
          category: "INVESTMENTS",
          status: "OPEN",
          messages: {
            create: [
              {
                authorId: showcase.id,
                body: "[SEED-MSUME-TICKET] When does my Growth Managed Account mature?",
              },
              {
                authorId: supportAgent.id,
                body: "Hi Msume — check Dashboard → Schedule for projected maturity dates. Remember projections are targets, not guarantees.",
              },
            ],
          },
        },
      });
    }

    const showcaseNotes = [
      {
        type: "SYSTEM" as const,
        title: "Welcome to Volt Trades",
        body: "Your showcase desk is ready — Learn · Invest · Build.",
        read: true,
      },
      {
        type: "PAYMENT" as const,
        title: "Deposit confirmed",
        body: "TZS 1,200,000 was credited to your wallet.",
        read: false,
      },
      {
        type: "INVESTMENT" as const,
        title: "Position opened",
        body: "Growth Managed Account is now ACTIVE. Projected outcome is a target, not a guarantee.",
        read: false,
      },
      {
        type: "COURSE" as const,
        title: "Keep learning",
        body: "You are mid-way through Technical Analysis — jump back into your next lesson.",
        read: false,
      },
      {
        type: "PAYMENT" as const,
        title: "Withdrawal completed",
        body: "Your mobile money withdrawal has been processed.",
        read: true,
      },
      {
        type: "SYSTEM" as const,
        title: "Volt Society",
        body: "You are an ACTIVE member of Volt Society. Explore projects and events.",
        read: false,
      },
    ];
    for (const n of showcaseNotes) {
      const exists = await prisma.notification.findFirst({
        where: { userId: showcase.id, title: n.title },
      });
      if (exists) continue;
      await prisma.notification.create({
        data: {
          userId: showcase.id,
          type: n.type,
          title: n.title,
          body: n.body,
          readAt: n.read ? daysAgo(1) : null,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: showcase.id,
        action: "auth.login",
        entityType: "User",
        entityId: showcase.id,
        ip: "127.0.0.1",
        metadata: { seed: true, showcase: true },
      },
    });
  }

  // Audit logs (demo trail)
  const auditActions = [
    { action: "user.created", entityType: "User" },
    { action: "kyc.reviewed", entityType: "KycSubmission" },
    { action: "payment.confirmed", entityType: "Payment" },
    { action: "investment.created", entityType: "Investment" },
    { action: "withdrawal.updated", entityType: "Withdrawal" },
    { action: "coupon.created", entityType: "Coupon" },
    { action: "community.member_created", entityType: "CommunityMember" },
    { action: "course.created", entityType: "Course" },
    { action: "opportunity.created", entityType: "Opportunity" },
    { action: "settings.updated", entityType: "PlatformSettings" },
  ];
  for (const [i, a] of auditActions.entries()) {
    const marker = `SEED-AUDIT-${i + 1}`;
    const exists = await prisma.auditLog.findFirst({
      where: {
        action: a.action,
        entityType: a.entityType,
        ip: "127.0.0.1",
      },
      orderBy: { createdAt: "asc" },
    });
    // Only create the demo pack once per action type from seed IP.
    if (exists) continue;
    await prisma.auditLog.create({
      data: {
        actorId: i % 2 === 0 ? admin.id : finance.id,
        action: a.action,
        entityType: a.entityType,
        entityId: createdUsers[i % createdUsers.length]?.id ?? admin.id,
        ip: "127.0.0.1",
        metadata: { seed: true, seedMarker: marker },
      },
    });
  }

  console.log("\nSeed complete.\n");
  console.log(`Admin:   admin@volttrades.local / ${ADMIN_PASSWORD}`);
  console.log(`Finance: finance@volttrades.local / ${STAFF_PASSWORD}`);
  console.log(`Support: support@volttrades.local / ${STAFF_PASSWORD}`);
  console.log(`Members: ${DEMO_USERS[0].email} … ${DEMO_USERS[9].email} / ${DEMO_USER_PASSWORD}`);
  console.log(`Showcase: msume@gmail.com / ${DEMO_USER_PASSWORD}`);
  console.log(
    "Includes: 10 demo users + msume showcase (KYC, deposits, withdrawals, wallet ledger, investments, courses/lessons, Volt Society, support, notifications).",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
