-- Admin cycle notes on member investment positions (not live P&L).
CREATE TABLE "investment_updates" (
    "id" TEXT NOT NULL,
    "investment_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_updates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "investment_updates_investment_id_created_at_idx" ON "investment_updates"("investment_id", "created_at");

ALTER TABLE "investment_updates" ADD CONSTRAINT "investment_updates_investment_id_fkey" FOREIGN KEY ("investment_id") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investment_updates" ADD CONSTRAINT "investment_updates_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
