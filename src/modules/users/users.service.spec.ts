import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: { user: { findMany: jest.Mock } };

  beforeEach(async () => {
    prismaService = {
      user: {
        findMany: jest.fn(),
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
      prismaService.user.findMany.mockResolvedValue(mockOperators);

      const result = await service.getOperators();
      expect(result).toEqual(mockOperators);
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: { role: 'operator' },
        include: { barangay: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
