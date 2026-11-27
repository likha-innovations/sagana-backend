import { PrismaClient } from '@prisma/client';
import { seedBarangayCodes } from '../../../prisma/seed-barangays';

describe('Safe seed helpers', () => {
  it('fills missing codes without replacing existing codes on repeat runs', async () => {
    const rows = [
      { id: 'b1', code: null as string | null },
      { id: 'b2', code: 'OLD123' },
    ];
    const prisma = {
      barangay: {
        findMany: jest.fn(() =>
          Promise.resolve(
            rows.filter((row) => row.code === null).map(({ id }) => ({ id })),
          ),
        ),
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: { code: string };
          }) => {
            const row = rows.find(
              (item) => item.id === where.id && item.code === null,
            );
            if (row) row.code = data.code;
            return Promise.resolve({ count: row ? 1 : 0 });
          },
        ),
      },
    };
    await seedBarangayCodes(prisma as unknown as PrismaClient);
    const generated = rows[0].code;
    expect(generated).toMatch(/^[A-Z0-9]{6}$/);
    await seedBarangayCodes(prisma as unknown as PrismaClient);
    expect(rows).toEqual([
      { id: 'b1', code: generated },
      { id: 'b2', code: 'OLD123' },
    ]);
    expect(prisma.barangay.updateMany).toHaveBeenCalledTimes(1);
  });

  it('throws after max attempts if seeding continuously hits unique collisions', async () => {
    const prisma = {
      barangay: {
        findMany: jest.fn().mockResolvedValue([{ id: 'b1' }]),
        updateMany: jest.fn().mockRejectedValue({ code: 'P2002' }),
      },
    };
    await expect(
      seedBarangayCodes(prisma as unknown as PrismaClient),
    ).rejects.toThrow('Failed to generate unique code for barangay b1');
    expect(prisma.barangay.updateMany).toHaveBeenCalledTimes(5);
  });
});
