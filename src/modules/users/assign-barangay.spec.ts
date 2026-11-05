import { UsersService } from './users.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';

describe('assignBarangay', () => {
  const tx = {
    $queryRaw: jest.fn(),
    user: { updateMany: jest.fn(), findUnique: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    {} as LoggerService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(service, 'getProfile').mockResolvedValue({} as never);
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    tx.$queryRaw.mockResolvedValue([{ id: 'b1', name: 'Barangay 1' }]);
    tx.user.updateMany.mockResolvedValue({ count: 1 });
  });
  afterEach(() => jest.restoreAllMocks());

  it('assigns a validated code to an unassigned user', async () => {
    await expect(service.assignBarangay('user', 'a1b2c3')).resolves.toEqual({
      id: 'b1',
      name: 'Barangay 1',
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user', barangayId: null },
      data: { barangayId: 'b1' },
    });
    expect(tx.$queryRaw.mock.calls[0][1]).toBe('A1B2C3');
  });

  it('rejects a rotated code without assigning', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(
      service.assignBarangay('user', 'OLD123'),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('allows retries for the same barangay but never replaces another assignment', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    tx.user.findUnique
      .mockResolvedValueOnce({ barangayId: 'b1' })
      .mockResolvedValueOnce({ barangayId: 'b2' });
    await expect(service.assignBarangay('user', 'ABC123')).resolves.toEqual({
      id: 'b1',
      name: 'Barangay 1',
    });
    await expect(
      service.assignBarangay('user', 'ABC123'),
    ).rejects.toMatchObject({ status: 409 });
  });
});
