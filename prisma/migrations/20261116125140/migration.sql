/*
  Warnings:

  - You are about to drop the column `address` on the `barangays` table. All the data in the column will be lost.
  - You are about to drop the column `clerk_user_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `alerts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ml_predictions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_machine_id_fkey";

-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_resolved_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "ml_predictions" DROP CONSTRAINT "ml_predictions_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_barangay_id_fkey";

-- DropIndex
DROP INDEX "users_clerk_user_id_key";

-- AlterTable
ALTER TABLE "barangays" DROP COLUMN "address",
ALTER COLUMN "code" DROP NOT NULL;

-- AlterTable
ALTER TABLE "machines" RENAME CONSTRAINT "aivsp_machines_pkey" TO "machines_pkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "clerk_user_id",
ALTER COLUMN "role" SET DEFAULT 'operator',
ALTER COLUMN "barangay_id" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;

-- DropTable
DROP TABLE "alerts";

-- DropTable
DROP TABLE "ml_predictions";

-- RenameForeignKey
ALTER TABLE "machines" RENAME CONSTRAINT "aivsp_machines_barangay_id_fkey" TO "machines_barangay_id_fkey";

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_barangay_id_fkey" FOREIGN KEY ("barangay_id") REFERENCES "barangays"("barangay_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "aivsp_machines_mac_address_key" RENAME TO "machines_mac_address_key";
