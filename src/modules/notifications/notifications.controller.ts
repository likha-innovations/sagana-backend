import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { CurrentUserId } from '../../core/decorators/current-user.decorator';
import { ApiErrorExample } from '../../core/swagger/examples';

@ApiTags('Notifications')
@ApiErrorExample(500, 'Unexpected server error.', 'Internal server error')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @ApiOperation({
    summary: '[Shared] Create and broadcast notification',
    description:
      'Creates a notification in the user’s barangay and broadcasts it in real-time over WebSocket.',
  })
  @ApiResponse({
    status: 201,
    description: 'Notification created and broadcasted',
  })
  create(@CurrentUserId() userId: string, @Body() dto: CreateNotificationDto) {
    return this.notificationsService.createForUser(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: '[Shared] List notifications',
    description:
      'Returns paginated notifications for the operator’s assigned barangay. Returns empty list if no barangay assigned.',
  })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    type: Boolean,
    description: 'Filter only unread notifications',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of notifications to return (default 50, max 200)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of notifications to skip (default 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of notifications',
  })
  findAll(
    @CurrentUserId() userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findAll(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: '[Shared] Get unread notification count',
    description:
      'Returns the total count of unread notifications for the operator’s assigned barangay.',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread notification count',
    schema: {
      type: 'object',
      properties: {
        unreadCount: { type: 'number', example: 3 },
      },
    },
  })
  getUnreadCount(@CurrentUserId() userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: '[Shared] Mark single notification as read',
    description:
      'Marks a notification belonging to the operator’s barangay as read.',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    example: 'clx123abc456',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
  })
  markAsRead(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: '[Shared] Mark all notifications as read',
    description:
      'Marks all unread notifications in the operator’s barangay as read.',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
  })
  markAllAsRead(@CurrentUserId() userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }
}
