import { Test, TestingModule } from '@nestjs/testing';
import { FeedstocksController } from './feedstocks.controller';
import { FeedstocksService } from './feedstocks.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('FeedstocksController', () => {
  let controller: FeedstocksController;
  let service: FeedstocksService;

  const mockFeedstocks = [
    {
      id: 'fs-1',
      name: 'Coffee Grounds',
      category: 'green',
      description: 'Used coffee grounds',
      status: 'active',
    },
    {
      id: 'fs-2',
      name: 'Cardboards',
      category: 'brown',
      description: 'Shredded cardboard',
      status: 'active',
    },
  ];

  const mockPrisma = {
    feedstock: {
      findMany: jest.fn().mockResolvedValue(mockFeedstocks),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedstocksController],
      providers: [
        FeedstocksService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    controller = module.get<FeedstocksController>(FeedstocksController);
    service = module.get<FeedstocksService>(FeedstocksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return active feedstocks list', async () => {
      const result = await controller.findAll();
      expect(result).toEqual(mockFeedstocks);
      expect(mockPrisma.feedstock.findMany).toHaveBeenCalledWith({
        where: { status: 'active' },
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          status: true,
        },
        orderBy: { name: 'asc' },
      });
    });
  });
});
