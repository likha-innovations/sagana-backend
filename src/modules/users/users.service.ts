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

  async getProfile(userId: string) {
    this.logger.log(`Fetching profile for user ${userId}`, UsersService.name);
    let user = await this.prisma.user.findUnique({ where: { id: userId } });

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
        const fullName =
          `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
          null;
        const contactNumber =
          clerkUser.phoneNumbers?.[0]?.phoneNumber || null;

        user = await this.prisma.user.upsert({
          where: { id: userId },
          update: { fullName, email, contactNumber },
          create: {
            id: userId,
            fullName,
            email,
            contactNumber,
            location: null,
          },
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
    data: { fullName?: string; contactNumber?: string; location?: string },
  ) {
    this.logger.log(`Updating profile for user ${userId}`, UsersService.name);

    // Ensure user exists before updating
    await this.getProfile(userId);

    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
