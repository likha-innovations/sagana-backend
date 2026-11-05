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
import {
  ApiErrorExample,
  profileExample,
  successExample,
} from '../../core/swagger/examples';

@ApiTags('Users')
@ApiErrorExample(500, 'Unexpected server error.', 'Internal server error')
@ApiBearerAuth()
@AdminOnly()
@Controller('admin')
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get('operators')
  @ApiOperation({
    summary: '[Admin] List barangay operators',
    description:
      'Returns operator profiles in the admin’s assigned barangay, newest first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Operators retrieved successfully.',
    content: {
      'application/json': { example: successExample([profileExample]) },
    },
  })
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    403,
    'Admin access and barangay assignment required.',
    'Admin access required',
  )
  getOperators(@CurrentUserId() userId: string) {
    return this.usersService.getOperators(userId);
  }
}
