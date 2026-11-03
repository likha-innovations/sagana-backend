import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: '.env.dev' });
}

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Starting Seed ---');

  // 1. Seed Barangays 170-180
  console.log('1. Seeding Barangays 170-180...');
  const barangays = Array.from({ length: 11 }, (_, i) => ({
    number: 170 + i,
    name: `Barangay ${170 + i}`,
  }));

  for (const brgy of barangays) {
    const id = `brgy_${brgy.number}`;
    await prisma.barangay.upsert({
      where: { id },
      update: { name: brgy.name },
      create: { id, name: brgy.name },
    });
  }

  // 2. Fetch existing machines & operator
  console.log('2. Fetching existing machines and operator...');
  const existingMachines = await prisma.machine.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const existingUser = await prisma.user.findFirst();
  if (!existingUser) {
    console.warn(
      '⚠️ No user found in database. Please register at least one user before running batch seed.',
    );
    return;
  }
  const operatorBarangayId = existingUser.barangayId || 'brgy_176';
  console.log(
    `Using operator: ${existingUser.fullName || existingUser.id} (${operatorBarangayId})`,
  );

  // 3. Seed Feedstocks Catalog
  console.log('3. Seeding Feedstocks Catalog...');
  const feedstocksData = [
    {
      id: 'feedstock_veg_scraps',
      name: 'Vegetable Scraps',
      category: 'green',
      description: 'Raw kitchen vegetable peels and trimmings',
    },
    {
      id: 'feedstock_fruit_peels',
      name: 'Fruit Peels',
      category: 'green',
      description: 'Fruit rinds, cores, and citrus peels',
    },
    {
      id: 'feedstock_dry_leaves',
      name: 'Dry Leaves',
      category: 'brown',
      description: 'Dried fallen leaves for carbon balance',
    },
    {
      id: 'feedstock_sawdust',
      name: 'Sawdust',
      category: 'brown',
      description: 'Clean untreated wood shavings and sawdust',
    },
    {
      id: 'feedstock_coffee',
      name: 'Coffee Grounds',
      category: 'green',
      description: 'Nitrogen-rich spent coffee grounds',
    },
    {
      id: 'feedstock_food_waste',
      name: 'Food Waste',
      category: 'green',
      description: 'Cooked food scraps and leftover meal waste',
    },
  ];

  for (const item of feedstocksData) {
    await prisma.feedstock.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        category: item.category,
        description: item.description,
      },
      create: item,
    });
  }

  // 4. Upsert 3 additional machines for distinct edge cases
  console.log('4. Upserting 3 additional test machines...');
  const additionalMachinesData = [
    {
      id: 'machine_sagana_idle',
      name: 'SAGANA-2 (Empty / Idle)',
      macAddress: '00:1A:79:CB:01:02',
      wifiSsid: 'Steler2.4',
      status: 'offline',
      lastSeen: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago
    },
    {
      id: 'machine_sagana_nosensors',
      name: 'SAGANA-4 (No Sensors)',
      macAddress: '00:1A:79:CB:01:04',
      wifiSsid: 'Steler2.4',
      status: 'offline',
      lastSeen: null, // Never seen
    },
    {
      id: 'machine_sagana_completed',
      name: 'SAGANA-5 (Harvest Ready)',
      macAddress: '00:1A:79:CB:01:05',
      wifiSsid: 'Steler2.4',
      status: 'offline',
      lastSeen: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    },
  ];

  for (const m of additionalMachinesData) {
    await prisma.machine.upsert({
      where: { macAddress: m.macAddress },
      update: {
        name: m.name,
        status: m.status,
        wifiSsid: m.wifiSsid,
        lastSeen: m.lastSeen,
      },
      create: {
        id: m.id,
        barangayId: operatorBarangayId,
        macAddress: m.macAddress,
        name: m.name,
        status: m.status,
        wifiSsid: m.wifiSsid,
        lastSeen: m.lastSeen,
      },
    });
  }

  // Standard sensor configurations
  const sensorConfigs = [
    { type: 'temperature', unit: '°C', location: 'core' },
    { type: 'moisture', unit: '%', location: 'chamber' },
    { type: 'o2', unit: '%', location: 'aeration' },
    { type: 'co2', unit: '%', location: 'exhaust' },
  ];

  // 5. Populate the 2 original active machines (from original seed)
  const activeProfiles = [
    {
      batchCode: 'BATCH-2026-001',
      totalWeight: 20.0,
      daysAgo: 21,
      phaseName: 'Thermophilic Phase',
      phaseStartDaysAgo: 7,
      targets: {
        temperature: { current: 57.0, min: 52.0, max: 58.0 },
        moisture: { current: 23.0, min: 22.0, max: 25.0 },
        o2: { current: 67.0, min: 62.0, max: 68.0 },
        co2: { current: 0.04, min: 0.03, max: 0.05 },
      },
      feedstockWeights: [
        { feedstockId: 'feedstock_veg_scraps', weight: 8.0 },
        { feedstockId: 'feedstock_dry_leaves', weight: 6.0 },
        { feedstockId: 'feedstock_sawdust', weight: 4.0 },
        { feedstockId: 'feedstock_fruit_peels', weight: 2.0 },
      ],
    },
    {
      batchCode: 'BATCH-2026-002',
      totalWeight: 18.5,
      daysAgo: 14,
      phaseName: 'Cooling Phase',
      phaseStartDaysAgo: 6,
      targets: {
        temperature: { current: 34.0, min: 32.0, max: 37.0 },
        moisture: { current: 38.0, min: 35.0, max: 40.0 },
        o2: { current: 78.0, min: 72.0, max: 80.0 },
        co2: { current: 0.08, min: 0.06, max: 0.09 },
      },
      feedstockWeights: [
        { feedstockId: 'feedstock_food_waste', weight: 7.5 },
        { feedstockId: 'feedstock_dry_leaves', weight: 7.0 },
        { feedstockId: 'feedstock_coffee', weight: 4.0 },
      ],
    },
  ];

  console.log('\n5. Populating 2 original active machines...');
  for (let i = 0; i < existingMachines.length; i++) {
    const machine = existingMachines[i];
    const profile = activeProfiles[i] || activeProfiles[0];
    console.log(
      `Configuring Active Machine [${machine.name}] (${machine.id})...`,
    );

    // A. Sensors
    const createdSensors: Record<string, string> = {};
    for (const conf of sensorConfigs) {
      const sensorId = `sensor_${machine.id}_${conf.type}`;
      const sensor = await prisma.sensor.upsert({
        where: { id: sensorId },
        update: {
          sensorType: conf.type,
          unit: conf.unit,
          location: conf.location,
          status: 'active',
        },
        create: {
          id: sensorId,
          machineId: machine.id,
          sensorType: conf.type,
          unit: conf.unit,
          location: conf.location,
          status: 'active',
        },
      });
      createdSensors[conf.type] = sensor.id;
    }

    // B. Compost Batch
    const batchId = `batch_${machine.id}`;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - profile.daysAgo);

    const batch = await prisma.compostBatch.upsert({
      where: { id: batchId },
      update: {
        totalWeight: profile.totalWeight,
        startDate,
        status: 'active',
      },
      create: {
        id: batchId,
        machineId: machine.id,
        userId: existingUser.id,
        batchCode: `${profile.batchCode}-${machine.id.slice(-4)}`,
        totalWeight: profile.totalWeight,
        startDate,
        status: 'active',
      },
    });

    // C. Batch Feedstocks
    for (const fw of profile.feedstockWeights) {
      const bfId = `bf_${batch.id}_${fw.feedstockId}`;
      await prisma.batchFeedstock.upsert({
        where: { id: bfId },
        update: { weight: fw.weight },
        create: {
          id: bfId,
          batchId: batch.id,
          feedstockId: fw.feedstockId,
          weight: fw.weight,
        },
      });
    }

    // D. Composting Phase
    const phaseId = `phase_${batch.id}_active`;
    const phaseStartTime = new Date();
    phaseStartTime.setDate(
      phaseStartTime.getDate() - profile.phaseStartDaysAgo,
    );

    await prisma.compostingPhase.upsert({
      where: { id: phaseId },
      update: {
        phaseName: profile.phaseName,
        startTime: phaseStartTime,
        status: 'active',
      },
      create: {
        id: phaseId,
        batchId: batch.id,
        phaseName: profile.phaseName,
        startTime: phaseStartTime,
        status: 'active',
      },
    });

    // E. Sensor Readings (Time-series for past 24 hours)
    await prisma.sensorReading.deleteMany({
      where: { batchId: batch.id },
    });

    const readings: {
      batchId: string;
      sensorId: string;
      recordedAt: Date;
      value: number;
    }[] = [];

    const totalSteps = 48;
    const now = Date.now();
    const halfHourMs = 30 * 60 * 1000;

    for (let step = totalSteps; step >= 0; step--) {
      const timestamp = new Date(now - step * halfHourMs);
      const isLatest = step === 0;

      for (const conf of sensorConfigs) {
        const target =
          profile.targets[conf.type as keyof typeof profile.targets];
        let val: number;

        if (isLatest) {
          val = target.current;
        } else {
          const variance =
            (Math.random() - 0.5) * (target.max - target.min) * 0.4;
          val = parseFloat(
            (target.min + (target.max - target.min) * 0.5 + variance).toFixed(
              2,
            ),
          );
        }

        readings.push({
          batchId: batch.id,
          sensorId: createdSensors[conf.type],
          recordedAt: timestamp,
          value: val,
        });
      }
    }

    await prisma.sensorReading.createMany({ data: readings });
    console.log(`Inserted ${readings.length} readings for [${machine.name}].`);
  }

  // 6. Populate Case A: SAGANA-2 (Empty / Idle) -> Sensors present, but 0 batches
  console.log('\n6. Configuring Case A: SAGANA-2 (Empty / Idle)...');
  const idleMachine = await prisma.machine.findUnique({
    where: { macAddress: '00:1A:79:CB:01:02' },
  });
  if (idleMachine) {
    for (const conf of sensorConfigs) {
      const sensorId = `sensor_${idleMachine.id}_${conf.type}`;
      await prisma.sensor.upsert({
        where: { id: sensorId },
        update: {
          sensorType: conf.type,
          unit: conf.unit,
          location: conf.location,
          status: 'active',
        },
        create: {
          id: sensorId,
          machineId: idleMachine.id,
          sensorType: conf.type,
          unit: conf.unit,
          location: conf.location,
          status: 'active',
        },
      });
    }
    // Delete any batch if exists to ensure pure empty chamber state
    await prisma.compostBatch.deleteMany({
      where: { machineId: idleMachine.id },
    });
    console.log(
      `SAGANA-2 has 4 sensors installed, but 0 active batches (chamber empty/idle).`,
    );
  }

  // 7. Populate Case B: SAGANA-4 (No Sensors) -> 0 sensors, 0 batches
  console.log('\n7. Configuring Case B: SAGANA-4 (No Sensors)...');
  const noSensorMachine = await prisma.machine.findUnique({
    where: { macAddress: '00:1A:79:CB:01:04' },
  });
  if (noSensorMachine) {
    await prisma.sensor.deleteMany({
      where: { machineId: noSensorMachine.id },
    });
    await prisma.compostBatch.deleteMany({
      where: { machineId: noSensorMachine.id },
    });
    console.log(
      `SAGANA-4 configured with 0 sensors and 0 batches (brand new unconfigured).`,
    );
  }

  // 8. Populate Case C: SAGANA-5 (Harvest Ready / Completed Batch with Output)
  console.log('\n8. Configuring Case C: SAGANA-5 (Harvest Ready)...');
  const completedMachine = await prisma.machine.findUnique({
    where: { macAddress: '00:1A:79:CB:01:05' },
  });
  if (completedMachine) {
    for (const conf of sensorConfigs) {
      const sensorId = `sensor_${completedMachine.id}_${conf.type}`;
      await prisma.sensor.upsert({
        where: { id: sensorId },
        update: {
          sensorType: conf.type,
          unit: conf.unit,
          location: conf.location,
          status: 'active',
        },
        create: {
          id: sensorId,
          machineId: completedMachine.id,
          sensorType: conf.type,
          unit: conf.unit,
          location: conf.location,
          status: 'active',
        },
      });
    }

    const completedBatchId = `batch_${completedMachine.id}`;
    const start28DaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const completed2DaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const completedBatch = await prisma.compostBatch.upsert({
      where: { id: completedBatchId },
      update: {
        totalWeight: 25.0,
        startDate: start28DaysAgo,
        completionDate: completed2DaysAgo,
        status: 'completed',
      },
      create: {
        id: completedBatchId,
        machineId: completedMachine.id,
        userId: existingUser.id,
        batchCode: `BATCH-2026-COMP-${completedMachine.id.slice(-4)}`,
        totalWeight: 25.0,
        startDate: start28DaysAgo,
        completionDate: completed2DaysAgo,
        status: 'completed',
      },
    });

    // Compost output ready for collection
    const outputId = `output_${completedBatch.id}`;
    await prisma.compostOutput.upsert({
      where: { id: outputId },
      update: {
        outputWeight: 14.2,
        productionDate: completed2DaysAgo,
        status: 'ready_for_collection',
      },
      create: {
        id: outputId,
        batchId: completedBatch.id,
        outputWeight: 14.2,
        productionDate: completed2DaysAgo,
        status: 'ready_for_collection',
      },
    });

    console.log(
      `SAGANA-5 configured with completed batch and 14.2 kg compost output ready for collection.`,
    );
  }

  console.log('\n✅ All machine seed scenarios completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
