import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import { createClerkClient } from '@clerk/backend';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    @Optional() private readonly telemetryGateway?: TelemetryGateway,
  ) {}

  async getProfile(userId: string) {
    this.logger.log(`Fetching profile for user ${userId}`, UsersService.name);
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { barangay: true },
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

        const rawBarangay = (publicMetadata.barangay ||
          unsafeMetadata.barangay) as string | null;
        const barangayId = rawBarangay?.trim() ? rawBarangay.trim() : null;

        const role = (publicMetadata.role ||
          unsafeMetadata.role ||
          'operator') as string;
        const status = (publicMetadata.status ||
          unsafeMetadata.status ||
          'active') as string;

        user = await this.prisma.user.upsert({
          where: { id: userId },
          update: {
            fullName,
            email,
            birthday,
            barangayId,
            role,
            status,
          },
          create: {
            id: userId,
            fullName,
            email,
            birthday,
            barangayId,
            role,
            status,
          },
          include: { barangay: true },
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

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { barangay: true },
    });
    this.telemetryGateway?.broadcastDashboardUpdate();
    return updated;
  }

  async updateOperatorStatus(id: string, status: string) {
    this.logger.log(
      `Updating operator ${id} status to ${status}`,
      UsersService.name,
    );
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
      include: { barangay: true },
    });
    this.telemetryGateway?.broadcastDashboardUpdate();
    return updated;
  }

  async deleteOperator(id: string) {
    this.logger.log(`Deleting operator ${id}`, UsersService.name);
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { batches: true },
    });
    if (!user) {
      throw new NotFoundException(`Operator with ID ${id} not found`);
    }

    if (user.batches && user.batches.length > 0) {
      await this.prisma.user.update({
        where: { id },
        data: { status: 'deleted' },
      });
    } else {
      await this.prisma.user.delete({
        where: { id },
      });
    }
    this.telemetryGateway?.broadcastDashboardUpdate();
    return { success: true, message: 'Operator deleted successfully' };
  }

  getOperators() {
    return this.prisma.user.findMany({
      where: { role: 'operator' },
      include: { barangay: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private readonly passwordOtpStore = new Map<
    string,
    { code: string; expiresAt: number }
  >();

  async sendPasswordResetOtp(userId: string) {
    this.logger.log(
      `Requesting password reset OTP for user ${userId}`,
      UsersService.name,
    );
    const user = await this.getProfile(userId);
    if (!user.email) {
      throw new BadRequestException(
        'User does not have an associated email address',
      );
    }

    // Generate secure 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    this.passwordOtpStore.set(userId, { code, expiresAt });
    this.logger.log(
      `[PASSWORD RESET OTP] Generated OTP for user ${userId} (${user.email}): ${code}`,
      UsersService.name,
    );

    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Sagana <onboarding@resend.dev>',
            to: [user.email],
            subject: 'Sagana Password Reset Code',
            html: `<div style="font-family: sans-serif; padding: 24px; color: #414141;">
              <h2 style="color: #566811; margin-bottom: 8px;">Reset Your Password</h2>
              <p style="font-size: 14px; margin-bottom: 16px;">We received a request to change the password for your Sagana account.</p>
              <p style="font-size: 14px; margin-bottom: 8px;">Your 6-digit verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #566811; padding: 12px 20px; background: #F2F1EA; border-radius: 8px; display: inline-block; margin-bottom: 16px;">${code}</div>
              <p style="font-size: 12px; color: #7C7D74;">This code expires in 10 minutes. If you did not request this, you can safely ignore this email.</p>
            </div>`,
          }),
        });
      } catch (err) {
        this.logger.warn(
          `Failed to dispatch email via Resend: ${err}`,
          UsersService.name,
        );
      }
    }

    return {
      success: true,
      message: 'Verification code sent',
      email: user.email,
      debugCode: process.env.NODE_ENV !== 'production' ? code : undefined,
    };
  }

  verifyPasswordResetOtp(userId: string, code: string) {
    const record = this.passwordOtpStore.get(userId);
    if (!record || record.expiresAt < Date.now()) {
      throw new BadRequestException(
        'Verification code has expired or is invalid. Please request a new code.',
      );
    }
    if (record.code !== code.trim()) {
      throw new BadRequestException('Invalid verification code.');
    }
    return { success: true, valid: true };
  }

  async changePassword(userId: string, code: string, newPassword: string) {
    const record = this.passwordOtpStore.get(userId);
    if (!record || record.expiresAt < Date.now()) {
      throw new BadRequestException(
        'Verification code has expired or is invalid. Please request a new code.',
      );
    }
    if (record.code !== code.trim()) {
      throw new BadRequestException('Invalid verification code.');
    }

    this.logger.log(
      `Changing password for user ${userId} via Clerk`,
      UsersService.name,
    );

    try {
      const clerk = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      await clerk.users.updateUser(userId, {
        password: newPassword,
      });

      this.passwordOtpStore.delete(userId);
      this.logger.log(
        `Successfully updated password for user ${userId}`,
        UsersService.name,
      );

      return { success: true, message: 'Password changed successfully' };
    } catch (err: unknown) {
      const clerkErr = err as {
        errors?: { longMessage?: string; message?: string }[];
        message?: string;
      };
      const message =
        clerkErr?.errors?.[0]?.longMessage ||
        clerkErr?.errors?.[0]?.message ||
        clerkErr?.message ||
        'Failed to update password';
      this.logger.error(
        `Clerk password update failed for user ${userId}: ${message}`,
        UsersService.name,
      );
      throw new BadRequestException(message);
    }
  }

  async sendPublicForgotPasswordOtp(email: string) {
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Please provide a valid email address.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    this.logger.log(
      `Public forgot-password OTP requested for ${normalizedEmail}`,
      UsersService.name,
    );

    let userId: string | null = null;
    const dbUser = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (dbUser) {
      userId = dbUser.id;
    } else if (process.env.CLERK_SECRET_KEY) {
      try {
        const clerk = createClerkClient({
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        const list = await clerk.users.getUserList({
          emailAddress: [normalizedEmail],
        });
        if (list.data?.length > 0) {
          userId = list.data[0].id;
        }
      } catch {
        // Continue with email-based key for dev testing
      }
    }

    const key = userId || `email:${normalizedEmail}`;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    this.passwordOtpStore.set(key, { code, expiresAt });
    this.logger.log(
      `[PUBLIC FORGOT PASSWORD OTP] Generated OTP for ${normalizedEmail}: ${code}`,
      UsersService.name,
    );

    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Sagana <onboarding@resend.dev>',
            to: [normalizedEmail],
            subject: 'Sagana Password Reset Code',
            html: `<div style="font-family: sans-serif; padding: 24px; color: #414141;">
              <h2 style="color: #566811; margin-bottom: 8px;">Reset Your Password</h2>
              <p style="font-size: 14px; margin-bottom: 16px;">We received a request to change the password for your Sagana account.</p>
              <p style="font-size: 14px; margin-bottom: 8px;">Your 6-digit verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #566811; padding: 12px 20px; background: #F2F1EA; border-radius: 8px; display: inline-block; margin-bottom: 16px;">${code}</div>
              <p style="font-size: 12px; color: #7C7D74;">This code expires in 10 minutes. If you did not request this, you can safely ignore this email.</p>
            </div>`,
          }),
        });
      } catch (err) {
        this.logger.warn(
          `Failed to dispatch email via Resend: ${err}`,
          UsersService.name,
        );
      }
    }

    return {
      success: true,
      message: 'Verification code sent',
      email: normalizedEmail,
      debugCode: process.env.NODE_ENV !== 'production' ? code : undefined,
    };
  }

  async verifyPublicForgotPasswordOtp(email: string, code: string) {
    if (!email || !code) {
      throw new BadRequestException(
        'Email and verification code are required.',
      );
    }
    const normalizedEmail = email.trim().toLowerCase();
    const dbUser = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    const key = dbUser?.id || `email:${normalizedEmail}`;
    const record = this.passwordOtpStore.get(key);

    if (!record || record.expiresAt < Date.now()) {
      throw new BadRequestException(
        'Verification code has expired or is invalid. Please request a new code.',
      );
    }
    if (record.code !== code.trim()) {
      throw new BadRequestException('Incorrect one-time code');
    }

    return { success: true, valid: true };
  }

  async resetPublicForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ) {
    if (!email || !code || !newPassword) {
      throw new BadRequestException('All fields are required.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    const dbUser = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    let userId = dbUser?.id;
    if (!userId && process.env.CLERK_SECRET_KEY) {
      try {
        const clerk = createClerkClient({
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        const list = await clerk.users.getUserList({
          emailAddress: [normalizedEmail],
        });
        if (list.data?.length > 0) {
          userId = list.data[0].id;
        }
      } catch {
        // Continue
      }
    }

    const key = userId || `email:${normalizedEmail}`;
    const record = this.passwordOtpStore.get(key);

    if (!record || record.expiresAt < Date.now()) {
      throw new BadRequestException(
        'Verification code has expired or is invalid. Please request a new code.',
      );
    }
    if (record.code !== code.trim()) {
      throw new BadRequestException('Incorrect one-time code');
    }

    if (userId && process.env.CLERK_SECRET_KEY) {
      try {
        const clerk = createClerkClient({
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        await clerk.users.updateUser(userId, { password: newPassword });
      } catch (err: unknown) {
        const clerkErr = err as {
          errors?: { longMessage?: string; message?: string }[];
          message?: string;
        };
        const message =
          clerkErr?.errors?.[0]?.longMessage ||
          clerkErr?.errors?.[0]?.message ||
          clerkErr?.message ||
          'Failed to update password in authentication service';
        throw new BadRequestException(message);
      }
    }

    this.passwordOtpStore.delete(key);
    this.logger.log(
      `Password reset completed successfully for ${normalizedEmail}`,
      UsersService.name,
    );
    return { success: true, message: 'Password reset successfully' };
  }
}
