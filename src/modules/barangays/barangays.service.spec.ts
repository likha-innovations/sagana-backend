import { BarangaysService } from './barangays.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('Barangay codes', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    barangay: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
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
    prisma.barangay.findUnique.mockResolvedValue({ id: 'b1' });
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

  it('throws 404 without looping when the admin barangay does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue({ barangayId: 'missing' });
    prisma.barangay.findUnique.mockResolvedValue(null);
    await expect(service.rotateCode('admin')).rejects.toMatchObject({
      status: 404,
      message: 'Barangay not found',
    });
    expect(prisma.barangay.updateMany).not.toHaveBeenCalled();
  });

  it('throws 500 after max attempts on repeated unique collisions', async () => {
    prisma.user.findUnique.mockResolvedValue({ barangayId: 'b1' });
    prisma.barangay.findUnique.mockResolvedValue({ id: 'b1' });
    prisma.barangay.updateMany.mockRejectedValue({ code: 'P2002' });
    await expect(service.rotateCode('admin')).rejects.toMatchObject({
      status: 500,
      message: 'Failed to generate unique barangay code',
    });
    expect(prisma.barangay.updateMany).toHaveBeenCalledTimes(5);
  });

  it('throws 500 after max attempts when updateMany never updates a row', async () => {
    prisma.user.findUnique.mockResolvedValue({ barangayId: 'b1' });
    prisma.barangay.findUnique.mockResolvedValue({ id: 'b1' });
    prisma.barangay.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.rotateCode('admin')).rejects.toMatchObject({
      status: 500,
      message: 'Failed to generate unique barangay code',
    });
    expect(prisma.barangay.updateMany).toHaveBeenCalledTimes(5);
  });
});
