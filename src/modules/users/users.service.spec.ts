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
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
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
        include: { barangay: true },
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
    it('does not assign or overwrite a role from Clerk metadata', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.upsert.mockResolvedValue({
        id: 'user_1',
        role: 'operator',
      });
      jest.mocked(createClerkClient).mockReturnValue({
        users: {
          getUser: jest.fn().mockResolvedValue({
            emailAddresses: [{ emailAddress: 'user@example.com' }],
            publicMetadata: { role: 'admin' },
            unsafeMetadata: { role: 'admin' },
            fullName: 'Test User',
            firstName: 'Test',
            lastName: 'User',
          }),
        },
      } as never);
      await service.getProfile('user_1');
      const args = prismaService.user.upsert.mock.calls[0][0];
      expect(args.create).not.toHaveProperty('role');
      expect(args.update).not.toHaveProperty('role');
    });
  });
});
