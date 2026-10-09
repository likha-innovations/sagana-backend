import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { createClerkClient } from '@clerk/backend';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  /** clerkUserId = payload.sub from the JWT (e.g. user_2bX…) */
  async getProfile(clerkUserId: string) {
    this.logger.log(
      `Fetching profile for clerk user ${clerkUserId}`,
      UsersService.name,
    );
    let user = await this.prisma.user.findUnique({
      where: { clerkUserId },
      include: { barangay: true },
    });

    if (!user) {
      this.logger.log(
        `User ${clerkUserId} not found in database, syncing from Clerk...`,
        UsersService.name,
      );
      try {
        const clerk = createClerkClient({
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        const clerkUser = await clerk.users.getUser(clerkUserId);
        const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
        const name =
          `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
          null;

        user = await this.prisma.user.upsert({
          where: { clerkUserId },
          update: { name: name ?? undefined, email },
          create: { clerkUserId, email, ...(name ? { name } : {}) },
          include: { barangay: true },
        });
      } catch (err) {
        this.logger.warn(
          `Failed to auto-sync user ${clerkUserId} from Clerk: ${err}`,
          UsersService.name,
        );
        throw new NotFoundException('User profile not found');
      }
    }

    return user;
  }

  async updateProfile(
    clerkUserId: string,
    data: {
      firstName?: string;
      lastName?: string;
      birthday?: string;
      barangayId?: string;
    },
  ) {
    this.logger.log(
      `Updating profile for clerk user ${clerkUserId}`,
      UsersService.name,
    );

    const user = await this.getProfile(clerkUserId);

    const updateData: Record<string, unknown> = {};

    if (data.firstName !== undefined || data.lastName !== undefined) {
      const parts = (user.name || '').split(' ');
      const existingFirst = parts.length > 0 ? parts[0] : '';
      const existingLast = parts.length > 1 ? parts.slice(1).join(' ') : '';
      const first =
        data.firstName !== undefined ? data.firstName : existingFirst;
      const last = data.lastName !== undefined ? data.lastName : existingLast;
      updateData.name = `${first} ${last}`.trim();
    }

    if (data.birthday !== undefined)
      updateData.birthday = new Date(data.birthday);
    if (data.barangayId !== undefined) updateData.barangayId = data.barangayId;

    return this.prisma.user.update({
      where: { clerkUserId },
      data: updateData,
      include: { barangay: true },
    });
  }
}
