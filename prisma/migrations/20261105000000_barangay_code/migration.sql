BEGIN;

-- guarded: init_v2 already created this column and index on Neon; guards allow fresh local replays
ALTER TABLE "barangays" ADD COLUMN IF NOT EXISTS "code" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "barangays_code_key" ON "barangays"("code");
ALTER TABLE "barangays" ADD CONSTRAINT "barangays_code_format" CHECK ("code" IS NULL OR "code" ~ '^[A-Z0-9]{6}$');

ALTER TABLE "users" ADD COLUMN "verification_status" TEXT NOT NULL DEFAULT 'unverified';
UPDATE "users" SET "verification_status" = 'verified';
ALTER TABLE "users" ADD CONSTRAINT "users_verification_status_check" CHECK ("verification_status" IN ('verified', 'unverified', 'rejected'));

COMMIT;
