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

  console.log('Seeding Barangays 170-180...');
  
  const barangays = Array.from({ length: 11 }, (_, i) => ({
    number: 170 + i,
    name: `Barangay ${170 + i}`,
  }));

  for (const brgy of barangays) {
    const id = `brgy_${brgy.number}`;
    await prisma.barangay.upsert({
      where: { id },
      update: {
        name: brgy.name,
      },
      create: {
        id,
        name: brgy.name,
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
