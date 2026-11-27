import { PrismaClient } from '@prisma/client';
import {
  BARANGAY_CODE_MAX_ATTEMPTS,
  generateBarangayCode,
  isUniqueConstraintError,
} from '../src/modules/barangays/barangay-code';

export async function seedBarangayCodes(prisma: PrismaClient) {
  const barangays = await prisma.barangay.findMany({
    where: { code: null },
    select: { id: true },
  });
  for (const barangay of barangays) {
    let assigned = false;
    for (let attempt = 0; attempt < BARANGAY_CODE_MAX_ATTEMPTS; attempt++) {
      try {
        await prisma.barangay.updateMany({
          where: { id: barangay.id, code: null },
          data: { code: generateBarangayCode() },
        });
        assigned = true;
        break;
      } catch (error: unknown) {
        if (!isUniqueConstraintError(error)) throw error;
      }
    }
    if (!assigned) {
      throw new Error(
        `Failed to generate unique code for barangay ${barangay.id}`,
      );
    }
  }
}

export async function seedBarangays(prisma: PrismaClient) {
  const barangays = Array.from({ length: 11 }, (_, i) => ({
    id: `brgy_${170 + i}`,
    name: `Barangay ${170 + i}`,
  }));

  for (const brgy of barangays) {
    await prisma.barangay.upsert({
      where: { id: brgy.id },
      update: { name: brgy.name },
      create: { id: brgy.id, name: brgy.name },
    });
  }

  await seedBarangayCodes(prisma);
}

