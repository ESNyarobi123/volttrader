-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "support_email" TEXT,
    "support_phone" TEXT,
    "support_hours" TEXT,
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "registration_open" BOOLEAN NOT NULL DEFAULT true,
    "community_open" BOOLEAN NOT NULL DEFAULT true,
    "min_deposit_minor" BIGINT NOT NULL DEFAULT 100000,
    "min_withdrawal_minor" BIGINT NOT NULL DEFAULT 500000,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row
INSERT INTO "platform_settings" ("id", "support_email", "support_hours", "updated_at")
VALUES ('default', 'support@volttrades.local', 'Mon–Fri 09:00–17:00 EAT', CURRENT_TIMESTAMP);
