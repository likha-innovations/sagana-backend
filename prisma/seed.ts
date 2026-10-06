import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...');

  // 1. Seed Barangays
  console.log('Seeding Barangays 170-180...');
  
  const barangays = Array.from({ length: 11 }, (_, i) => `Barangay ${170 + i}`);
  
  for (const name of barangays) {
    const id = `brgy_${name.replace(' ', '_').toLowerCase()}`;
    await prisma.barangay.upsert({
      where: { 
        id
      },
      update: {},
      create: {
        id,
        name,
      },
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
