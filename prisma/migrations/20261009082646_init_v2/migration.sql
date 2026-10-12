/*
  Warnings:

  - The primary key for the `alerts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `alertType` on the `alerts` table. All the data in the column will be lost.
  - You are about to drop the column `batchId` on the `alerts` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `alerts` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `alerts` table. All the data in the column will be lost.
  - You are about to drop the column `machineId` on the `alerts` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `alerts` table. All the data in the column will be lost.
  - The primary key for the `compost_batches` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `batchCode` on the `compost_batches` table. All the data in the column will be lost.
  - You are about to drop the column `completionDate` on the `compost_batches` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `compost_batches` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `compost_batches` table. All the data in the column will be lost.
  - You are about to drop the column `intakeId` on the `compost_batches` table. All the data in the column will be lost.
  - You are about to drop the column `machineId` on the `compost_batches` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `compost_batches` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `compost_batches` table. All the data in the column will be lost.
  - You are about to drop the column `targetCnRatio` on the `compost_batches` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `compost_batches` table. All the data in the column will be lost.
  - The primary key for the `compost_outputs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `batchId` on the `compost_outputs` table. All the data in the column will be lost.
  - You are about to drop the column `collectionDate` on the `compost_outputs` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `compost_outputs` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `compost_outputs` table. All the data in the column will be lost.
  - You are about to drop the column `maturityStatus` on the `compost_outputs` table. All the data in the column will be lost.
  - You are about to drop the column `outputWeight` on the `compost_outputs` table. All the data in the column will be lost.
  - You are about to drop the column `productionDate` on the `compost_outputs` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `compost_outputs` table. All the data in the column will be lost.
  - The primary key for the `composting_phases` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `batchId` on the `composting_phases` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `composting_phases` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `composting_phases` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `composting_phases` table. All the data in the column will be lost.
  - You are about to drop the column `phaseName` on the `composting_phases` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `composting_phases` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `composting_phases` table. All the data in the column will be lost.
  - The primary key for the `feedstocks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `feedstocks` table. All the data in the column will be lost.
  - The primary key for the `ml_predictions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `batchId` on the `ml_predictions` table. All the data in the column will be lost.
  - You are about to drop the column `confidenceScore` on the `ml_predictions` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `ml_predictions` table. All the data in the column will be lost.
  - You are about to drop the column `isStabilized` on the `ml_predictions` table. All the data in the column will be lost.
  - You are about to drop the column `predictedPhase` on the `ml_predictions` table. All the data in the column will be lost.
  - You are about to drop the column `predictionTime` on the `ml_predictions` table. All the data in the column will be lost.
  - The primary key for the `sensor_readings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `batchId` on the `sensor_readings` table. All the data in the column will be lost.
  - You are about to drop the column `co2` on the `sensor_readings` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `sensor_readings` table. All the data in the column will be lost.
  - You are about to drop the column `moisture1` on the `sensor_readings` table. All the data in the column will be lost.
  - You are about to drop the column `moisture2` on the `sensor_readings` table. All the data in the column will be lost.
  - You are about to drop the column `o2` on the `sensor_readings` table. All the data in the column will be lost.
  - You are about to drop the column `tempBottom` on the `sensor_readings` table. All the data in the column will be lost.
  - You are about to drop the column `tempMid` on the `sensor_readings` table. All the data in the column will be lost.
  - You are about to drop the column `tempTop` on the `sensor_readings` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `sensor_readings` table. All the data in the column will be lost.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `contactNumber` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `intake_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `intake_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `machines` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `organizations` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[batch_code]` on the table `compost_batches` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[batch_id]` on the table `compost_outputs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[clerk_user_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - The required column `alert_id` was added to the `alerts` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `alert_type` to the `alerts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `batch_code` to the `compost_batches` table without a default value. This is not possible if the table is not empty.
  - The required column `batch_id` was added to the `compost_batches` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `machine_id` to the `compost_batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_date` to the `compost_batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_weight` to the `compost_batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `compost_batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `batch_id` to the `compost_outputs` table without a default value. This is not possible if the table is not empty.
  - The required column `output_id` was added to the `compost_outputs` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `output_weight` to the `compost_outputs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `production_date` to the `compost_outputs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `batch_id` to the `composting_phases` table without a default value. This is not possible if the table is not empty.
  - The required column `phase_id` was added to the `composting_phases` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `phase_name` to the `composting_phases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_time` to the `composting_phases` table without a default value. This is not possible if the table is not empty.
  - The required column `feedstock_id` was added to the `feedstocks` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `batch_id` to the `ml_predictions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `confidence_score` to the `ml_predictions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `predicted_phase` to the `ml_predictions` table without a default value. This is not possible if the table is not empty.
  - The required column `prediction_id` was added to the `ml_predictions` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `batch_id` to the `sensor_readings` table without a default value. This is not possible if the table is not empty.
  - The required column `reading_id` was added to the `sensor_readings` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `sensor_id` to the `sensor_readings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `value` to the `sensor_readings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `barangay_id` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clerk_user_id` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `users` table without a default value. This is not possible if the table is not empty.
  - The required column `user_id` was added to the `users` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_batchId_fkey";

-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_machineId_fkey";

-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_userId_fkey";

-- DropForeignKey
ALTER TABLE "compost_batches" DROP CONSTRAINT "compost_batches_intakeId_fkey";

-- DropForeignKey
ALTER TABLE "compost_batches" DROP CONSTRAINT "compost_batches_machineId_fkey";

-- DropForeignKey
ALTER TABLE "compost_batches" DROP CONSTRAINT "compost_batches_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "compost_outputs" DROP CONSTRAINT "compost_outputs_batchId_fkey";

-- DropForeignKey
ALTER TABLE "composting_phases" DROP CONSTRAINT "composting_phases_batchId_fkey";

-- DropForeignKey
ALTER TABLE "intake_items" DROP CONSTRAINT "intake_items_feedstockId_fkey";

-- DropForeignKey
ALTER TABLE "intake_items" DROP CONSTRAINT "intake_items_intakeId_fkey";

-- DropForeignKey
ALTER TABLE "intake_records" DROP CONSTRAINT "intake_records_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "intake_records" DROP CONSTRAINT "intake_records_userId_fkey";

-- DropForeignKey
ALTER TABLE "machines" DROP CONSTRAINT "machines_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ml_predictions" DROP CONSTRAINT "ml_predictions_batchId_fkey";

-- DropForeignKey
ALTER TABLE "sensor_readings" DROP CONSTRAINT "sensor_readings_batchId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_organizationId_fkey";

-- DropIndex
DROP INDEX "compost_batches_batchCode_key";

-- DropIndex
DROP INDEX "compost_batches_intakeId_key";

-- DropIndex
DROP INDEX "compost_outputs_batchId_key";

-- AlterTable
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_pkey",
DROP COLUMN "alertType",
DROP COLUMN "batchId",
DROP COLUMN "createdAt",
DROP COLUMN "id",
DROP COLUMN "machineId",
DROP COLUMN "userId",
ADD COLUMN     "alert_id" TEXT NOT NULL,
ADD COLUMN     "alert_type" TEXT NOT NULL,
ADD COLUMN     "batch_id" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "machine_id" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_user_id" TEXT,
ALTER COLUMN "status" SET DEFAULT 'active',
ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("alert_id");

-- AlterTable
ALTER TABLE "compost_batches" DROP CONSTRAINT "compost_batches_pkey",
DROP COLUMN "batchCode",
DROP COLUMN "completionDate",
DROP COLUMN "createdAt",
DROP COLUMN "id",
DROP COLUMN "intakeId",
DROP COLUMN "machineId",
DROP COLUMN "organizationId",
DROP COLUMN "startDate",
DROP COLUMN "targetCnRatio",
DROP COLUMN "updatedAt",
ADD COLUMN     "batch_code" TEXT NOT NULL,
ADD COLUMN     "batch_id" TEXT NOT NULL,
ADD COLUMN     "completion_date" TIMESTAMP(3),
ADD COLUMN     "machine_id" TEXT NOT NULL,
ADD COLUMN     "start_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "total_weight" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'active',
ADD CONSTRAINT "compost_batches_pkey" PRIMARY KEY ("batch_id");

-- AlterTable
ALTER TABLE "compost_outputs" DROP CONSTRAINT "compost_outputs_pkey",
DROP COLUMN "batchId",
DROP COLUMN "collectionDate",
DROP COLUMN "createdAt",
DROP COLUMN "id",
DROP COLUMN "maturityStatus",
DROP COLUMN "outputWeight",
DROP COLUMN "productionDate",
DROP COLUMN "updatedAt",
ADD COLUMN     "batch_id" TEXT NOT NULL,
ADD COLUMN     "collection_date" TIMESTAMP(3),
ADD COLUMN     "output_id" TEXT NOT NULL,
ADD COLUMN     "output_weight" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "production_date" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'active',
ADD CONSTRAINT "compost_outputs_pkey" PRIMARY KEY ("output_id");

-- AlterTable
ALTER TABLE "composting_phases" DROP CONSTRAINT "composting_phases_pkey",
DROP COLUMN "batchId",
DROP COLUMN "createdAt",
DROP COLUMN "endTime",
DROP COLUMN "id",
DROP COLUMN "phaseName",
DROP COLUMN "startTime",
DROP COLUMN "updatedAt",
ADD COLUMN     "batch_id" TEXT NOT NULL,
ADD COLUMN     "end_time" TIMESTAMP(3),
ADD COLUMN     "phase_id" TEXT NOT NULL,
ADD COLUMN     "phase_name" TEXT NOT NULL,
ADD COLUMN     "start_time" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'active',
ADD CONSTRAINT "composting_phases_pkey" PRIMARY KEY ("phase_id");

-- AlterTable
ALTER TABLE "feedstocks" DROP CONSTRAINT "feedstocks_pkey",
DROP COLUMN "id",
ADD COLUMN     "feedstock_id" TEXT NOT NULL,
ADD CONSTRAINT "feedstocks_pkey" PRIMARY KEY ("feedstock_id");

-- AlterTable
ALTER TABLE "ml_predictions" DROP CONSTRAINT "ml_predictions_pkey",
DROP COLUMN "batchId",
DROP COLUMN "confidenceScore",
DROP COLUMN "id",
DROP COLUMN "isStabilized",
DROP COLUMN "predictedPhase",
DROP COLUMN "predictionTime",
ADD COLUMN     "batch_id" TEXT NOT NULL,
ADD COLUMN     "confidence_score" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "predicted_days_remaining" INTEGER,
ADD COLUMN     "predicted_phase" TEXT NOT NULL,
ADD COLUMN     "prediction_id" TEXT NOT NULL,
ADD COLUMN     "prediction_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "ml_predictions_pkey" PRIMARY KEY ("prediction_id");

-- AlterTable
ALTER TABLE "sensor_readings" DROP CONSTRAINT "sensor_readings_pkey",
DROP COLUMN "batchId",
DROP COLUMN "co2",
DROP COLUMN "id",
DROP COLUMN "moisture1",
DROP COLUMN "moisture2",
DROP COLUMN "o2",
DROP COLUMN "tempBottom",
DROP COLUMN "tempMid",
DROP COLUMN "tempTop",
DROP COLUMN "timestamp",
ADD COLUMN     "batch_id" TEXT NOT NULL,
ADD COLUMN     "reading_id" TEXT NOT NULL,
ADD COLUMN     "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sensor_id" TEXT NOT NULL,
ADD COLUMN     "value" DOUBLE PRECISION NOT NULL,
ADD CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("reading_id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "contactNumber",
DROP COLUMN "createdAt",
DROP COLUMN "fullName",
DROP COLUMN "id",
DROP COLUMN "organizationId",
DROP COLUMN "updatedAt",
ADD COLUMN     "barangay_id" TEXT NOT NULL,
ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "clerk_user_id" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "role" DROP DEFAULT,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("user_id");

-- DropTable
DROP TABLE "intake_items";

-- DropTable
DROP TABLE "intake_records";

-- DropTable
DROP TABLE "machines";

-- DropTable
DROP TABLE "organizations";

-- CreateTable
CREATE TABLE "barangays" (
    "barangay_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barangays_pkey" PRIMARY KEY ("barangay_id")
);

-- CreateTable
CREATE TABLE "aivsp_machines" (
    "machine_id" TEXT NOT NULL,
    "barangay_id" TEXT NOT NULL,
    "mac_address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "wifi_ssid" TEXT,
    "last_seen" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "aivsp_machines_pkey" PRIMARY KEY ("machine_id")
);

-- CreateTable
CREATE TABLE "batch_feedstocks" (
    "batch_feedstock_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "feedstock_id" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "batch_feedstocks_pkey" PRIMARY KEY ("batch_feedstock_id")
);

-- CreateTable
CREATE TABLE "sensors" (
    "sensor_id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "sensor_type" TEXT NOT NULL,
    "location" TEXT,
    "unit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "sensors_pkey" PRIMARY KEY ("sensor_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "barangays_code_key" ON "barangays"("code");

-- CreateIndex
CREATE UNIQUE INDEX "aivsp_machines_mac_address_key" ON "aivsp_machines"("mac_address");

-- CreateIndex
CREATE UNIQUE INDEX "compost_batches_batch_code_key" ON "compost_batches"("batch_code");

-- CreateIndex
CREATE UNIQUE INDEX "compost_outputs_batch_id_key" ON "compost_outputs"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_barangay_id_fkey" FOREIGN KEY ("barangay_id") REFERENCES "barangays"("barangay_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aivsp_machines" ADD CONSTRAINT "aivsp_machines_barangay_id_fkey" FOREIGN KEY ("barangay_id") REFERENCES "barangays"("barangay_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "compost_batches"("batch_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "aivsp_machines"("machine_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compost_batches" ADD CONSTRAINT "compost_batches_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "aivsp_machines"("machine_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compost_batches" ADD CONSTRAINT "compost_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_feedstocks" ADD CONSTRAINT "batch_feedstocks_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "compost_batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_feedstocks" ADD CONSTRAINT "batch_feedstocks_feedstock_id_fkey" FOREIGN KEY ("feedstock_id") REFERENCES "feedstocks"("feedstock_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compost_outputs" ADD CONSTRAINT "compost_outputs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "compost_batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_predictions" ADD CONSTRAINT "ml_predictions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "compost_batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "composting_phases" ADD CONSTRAINT "composting_phases_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "compost_batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "aivsp_machines"("machine_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "compost_batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "sensors"("sensor_id") ON DELETE RESTRICT ON UPDATE CASCADE;
