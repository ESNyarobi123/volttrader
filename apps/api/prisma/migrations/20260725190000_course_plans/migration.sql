-- Forex course pricing plans (landing cards, admin-managed)
CREATE TABLE "course_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "price_amount" BIGINT NOT NULL DEFAULT 0,
    "price_currency" "Currency" NOT NULL DEFAULT 'TZS',
    "billing_period" TEXT NOT NULL DEFAULT 'month',
    "features" TEXT[],
    "cta_label" TEXT NOT NULL DEFAULT 'Get Started',
    "cta_href" TEXT NOT NULL DEFAULT '/register',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "course_plans_published_sort_order_idx" ON "course_plans"("published", "sort_order");
