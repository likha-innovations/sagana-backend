import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class BarangaysService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return await this.prisma.barangay.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}
