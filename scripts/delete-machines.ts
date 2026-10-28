import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Configure target MAC addresses below, OR pass them via CLI arguments:
 * e.g. pnpm delete:machines 20:50:0D:E6:C0:3C 38:3E:51:CB:05:74
 */
export const TARGET_MACS: string[] = [
  '20:50:0D:E6:C0:3C',
  '38:3E:51:CB:05:74',
];

async function main() {
  const cliArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const combinedMacs = Array.from(
    new Set(
      [...TARGET_MACS, ...cliArgs]
        .map((mac) => mac.trim())
        .filter((mac) => mac.length > 0),
    ),
  );

  if (combinedMacs.length === 0) {
    console.warn(
      'No MAC addresses specified. Add MAC addresses to TARGET_MACS in scripts/delete-machines.ts or pass them as CLI arguments.\nExample: pnpm delete:machines 20:50:0D:E6:C0:3C',
    );
    process.exit(0);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const machines = await prisma.machine.findMany({
      where: {
        macAddress: {
          in: combinedMacs,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        macAddress: true,
      },
    });

    if (machines.length === 0) {
      console.log('No machines found matching provided MAC address(es):', combinedMacs);
      return;
    }

    console.log(`Found ${machines.length} machine(s) to delete:`);
    for (const m of machines) {
      console.log(` - ID: ${m.id} | Name: ${m.name} | MAC: ${m.macAddress}`);
    }

    const machineIds = machines.map((m) => m.id);

    const result = await prisma.$transaction(async (tx) => {
      const sensors = await tx.sensor.findMany({
        where: { machineId: { in: machineIds } },
        select: { id: true },
      });
      const sensorIds = sensors.map((s) => s.id);

      const batches = await tx.compostBatch.findMany({
        where: { machineId: { in: machineIds } },
        select: { id: true },
      });
      const batchIds = batches.map((b) => b.id);

      const deletedSensorReadings = await tx.sensorReading.deleteMany({
        where: {
          OR: [
            { sensorId: { in: sensorIds } },
            { batchId: { in: batchIds } },
          ],
        },
      });

      const deletedSensors = await tx.sensor.deleteMany({
        where: { id: { in: sensorIds } },
      });

      const deletedFeedstocks = await tx.batchFeedstock.deleteMany({
        where: { batchId: { in: batchIds } },
      });

      const deletedPhases = await tx.compostingPhase.deleteMany({
        where: { batchId: { in: batchIds } },
      });

      const deletedOutputs = await tx.compostOutput.deleteMany({
        where: { batchId: { in: batchIds } },
      });

      const deletedBatches = await tx.compostBatch.deleteMany({
        where: { id: { in: batchIds } },
      });

      const deletedTelemetry = await tx.telemetryLog.deleteMany({
        where: { machineId: { in: machineIds } },
      });

      const deletedMachines = await tx.machine.deleteMany({
        where: { id: { in: machineIds } },
      });

      return {
        machines: deletedMachines.count,
        sensors: deletedSensors.count,
        sensorReadings: deletedSensorReadings.count,
        telemetryLogs: deletedTelemetry.count,
        batches: deletedBatches.count,
        batchFeedstocks: deletedFeedstocks.count,
        compostingPhases: deletedPhases.count,
        compostOutputs: deletedOutputs.count,
      };
    });

    console.log('\n--- DELETION SUMMARY ---');
    console.table(result);
    console.log('Successfully deleted machines and all related records.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed to delete machines:', err);
  process.exit(1);
});
