import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class FeedstocksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.feedstock.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        status: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}

