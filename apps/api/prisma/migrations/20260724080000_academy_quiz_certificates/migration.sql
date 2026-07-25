-- One quiz per course + pass threshold
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "pass_score" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Deduplicate quizzes before unique course_id (keep newest)
DELETE FROM "quizzes" a
USING "quizzes" b
WHERE a."course_id" = b."course_id"
  AND a."id" < b."id";

CREATE UNIQUE INDEX IF NOT EXISTS "quizzes_course_id_key" ON "quizzes"("course_id");

ALTER TABLE "quiz_results" ADD COLUMN IF NOT EXISTS "answers" JSONB;
CREATE INDEX IF NOT EXISTS "quiz_results_quiz_id_user_id_idx" ON "quiz_results"("quiz_id", "user_id");

-- Certificates issued on course completion
CREATE TABLE IF NOT EXISTS "certificates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "pdf_key" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "certificates_certificate_number_key" ON "certificates"("certificate_number");
CREATE UNIQUE INDEX IF NOT EXISTS "certificates_user_id_course_id_key" ON "certificates"("user_id", "course_id");
CREATE INDEX IF NOT EXISTS "certificates_user_id_idx" ON "certificates"("user_id");

DO $$ BEGIN
  ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
