import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async getProfile(userId: string) {
    this.logger.log(`Fetching profile for user ${userId}`, UsersService.name);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      this.logger.warn(
        `User ${userId} not found in database`,
        UsersService.name,
      );
      throw new NotFoundException('User profile not found');
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
