import { PrismaClient } from '@prisma/client';
import { generateBarangayCode } from '../src/modules/barangays/barangay-code';

export async function seedBarangayCodes(prisma: PrismaClient) {
  const barangays = await prisma.barangay.findMany({
    where: { code: null },
    select: { id: true },
  });
  for (const barangay of barangays) {
    for (;;) {
      try {
        await prisma.barangay.updateMany({
          where: { id: barangay.id, code: null },
          data: { code: generateBarangayCode() },
        });
        break;
      } catch (error: unknown) {
        if (
          typeof error !== 'object' ||
          error === null ||
          !('code' in error) ||
          error.code !== 'P2002'
        )
          throw error;
      }
    }
  }
}
