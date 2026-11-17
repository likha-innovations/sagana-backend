import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import type { NotificationQueryDto } from './dto/notification-query.dto';
import type { CreateNotificationDto } from './dto/create-notification.dto';

export interface CreateNotificationInput {
  barangayId: string;
  machineId?: string | null;
  batchId?: string | null;
  userId?: string | null;
  type: string;
  severity?: string;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonObject;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    @Optional() private readonly telemetryGateway?: TelemetryGateway,
  ) {}

  private async getBarangayId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { barangayId: true },
    });
    if (!user) {
      throw new NotFoundException('Authenticated user not found in database');
    }
    return user.barangayId;
  }

  async findAll(userId: string, query: NotificationQueryDto) {
    const barangayId = await this.getBarangayId(userId);
    if (!barangayId) return [];

    return this.prisma.notification.findMany({
      where: {
        barangayId,
        ...(query.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: query.offset,
      take: query.limit,
    });
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const barangayId = await this.getBarangayId(userId);
    if (!barangayId) return { unreadCount: 0 };

    const unreadCount = await this.prisma.notification.count({
      where: {
        barangayId,
        isRead: false,
      },
    });

    return { unreadCount };
  }

  async markAsRead(
    userId: string,
    id: string,
  ): Promise<{ success: boolean; id: string }> {
    const barangayId = await this.getBarangayId(userId);
    if (!barangayId) {
      throw new NotFoundException('Notification not found');
    }

    const notification = await this.prisma.notification.findFirst({
      where: { id, barangayId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true, id };
  }

  async markAllAsRead(
    userId: string,
  ): Promise<{ success: boolean; count: number }> {
    const barangayId = await this.getBarangayId(userId);
    if (!barangayId) return { success: true, count: 0 };

    // ponytail: native Prisma updateMany avoids looping over individual records
    const result = await this.prisma.notification.updateMany({
      where: {
        barangayId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true, count: result.count };
  }

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        barangayId: input.barangayId,
        machineId: input.machineId ?? null,
        batchId: input.batchId ?? null,
        userId: input.userId ?? null,
        type: input.type,
        severity: input.severity ?? 'info',
        title: input.title,
        message: input.message,
        metadata: input.metadata ?? {},
      },
    });

    this.logger.log(
      `🔔 [Notification Created] ID=${notification.id} Barangay=${input.barangayId} Severity=${notification.severity}: ${notification.title}`,
      NotificationsService.name,
    );

    // Broadcast over WebSocket to barangay room
    if (this.telemetryGateway) {
      this.telemetryGateway.broadcastNotification(input.barangayId, {
        id: notification.id,
        barangayId: notification.barangayId,
        machineId: notification.machineId,
        batchId: notification.batchId,
        userId: notification.userId,
        type: notification.type,
        severity: notification.severity,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata as Record<string, unknown> | null,
        isRead: notification.isRead,
        readAt: notification.readAt
          ? new Date(notification.readAt).toISOString()
          : null,
        createdAt: (notification.createdAt
          ? new Date(notification.createdAt)
          : new Date()
        ).toISOString(),
      });
    }

    return notification;
  }

  async createForUser(userId: string, dto: CreateNotificationDto) {
    const barangayId = await this.getBarangayId(userId);
    if (!barangayId) {
      throw new BadRequestException(
        'User has no assigned barangay to broadcast notifications to',
      );
    }

    return this.create({
      barangayId,
      machineId: dto.machineId,
      batchId: dto.batchId,
      userId,
      type: dto.type,
      severity: dto.severity,
      title: dto.title,
      message: dto.message,
      metadata: (dto.metadata as Prisma.InputJsonObject) ?? {},
    });
  }
}
