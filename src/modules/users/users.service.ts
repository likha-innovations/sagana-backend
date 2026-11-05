import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { createClerkClient } from '@clerk/backend';
import { normalizeBarangayCode } from '../barangays/barangay-code';

const barangayProfile = {
  select: { id: true, name: true, status: true, createdAt: true },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async getProfile(userId: string) {
    this.logger.log(`Fetching profile for user ${userId}`, UsersService.name);
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { barangay: barangayProfile },
    });

    if (!user) {
      this.logger.log(
        `User ${userId} not found in database, syncing from Clerk...`,
        UsersService.name,
      );
      try {
        const clerk = createClerkClient({
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        const clerkUser = await clerk.users.getUser(userId);
        const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
        const publicMetadata = clerkUser.publicMetadata || {};
        const unsafeMetadata = clerkUser.unsafeMetadata || {};

        const fullName =
          clerkUser.fullName ||
          (unsafeMetadata.fullName as string | undefined) ||
          `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
          null;

        const birthdayRaw = (publicMetadata.birthday ||
          unsafeMetadata.birthday) as string | null;
        const birthday = birthdayRaw ? new Date(birthdayRaw) : null;

        const status = (publicMetadata.status ||
          unsafeMetadata.status ||
          'active') as string;

        user = await this.prisma.user.upsert({
          where: { id: userId },
          update: {
            fullName,
            email,
            birthday,
            status,
          },
          create: {
            id: userId,
            fullName,
            email,
            birthday,
            status,
          },
          include: { barangay: barangayProfile },
        });
      } catch (err) {
        this.logger.warn(
          `Failed to auto-sync user ${userId} from Clerk: ${err}`,
          UsersService.name,
        );
        throw new NotFoundException('User profile not found');
      }
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      birthday?: string;
      barangayId?: string;
    },
  ) {
    this.logger.log(`Updating profile for user ${userId}`, UsersService.name);

    const user = await this.getProfile(userId);

    const updateData: Record<string, unknown> = {};

    if (data.firstName !== undefined || data.lastName !== undefined) {
      const parts = (user.fullName || '').split(' ');
      const existingFirst = parts.length > 0 ? parts[0] : '';
      const existingLast = parts.length > 1 ? parts.slice(1).join(' ') : '';

      const first =
        data.firstName !== undefined ? data.firstName : existingFirst;
      const last = data.lastName !== undefined ? data.lastName : existingLast;

      updateData.fullName = `${first} ${last}`.trim();
    }

    if (data.birthday !== undefined) {
      updateData.birthday = data.birthday ? new Date(data.birthday) : null;
    }
    if (data.barangayId !== undefined) {
      updateData.barangayId = data.barangayId;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { barangay: barangayProfile },
    });
  }

  async getOperators(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { barangayId: true },
    });
    if (!user?.barangayId)
      throw new ForbiddenException('Admin barangay required');
    return this.prisma.user.findMany({
      where: { role: 'operator', barangayId: user.barangayId },
      include: { barangay: barangayProfile },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignBarangay(userId: string, input: unknown) {
    const code = normalizeBarangayCode(input);
    await this.getProfile(userId);
    return this.prisma.$transaction(async (tx) => {
      const [barangay] = await tx.$queryRaw<{ id: string; name: string }[]>`
        SELECT barangay_id AS id, name FROM barangays
        WHERE code = ${code} AND status = 'active' FOR SHARE
      `;
      if (!barangay) throw new BadRequestException('Invalid barangay code');
      const updated = await tx.user.updateMany({
        where: { id: userId, barangayId: null },
        data: { barangayId: barangay.id },
      });
      if (!updated.count) {
        const current = await tx.user.findUnique({
          where: { id: userId },
          select: { barangayId: true },
        });
        if (current?.barangayId !== barangay.id)
          throw new ConflictException('Barangay already assigned');
      }
      return barangay;
    });
  }
}
