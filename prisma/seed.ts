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

  // 2. Seed Users
  console.log('Seeding Users...');

  const users = [
    {
      id: 'user_3Jo3GfxbRZiTedSB7c0oJDhcf9r',
      fullName: 'LIKHA Innovations',
      email: 'likhainnovations.tech@gmail.com',
      role: 'admin',
      barangayId: null,
      birthday: '2000-09-01 00:00:00',
      status: 'active',
      createdAt: new Date('2026-09-30T01:56:17.01Z'),
      updatedAt: new Date('2026-09-30T01:56:17.01Z'),
    },
    {
      id: 'user_3K1rf5bmYPckOLFJ9ONTXZDp4sh',
      fullName: 'Denz Christian G. Sabalboro',
      email: 'denz.sabalboro@gmail.com',
      role: 'operator',
      barangayId: null,
      birthday: '2005-11-05 16:00:00',
      status: 'active',
      createdAt: new Date('2026-09-30T02:40:34.119Z'),
      updatedAt: new Date('2026-09-30T02:40:34.119Z'),
    }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        barangayId: user.barangayId,
        birthday: user.birthday,
        status: user.status,
      },
      create: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        barangayId: user.barangayId,
        birthday: user.birthday,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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
