-- DropForeignKey
ALTER TABLE "compost_outputs" DROP CONSTRAINT "compost_outputs_batch_id_fkey";

-- AlterTable
ALTER TABLE "compost_batches" ADD COLUMN "final_weight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "composting_phases" DROP COLUMN "end_time",
DROP COLUMN "start_time",
ADD COLUMN "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE IF EXISTS "aivsp_machines" RENAME TO "machines";
ALTER TABLE "machines" ALTER COLUMN "status" SET DEFAULT 'offline';

-- DropTable
DROP TABLE "compost_outputs";
