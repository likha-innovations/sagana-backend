import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Standard sensor configurations
const SENSOR_CONFIGS = [
  { type: 'temperature', unit: '°C', location: 'core' },
  { type: 'moisture', unit: '%', location: 'chamber' },
  { type: 'oxygen', unit: '%', location: 'aeration' },
  { type: 'co2', unit: 'ppm', location: 'exhaust' },
];

async function purgeMachineData(machineId: string) {
  const batches = await prisma.compostBatch.findMany({
    where: { machineId },
    select: { id: true },
  });
  const batchIds = batches.map((b) => b.id);

  if (batchIds.length > 0) {
    await prisma.sensorReading.deleteMany({
      where: { batchId: { in: batchIds } },
    });
    await prisma.compostingPhase.deleteMany({
      where: { batchId: { in: batchIds } },
    });
    await prisma.batchFeedstock.deleteMany({
      where: { batchId: { in: batchIds } },
    });
    await prisma.compostBatch.deleteMany({
      where: { id: { in: batchIds } },
    });
  }

  // Purge legacy o2 sensor records to prevent duplicate sensor entries
  await prisma.sensor.deleteMany({
    where: { machineId, sensorType: 'o2' },
  });

  // Also purge any orphaned sensor readings for sensors attached to this machine
  const sensors = await prisma.sensor.findMany({
    where: { machineId },
    select: { id: true },
  });
  const sensorIds = sensors.map((s) => s.id);
  if (sensorIds.length > 0) {
    await prisma.sensorReading.deleteMany({
      where: { sensorId: { in: sensorIds } },
    });
  }
}

async function ensureSensors(machineId: string): Promise<Record<string, string>> {
  const sensorMap: Record<string, string> = {};
  for (const conf of SENSOR_CONFIGS) {
    const sensorId = `sensor_${machineId}_${conf.type}`;
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
        machineId,
        sensorType: conf.type,
        unit: conf.unit,
        location: conf.location,
        status: 'active',
      },
    });
    sensorMap[conf.type] = sensor.id;
  }
  return sensorMap;
}

interface PhaseDefinition {
  name: string;
  timestamp: Date;
}

interface LatestTargets {
  temperature: number;
  moisture: number;
  oxygen: number;
  co2: number;
}

function generatePhaseAwareReadings({
  batchId,
  sensorMap,
  startDate,
  endDate,
  phases,
  stepIntervalHours = 2,
  latestTargets,
}: {
  batchId: string;
  sensorMap: Record<string, string>;
  startDate: Date;
  endDate: Date;
  phases: PhaseDefinition[];
  stepIntervalHours?: number;
  latestTargets?: LatestTargets;
}) {
  const readings: {
    batchId: string;
    sensorId: string;
    recordedAt: Date;
    value: number;
  }[] = [];

  const PHASE_TARGETS = {
    mesophilic: {
      temperature: { min: 35.0, max: 45.0 },
      moisture: { min: 55.0, max: 65.0 },
      oxygen: { min: 12.0, max: 18.0 },
      co2: { min: 400.0, max: 600.0 },
    },
    thermophilic: {
      temperature: { min: 55.0, max: 65.0 },
      moisture: { min: 50.0, max: 60.0 },
      oxygen: { min: 10.0, max: 15.0 },
      co2: { min: 600.0, max: 800.0 },
    },
    cooling: {
      temperature: { min: 25.0, max: 35.0 },
      moisture: { min: 40.0, max: 50.0 },
      oxygen: { min: 16.0, max: 20.0 },
      co2: { min: 400.0, max: 500.0 },
    },
  };

  const getPhaseTargets = (t: Date) => {
    let activePhase = phases[0]?.name?.toLowerCase() || 'mesophilic';
    for (const p of phases) {
      if (t.getTime() >= p.timestamp.getTime()) {
        activePhase = p.name.toLowerCase();
      }
    }
    if (activePhase.includes('thermo')) return PHASE_TARGETS.thermophilic;
    if (activePhase.includes('cool')) return PHASE_TARGETS.cooling;
    return PHASE_TARGETS.mesophilic;
  };

  const stepIntervalMs = stepIntervalHours * 60 * 60 * 1000;
  const timestamps: Date[] = [];
  let curr = startDate.getTime();
  const end = endDate.getTime();

  while (curr < end) {
    timestamps.push(new Date(curr));
    curr += stepIntervalMs;
  }
  if (timestamps.length === 0 || timestamps[timestamps.length - 1].getTime() !== end) {
    timestamps.push(new Date(end));
  }

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    const isLatest = i === timestamps.length - 1;
    const targets = getPhaseTargets(timestamp);

    for (const conf of SENSOR_CONFIGS) {
      const typeKey = conf.type as keyof LatestTargets;
      let val: number;

      if (isLatest && latestTargets && latestTargets[typeKey] !== undefined) {
        val = latestTargets[typeKey];
      } else {
        const targetRange = targets[typeKey];
        const span = targetRange.max - targetRange.min;
        const variance = (Math.random() - 0.5) * span * 0.4;
        val = parseFloat((targetRange.min + span * 0.5 + variance).toFixed(1));
      }

      readings.push({
        batchId,
        sensorId: sensorMap[conf.type],
        recordedAt: timestamp,
        value: val,
      });
    }
  }

  return readings;
}

async function main() {
  console.log('--- Starting Seed ---');

  // 1. Sanitize any legacy whitespace in machine statuses
  console.log('1. Sanitizing status whitespace formatting across machines...');
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE machines SET status = TRIM(status) WHERE status != TRIM(status)`,
    );
  } catch (err) {
    console.warn('Could not run raw whitespace cleanup:', err);
  }

  // 2. Fetch default operator user
  console.log('2. Resolving target operator user...');
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

  // 4. Canonical Machine Definitions
  const CANONICAL_MACHINES = [
    {
      id: 'machine_sagana_active',
      macAddress: '00:1A:79:CB:01:01',
      name: 'SAGANA-1 (Active Composting)',
      status: 'active',
      wifiSsid: 'Steler2.4',
      lastSeen: new Date(Date.now() - 2 * 60 * 1000), // 2 mins ago
    },
    {
      id: 'machine_sagana_completed',
      macAddress: '00:1A:79:CB:01:05',
      name: 'SAGANA-5 (Harvest Ready)',
      status: 'active',
      wifiSsid: 'Steler2.4',
      lastSeen: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
    },
    {
      id: 'machine_sagana_idle',
      macAddress: '00:1A:79:CB:01:02',
      name: 'SAGANA-2 (Vacant / Idle)',
      status: 'active',
      wifiSsid: 'Steler2.4',
      lastSeen: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago
    },
    {
      id: 'machine_sagana_offline',
      macAddress: '00:1A:79:CB:01:04',
      name: 'SAGANA-4 (Offline / Outdated)',
      status: 'offline',
      wifiSsid: 'Steler2.4',
      lastSeen: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
  ];

  console.log('4. Upserting 4 canonical machines...');
  for (const m of CANONICAL_MACHINES) {
    await prisma.machine.upsert({
      where: { macAddress: m.macAddress },
      update: {
        name: m.name,
        status: m.status,
        wifiSsid: m.wifiSsid,
        lastSeen: m.lastSeen,
        barangayId: operatorBarangayId,
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

  // Retrieve the 4 machines from DB by MAC to guarantee actual database IDs
  const machine1 = await prisma.machine.findUniqueOrThrow({
    where: { macAddress: '00:1A:79:CB:01:01' },
  });
  const machine2 = await prisma.machine.findUniqueOrThrow({
    where: { macAddress: '00:1A:79:CB:01:05' },
  });
  const machine3 = await prisma.machine.findUniqueOrThrow({
    where: { macAddress: '00:1A:79:CB:01:02' },
  });
  const machine4 = await prisma.machine.findUniqueOrThrow({
    where: { macAddress: '00:1A:79:CB:01:04' },
  });

  // Purge prior batches and readings for all 4 machines to ensure pure, non-conflicting states
  console.log('Purging legacy batches & readings for canonical machines...');
  await purgeMachineData(machine1.id);
  await purgeMachineData(machine2.id);
  await purgeMachineData(machine3.id);
  await purgeMachineData(machine4.id);

  // Install / verify 4 sensors on all 4 canonical machines
  const sensors1 = await ensureSensors(machine1.id);
  const sensors2 = await ensureSensors(machine2.id);
  await ensureSensors(machine3.id);
  const sensors4 = await ensureSensors(machine4.id);

  // =========================================================================
  // SCENARIO 1: Machine 1 (Active Composting, Online)
  // =========================================================================
  console.log('\n--- Seeding Scenario 1: Machine 1 (Active Composting, Online) ---');
  const m1StartDate = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
  const m1Phase1End = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
  const m1BatchId = `batch_${machine1.id}_active`;

  const batch1 = await prisma.compostBatch.create({
    data: {
      id: m1BatchId,
      machineId: machine1.id,
      userId: existingUser.id,
      batchCode: 'BATCH-2026-ACTIVE-001',
      totalWeight: 32.5,
      startDate: m1StartDate,
      completionDate: null,
      status: 'active',
      feedstocks: {
        create: [
          { feedstockId: 'feedstock_veg_scraps', weight: 12.0 },
          { feedstockId: 'feedstock_fruit_peels', weight: 6.5 },
          { feedstockId: 'feedstock_dry_leaves', weight: 8.0 },
          { feedstockId: 'feedstock_sawdust', weight: 6.0 },
        ],
      },
      compostingPhases: {
        create: [
          {
            phaseName: 'Mesophilic Phase',
            timestamp: m1StartDate,
            status: 'completed',
          },
          {
            phaseName: 'Thermophilic Phase',
            timestamp: m1Phase1End,
            status: 'active',
          },
        ],
      },
    },
  });

  const readings1 = generatePhaseAwareReadings({
    batchId: batch1.id,
    sensorMap: sensors1,
    startDate: m1StartDate,
    endDate: new Date(),
    phases: [
      { name: 'Mesophilic Phase', timestamp: m1StartDate },
      { name: 'Thermophilic Phase', timestamp: m1Phase1End },
    ],
    stepIntervalHours: 2,
    latestTargets: {
      temperature: 56.8,
      moisture: 60.0,
      oxygen: 16.0,
      co2: 650.0,
    },
  });
  await prisma.sensorReading.createMany({ data: readings1 });
  console.log(
    `✅ Machine 1 [${machine1.name}] seeded with active batch, 4 feedstocks (32.5 kg), 2 phases, and ${readings1.length} fresh sensor readings.`,
  );

  // =========================================================================
  // SCENARIO 2: Machine 2 (Harvest Ready / Completed Batch)
  // =========================================================================
  console.log('\n--- Seeding Scenario 2: Machine 2 (Harvest Ready / Completed Batch) ---');
  const m2StartDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const m2Phase1End = new Date(Date.now() - 24 * 24 * 60 * 60 * 1000);
  const m2Phase2End = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const m2CompletionDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
  const m2BatchId = `batch_${machine2.id}_completed`;

  const batch2 = await prisma.compostBatch.create({
    data: {
      id: m2BatchId,
      machineId: machine2.id,
      userId: existingUser.id,
      batchCode: 'BATCH-2026-HARVEST-005',
      totalWeight: 25.0,
      finalWeight: 15.2,
      startDate: m2StartDate,
      completionDate: m2CompletionDate,
      status: 'completed',
      feedstocks: {
        create: [
          { feedstockId: 'feedstock_veg_scraps', weight: 15.0 },
          { feedstockId: 'feedstock_dry_leaves', weight: 10.0 },
        ],
      },
      compostingPhases: {
        create: [
          {
            phaseName: 'Mesophilic Phase',
            timestamp: m2StartDate,
            status: 'completed',
          },
          {
            phaseName: 'Thermophilic Phase',
            timestamp: m2Phase1End,
            status: 'completed',
          },
          {
            phaseName: 'Cooling Phase',
            timestamp: m2Phase2End,
            status: 'completed',
          },
        ],
      },
    },
  });

  const readings2 = generatePhaseAwareReadings({
    batchId: batch2.id,
    sensorMap: sensors2,
    startDate: m2StartDate,
    endDate: m2CompletionDate,
    phases: [
      { name: 'Mesophilic Phase', timestamp: m2StartDate },
      { name: 'Thermophilic Phase', timestamp: m2Phase1End },
      { name: 'Cooling Phase', timestamp: m2Phase2End },
    ],
    stepIntervalHours: 2,
    latestTargets: {
      temperature: 31.5,
      moisture: 42.0,
      oxygen: 19.5,
      co2: 460.0,
    },
  });
  await prisma.sensorReading.createMany({ data: readings2 });
  console.log(
    `✅ Machine 2 [${machine2.name}] seeded with completed batch, 15.2 kg final weight, and 0 active batches.`,
  );

  // =========================================================================
  // SCENARIO 3: Machine 3 (Vacant / Idle)
  // =========================================================================
  console.log('\n--- Seeding Scenario 3: Machine 3 (Vacant / Idle) ---');
  // 0 batches, 4 sensors installed, chamber empty & ready for wizard
  console.log(
    `✅ Machine 3 [${machine3.name}] confirmed with 4 sensors installed and 0 active batches (pure vacant chamber).`,
  );

  // =========================================================================
  // SCENARIO 4: Machine 4 (Offline / Outdated)
  // =========================================================================
  console.log('\n--- Seeding Scenario 4: Machine 4 (Offline / Outdated) ---');
  const m4StartDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const m4Phase1End = new Date(Date.now() - 11 * 24 * 60 * 60 * 1000);
  const m4OfflineDate = machine4.lastSeen || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const m4BatchId = `batch_${machine4.id}_offline`;

  const batch4 = await prisma.compostBatch.create({
    data: {
      id: m4BatchId,
      machineId: machine4.id,
      userId: existingUser.id,
      batchCode: 'BATCH-2026-STALE-004',
      totalWeight: 20.0,
      startDate: m4StartDate,
      completionDate: null,
      status: 'active',
      feedstocks: {
        create: [
          { feedstockId: 'feedstock_food_waste', weight: 12.0 },
          { feedstockId: 'feedstock_sawdust', weight: 8.0 },
        ],
      },
      compostingPhases: {
        create: [
          {
            phaseName: 'Mesophilic Phase',
            timestamp: m4StartDate,
            status: 'completed',
          },
          {
            phaseName: 'Thermophilic Phase',
            timestamp: m4Phase1End,
            status: 'active',
          },
        ],
      },
    },
  });

  const readings4 = generatePhaseAwareReadings({
    batchId: batch4.id,
    sensorMap: sensors4,
    startDate: m4StartDate,
    endDate: m4OfflineDate,
    phases: [
      { name: 'Mesophilic Phase', timestamp: m4StartDate },
      { name: 'Thermophilic Phase', timestamp: m4Phase1End },
    ],
    stepIntervalHours: 2,
    latestTargets: {
      temperature: 52.0,
      moisture: 58.0,
      oxygen: 15.0,
      co2: 720.0,
    },
  });
  await prisma.sensorReading.createMany({ data: readings4 });
  console.log(
    `✅ Machine 4 [${machine4.name}] seeded with active batch and outdated readings (>3 days old) to verify offline warnings.`,
  );

  console.log('\n✨ All 4 canonical machine seed scenarios completed successfully!');
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
