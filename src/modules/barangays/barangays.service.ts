import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  BARANGAY_CODE_MAX_ATTEMPTS,
  generateBarangayCode,
  isUniqueConstraintError,
  normalizeBarangayCode,
} from './barangay-code';

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

  async validateCode(input: unknown) {
    const code = normalizeBarangayCode(input);
    const barangay = await this.prisma.barangay.findFirst({
      where: { code, status: 'active' },
      select: { id: true, name: true },
    });
    if (!barangay) throw new BadRequestException('Invalid barangay code');
    return barangay;
  }

  private async adminBarangayId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { barangayId: true },
    });
    if (!user?.barangayId)
      throw new ForbiddenException('Admin barangay required');
    return user.barangayId;
  }

  async getCode(userId: string) {
    const id = await this.adminBarangayId(userId);
    return this.prisma.barangay.findUniqueOrThrow({
      where: { id },
      select: { code: true },
    });
  }

  async rotateCode(userId: string) {
    const id = await this.adminBarangayId(userId);
    const barangay = await this.prisma.barangay.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!barangay) throw new NotFoundException('Barangay not found');

    for (let attempt = 0; attempt < BARANGAY_CODE_MAX_ATTEMPTS; attempt++) {
      const code = generateBarangayCode();
      try {
        const result = await this.prisma.barangay.updateMany({
          where: { id, OR: [{ code: null }, { code: { not: code } }] },
          data: { code },
        });
        if (result.count) return { code };
      } catch (error: unknown) {
        if (!isUniqueConstraintError(error)) throw error;
      }
    }

    throw new InternalServerErrorException(
      'Failed to generate unique barangay code',
    );
  }
}
