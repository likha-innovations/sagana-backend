import { BarangaysService } from './barangays.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('Barangay codes', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    barangay: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const service = new BarangaysService(prisma as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('normalizes mixed-case codes without losing leading zeroes', async () => {
    prisma.barangay.findFirst.mockResolvedValue({
      id: 'b1',
      name: 'Barangay 1',
    });
    await expect(service.validateCode('0aB123')).resolves.toEqual({
      id: 'b1',
      name: 'Barangay 1',
    });
    expect(prisma.barangay.findFirst).toHaveBeenCalledWith({
      where: { code: '0AB123', status: 'active' },
      select: { id: true, name: true },
    });
  });

  it('rejects malformed, inactive, and unknown codes', async () => {
    await expect(service.validateCode('ABC-12')).rejects.toThrow(
      'Invalid barangay code',
    );
    prisma.barangay.findFirst.mockResolvedValue(null);
    await expect(service.validateCode('ABC123')).rejects.toThrow(
      'Invalid barangay code',
    );
  });

  it('returns only the admin barangay code', async () => {
    prisma.user.findUnique.mockResolvedValue({ barangayId: 'b1' });
    prisma.barangay.findUniqueOrThrow.mockResolvedValue({ code: 'ABC123' });
    await expect(service.getCode('admin')).resolves.toEqual({ code: 'ABC123' });
    expect(prisma.barangay.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'b1' },
      select: { code: true },
    });
  });

  it('requires the admin to have a barangay', async () => {
    prisma.user.findUnique.mockResolvedValue({ barangayId: null });
    await expect(service.getCode('admin')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('retries a duplicate and rotates to a different code', async () => {
    prisma.user.findUnique.mockResolvedValue({ barangayId: 'b1' });
    prisma.barangay.updateMany
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockResolvedValueOnce({ count: 1 });
    const { code } = await service.rotateCode('admin');
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(prisma.barangay.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.barangay.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'b1', OR: [{ code: null }, { code: { not: code } }] },
      data: { code },
    });
  });
});
