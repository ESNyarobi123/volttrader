-- Landing page marketing content (singleton)
CREATE TABLE "landing_page_content" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "hero_youtube_id" TEXT NOT NULL DEFAULT 'nMzMlm-F_yA',
    "hero_eyebrow" TEXT NOT NULL DEFAULT 'LEARN · INVEST · BUILD',
    "hero_headline" TEXT NOT NULL,
    "hero_headline_accent" TEXT,
    "hero_subcopy" TEXT NOT NULL,
    "cta_primary_label" TEXT NOT NULL DEFAULT 'Sign up free',
    "cta_primary_href" TEXT NOT NULL DEFAULT '/register',
    "cta_secondary_label" TEXT NOT NULL DEFAULT 'Sign in',
    "cta_secondary_href" TEXT NOT NULL DEFAULT '/login',
    "stats_json" JSONB NOT NULL,
    "closing_headline" TEXT NOT NULL,
    "closing_subcopy" TEXT NOT NULL,
    "closing_cta_label" TEXT NOT NULL DEFAULT 'Create your account',
    "closing_cta_href" TEXT NOT NULL DEFAULT '/register',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "landing_page_content_pkey" PRIMARY KEY ("id")
);

INSERT INTO "landing_page_content" (
  "id",
  "hero_youtube_id",
  "hero_eyebrow",
  "hero_headline",
  "hero_headline_accent",
  "hero_subcopy",
  "cta_primary_label",
  "cta_primary_href",
  "cta_secondary_label",
  "cta_secondary_href",
  "stats_json",
  "closing_headline",
  "closing_subcopy",
  "closing_cta_label",
  "closing_cta_href",
  "updated_at"
) VALUES (
  'default',
  'nMzMlm-F_yA',
  'LEARN · INVEST · BUILD',
  'Learn Forex. Manage capital.',
  'Explore opportunities.',
  'Volt Trades brings education, wallet, and curated trading opportunities into one simple ecosystem — powerful inside, clear outside.',
  'Sign up free',
  '/register',
  'Sign in',
  '/login',
  '[{"value":"Learn","label":"Forex Academy"},{"value":"Invest","label":"Account Management"},{"value":"Wallet","label":"Wallet balance"},{"value":"Society","label":"Volt community"}]'::jsonb,
  'Ready to learn, invest, and build with Volt Trades?',
  'Create your free account in minutes — no upfront KYC required to get started.',
  'Create your account',
  '/register',
  CURRENT_TIMESTAMP
);
