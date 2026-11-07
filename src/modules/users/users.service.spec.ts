import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { createClerkClient } from '@clerk/backend';

jest.mock('@clerk/backend', () => ({ createClerkClient: jest.fn() }));

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: {
    user: { findMany: jest.Mock; findUnique: jest.Mock; upsert: jest.Mock };
    barangay: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      barangay: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOperators', () => {
    it('should query prisma for users with role operator', async () => {
      const mockOperators = [{ id: 'user_1', role: 'operator' }];
      prismaService.user.findUnique.mockResolvedValue({
        barangayId: 'brgy_176',
      });
      prismaService.user.findMany.mockResolvedValue(mockOperators);

      const result = await service.getOperators('admin');
      expect(result).toEqual(mockOperators);
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: { role: 'operator', barangayId: 'brgy_176' },
        include: {
          barangay: {
            select: { id: true, name: true, status: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('rejects an admin with no assigned barangay', async () => {
      prismaService.user.findUnique.mockResolvedValue({ barangayId: null });
      await expect(service.getOperators('admin')).rejects.toMatchObject({
        status: 403,
      });
      expect(prismaService.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('profile synchronization', () => {
    it('provisions admin role and assigned barangay when present in publicMetadata', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.barangay.findUnique.mockResolvedValue({ id: 'b1' });
      prismaService.user.upsert.mockResolvedValue({
        id: 'admin_1',
        role: 'admin',
        barangayId: 'b1',
      });
      jest.mocked(createClerkClient).mockReturnValue({
        users: {
          getUser: jest.fn().mockResolvedValue({
            emailAddresses: [{ emailAddress: 'admin@example.com' }],
            publicMetadata: { role: 'admin', barangayId: 'b1' },
            unsafeMetadata: {},
            fullName: 'Admin User',
          }),
        },
      } as never);
      await service.getProfile('admin_1');
      const args = prismaService.user.upsert.mock.calls[0][0];
      expect(args.create.role).toBe('admin');
      expect(args.create.barangayId).toBe('b1');
      expect(args.update.role).toBe('admin');
      expect(args.update.barangayId).toBe('b1');
      expect(args.include.barangay.select).not.toHaveProperty('code');
    });

    it('rejects client-side unsafeMetadata role attempt and forces operator', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.upsert.mockResolvedValue({
        id: 'user_1',
        role: 'operator',
        barangayId: null,
      });
      jest.mocked(createClerkClient).mockReturnValue({
        users: {
          getUser: jest.fn().mockResolvedValue({
            emailAddresses: [{ emailAddress: 'user@example.com' }],
            publicMetadata: {},
            unsafeMetadata: { role: 'admin', barangayId: 'b2' },
            fullName: 'Test User',
          }),
        },
      } as never);
      await service.getProfile('user_1');
      const args = prismaService.user.upsert.mock.calls[0][0];
      expect(args.create.role).toBe('operator');
      expect(args.create.barangayId).toBeNull();
      expect(args.update).not.toHaveProperty('role');
      expect(args.update).not.toHaveProperty('barangayId');
    });

    it('safely handles non-existent publicMetadata.barangayId by falling back to null', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.barangay.findUnique.mockResolvedValue(null);
      prismaService.user.upsert.mockResolvedValue({
        id: 'admin_2',
        role: 'admin',
        barangayId: null,
      });
      jest.mocked(createClerkClient).mockReturnValue({
        users: {
          getUser: jest.fn().mockResolvedValue({
            emailAddresses: [{ emailAddress: 'admin2@example.com' }],
            publicMetadata: { role: 'admin', barangayId: 'nonexistent_brgy' },
            unsafeMetadata: {},
            fullName: 'Admin Two',
          }),
        },
      } as never);
      await service.getProfile('admin_2');
      const args = prismaService.user.upsert.mock.calls[0][0];
      expect(args.create.role).toBe('admin');
      expect(args.create.barangayId).toBeNull();
    });

    it('defaults to operator when publicMetadata is empty', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.upsert.mockResolvedValue({
        id: 'user_3',
        role: 'operator',
        barangayId: null,
      });
      jest.mocked(createClerkClient).mockReturnValue({
        users: {
          getUser: jest.fn().mockResolvedValue({
            emailAddresses: [{ emailAddress: 'user3@example.com' }],
            publicMetadata: {},
            unsafeMetadata: {},
            fullName: 'Normal User',
          }),
        },
      } as never);
      await service.getProfile('user_3');
      const args = prismaService.user.upsert.mock.calls[0][0];
      expect(args.create.role).toBe('operator');
      expect(args.create.barangayId).toBeNull();
    });
  });
});
