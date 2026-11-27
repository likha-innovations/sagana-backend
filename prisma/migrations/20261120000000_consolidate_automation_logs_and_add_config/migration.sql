-- AlterTable: add configuration JSONB column to machines
ALTER TABLE "machines" ADD COLUMN IF NOT EXISTS "configuration" JSONB DEFAULT '{}';

-- Data Migration: Migrate existing automation_logs into notifications (if table exists)
DO $$
BEGIN
    IF to_regclass('automation_logs') IS NOT NULL THEN
        INSERT INTO "notifications" (
            "notification_id",
            "barangay_id",
            "machine_id",
            "batch_id",
            "type",
            "severity",
            "title",
            "message",
            "metadata",
            "is_read",
            "created_at"
        )
        SELECT
            gen_random_uuid()::text,
            m."barangay_id",
            a."machine_id",
            a."batch_id",
            'automation',
            CASE
                WHEN a."type" IN ('emergency_stop', 'estop_activated', 'e_stop', 'alarm') THEN 'critical'
                ELSE 'info'
            END,
            'Automation Event',
            a."message",
            CASE jsonb_typeof(a."metadata")
                WHEN 'object' THEN a."metadata"
                ELSE CASE
                    WHEN a."metadata" IS NULL THEN '{}'::jsonb
                    ELSE jsonb_build_object('legacyMetadata', a."metadata")
                END
            END || jsonb_build_object('eventType', a."type", 'legacyLogId', a."log_id"),
            false,
            a."created_at"
        FROM "automation_logs" a
        JOIN "machines" m ON m."machine_id" = a."machine_id";

        -- Retain automation_logs for verification via metadata.legacyLogId.
    END IF;
END $$;

-- CreateIndex: index for machine-scoped automation logs and notifications
CREATE INDEX IF NOT EXISTS "notifications_machine_id_type_created_at_idx" ON "notifications"("machine_id", "type", "created_at");
