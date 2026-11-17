import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationQuerySchema } from './dto/notification-query.dto';

describe('NotificationsController', () => {
  const service = {
    findAll: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    createForUser: jest.fn(),
  };

  const controller = new NotificationsController(
    service as unknown as NotificationsService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('delegates findAll with user id and query dto', async () => {
    service.findAll.mockResolvedValue([]);
    const query = { limit: 20, offset: 0, unreadOnly: true };

    const result = await controller.findAll('user_123', query);

    expect(service.findAll).toHaveBeenCalledWith('user_123', query);
    expect(result).toEqual([]);
  });

  it('delegates getUnreadCount with user id', async () => {
    service.getUnreadCount.mockResolvedValue({ unreadCount: 5 });

    const result = await controller.getUnreadCount('user_123');

    expect(service.getUnreadCount).toHaveBeenCalledWith('user_123');
    expect(result).toEqual({ unreadCount: 5 });
  });

  it('delegates markAsRead with user id and notification id', async () => {
    service.markAsRead.mockResolvedValue({ success: true, id: 'notif_1' });

    const result = await controller.markAsRead('user_123', 'notif_1');

    expect(service.markAsRead).toHaveBeenCalledWith('user_123', 'notif_1');
    expect(result).toEqual({ success: true, id: 'notif_1' });
  });

  it('delegates markAllAsRead with user id', async () => {
    service.markAllAsRead.mockResolvedValue({ success: true, count: 4 });

    const result = await controller.markAllAsRead('user_123');

    expect(service.markAllAsRead).toHaveBeenCalledWith('user_123');
    expect(result).toEqual({ success: true, count: 4 });
  });

  it('delegates create with user id and dto', async () => {
    const dto = {
      type: 'machine' as const,
      severity: 'warning' as const,
      title: 'Alert',
      message: 'Body',
    };
    const created = { id: 'notif_new', ...dto };
    service.createForUser.mockResolvedValue(created);

    const result = await controller.create('user_123', dto);

    expect(service.createForUser).toHaveBeenCalledWith('user_123', dto);
    expect(result).toEqual(created);
  });

  it('correctly parses valid NotificationQuerySchema inputs', () => {
    const parsed1 = NotificationQuerySchema.parse({
      unreadOnly: 'true',
      limit: '25',
      offset: '50',
    });
    expect(parsed1).toEqual({
      unreadOnly: true,
      limit: 25,
      offset: 50,
    });

    const parsed2 = NotificationQuerySchema.parse({});
    expect(parsed2).toEqual({
      limit: 50,
      offset: 0,
    });
  });

  it('rejects invalid limit or offset in NotificationQuerySchema', () => {
    expect(NotificationQuerySchema.safeParse({ limit: -1 }).success).toBe(
      false,
    );
    expect(NotificationQuerySchema.safeParse({ limit: 500 }).success).toBe(
      false,
    );
    expect(NotificationQuerySchema.safeParse({ offset: -1 }).success).toBe(
      false,
    );
  });
});
