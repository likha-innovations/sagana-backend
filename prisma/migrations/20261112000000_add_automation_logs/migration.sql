-- CreateTable IF NOT EXISTS for telemetry_logs
CREATE TABLE IF NOT EXISTS "telemetry_logs" (
    "telemetry_id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "mac_address" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_logs_pkey" PRIMARY KEY ("telemetry_id")
);

-- AddForeignKey for telemetry_logs if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'telemetry_logs_machine_id_fkey'
    ) THEN
        ALTER TABLE "telemetry_logs" ADD CONSTRAINT "telemetry_logs_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("machine_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable
CREATE TABLE "automation_logs" (
    "log_id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE INDEX "automation_logs_machine_id_created_at_idx" ON "automation_logs"("machine_id", "created_at");

-- CreateIndex
CREATE INDEX "automation_logs_batch_id_created_at_idx" ON "automation_logs"("batch_id", "created_at");

-- AddForeignKey
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("machine_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "compost_batches"("batch_id") ON DELETE SET NULL ON UPDATE CASCADE;
