import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { LoggerService } from '../../core/logger/logger.service';

describe('NotificationsService', () => {
  const user = { findUnique: jest.fn() };
  const notification = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  };

  const prisma = {
    user,
    notification,
  };

  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const gateway = {
    broadcastNotification: jest.fn(),
  };

  const service = new NotificationsService(
    prisma as unknown as PrismaService,
    logger as unknown as LoggerService,
    gateway as any,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('findAll', () => {
    it('returns empty array if user has no assigned barangay', async () => {
      user.findUnique.mockResolvedValue({ barangayId: null });

      const result = await service.findAll('user_1', {
        offset: 0,
        limit: 50,
      });

      expect(result).toEqual([]);
      expect(notification.findMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if user is not in database', async () => {
      user.findUnique.mockResolvedValue(null);

      await expect(
        service.findAll('unknown_user', { offset: 0, limit: 50 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('queries notifications scoped to user barangay with unread filter', async () => {
      user.findUnique.mockResolvedValue({ barangayId: 'brgy_1' });
      const mockNotifications = [
        { id: 'notif_1', title: 'Alert 1', isRead: false },
      ];
      notification.findMany.mockResolvedValue(mockNotifications);

      const result = await service.findAll('user_1', {
        offset: 10,
        limit: 20,
        unreadOnly: true,
      });

      expect(notification.findMany).toHaveBeenCalledWith({
        where: {
          barangayId: 'brgy_1',
          isRead: false,
        },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 20,
      });
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('getUnreadCount', () => {
    it('returns 0 if user has no assigned barangay', async () => {
      user.findUnique.mockResolvedValue({ barangayId: null });

      const result = await service.getUnreadCount('user_1');

      expect(result).toEqual({ unreadCount: 0 });
      expect(notification.count).not.toHaveBeenCalled();
    });

    it('returns unread notification count for user barangay', async () => {
      user.findUnique.mockResolvedValue({ barangayId: 'brgy_1' });
      notification.count.mockResolvedValue(7);

      const result = await service.getUnreadCount('user_1');

      expect(notification.count).toHaveBeenCalledWith({
        where: {
          barangayId: 'brgy_1',
          isRead: false,
        },
      });
      expect(result).toEqual({ unreadCount: 7 });
    });
  });

  describe('markAsRead', () => {
    it('throws NotFoundException if user has no assigned barangay', async () => {
      user.findUnique.mockResolvedValue({ barangayId: null });

      await expect(
        service.markAsRead('user_1', 'notif_1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException if notification does not belong to barangay', async () => {
      user.findUnique.mockResolvedValue({ barangayId: 'brgy_1' });
      notification.findFirst.mockResolvedValue(null);

      await expect(
        service.markAsRead('user_1', 'notif_foreign'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(notification.update).not.toHaveBeenCalled();
    });

    it('marks notification as read when owned by barangay', async () => {
      user.findUnique.mockResolvedValue({ barangayId: 'brgy_1' });
      notification.findFirst.mockResolvedValue({
        id: 'notif_1',
        barangayId: 'brgy_1',
      });
      notification.update.mockResolvedValue({
        id: 'notif_1',
        isRead: true,
      });

      const result = await service.markAsRead('user_1', 'notif_1');

      expect(notification.update).toHaveBeenCalledWith({
        where: { id: 'notif_1' },
        data: expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
        }),
      });
      expect(result).toEqual({ success: true, id: 'notif_1' });
    });
  });

  describe('markAllAsRead', () => {
    it('returns count 0 if user has no assigned barangay', async () => {
      user.findUnique.mockResolvedValue({ barangayId: null });

      const result = await service.markAllAsRead('user_1');

      expect(result).toEqual({ success: true, count: 0 });
      expect(notification.updateMany).not.toHaveBeenCalled();
    });

    it('updates all unread notifications in user barangay', async () => {
      user.findUnique.mockResolvedValue({ barangayId: 'brgy_1' });
      notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user_1');

      expect(notification.updateMany).toHaveBeenCalledWith({
        where: {
          barangayId: 'brgy_1',
          isRead: false,
        },
        data: expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
        }),
      });
      expect(result).toEqual({ success: true, count: 5 });
    });
  });

  describe('create', () => {
    it('creates and returns a notification entity', async () => {
      const createdItem = {
        id: 'notif_new',
        barangayId: 'brgy_1',
        title: 'Blower Active',
        severity: 'info',
      };
      notification.create.mockResolvedValue(createdItem);

      const result = await service.create({
        barangayId: 'brgy_1',
        type: 'automation',
        title: 'Blower Active',
        message: 'Blower ran for 30s',
      });

      expect(notification.create).toHaveBeenCalledWith({
        data: {
          barangayId: 'brgy_1',
          machineId: null,
          batchId: null,
          userId: null,
          type: 'automation',
          severity: 'info',
          title: 'Blower Active',
          message: 'Blower ran for 30s',
          metadata: {},
        },
      });
      expect(result).toEqual(createdItem);
      expect(gateway.broadcastNotification).toHaveBeenCalledWith(
        'brgy_1',
        expect.objectContaining({
          id: 'notif_new',
          barangayId: 'brgy_1',
          title: 'Blower Active',
        }),
      );
    });
  });

  describe('createForUser', () => {
    it('throws BadRequestException if user has no assigned barangay', async () => {
      user.findUnique.mockResolvedValue({ barangayId: null });

      await expect(
        service.createForUser('user_1', {
          type: 'machine',
          severity: 'info',
          title: 'Test',
          message: 'Test message',
        }),
      ).rejects.toThrow('User has no assigned barangay');
    });

    it('creates notification and broadcasts when user has barangay', async () => {
      user.findUnique.mockResolvedValue({ barangayId: 'brgy_10' });
      const createdItem = {
        id: 'notif_user_1',
        barangayId: 'brgy_10',
        title: 'Manual Alert',
      };
      notification.create.mockResolvedValue(createdItem);

      const result = await service.createForUser('user_1', {
        type: 'system',
        severity: 'warning',
        title: 'Manual Alert',
        message: 'System maintenance scheduled',
      });

      expect(notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            barangayId: 'brgy_10',
            userId: 'user_1',
            title: 'Manual Alert',
          }),
        }),
      );
      expect(result).toEqual(createdItem);
    });
  });
});
