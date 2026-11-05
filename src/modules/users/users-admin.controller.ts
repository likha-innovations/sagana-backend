import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminOnly } from '../../core/decorators/admin-only.decorator';
import { CurrentUserId } from '../../core/decorators/current-user.decorator';
import { UsersService } from './users.service';

@ApiTags('Admin')
@ApiBearerAuth()
@AdminOnly()
@Controller('admin')
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get('operators')
  @ApiOperation({ summary: 'Fetch operator accounts in the admin barangay' })
  @ApiResponse({
    status: 200,
    description: 'Operators retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({
    status: 403,
    description: 'Admin access and barangay assignment required.',
  })
  getOperators(@CurrentUserId() userId: string) {
    return this.usersService.getOperators(userId);
  }
}
