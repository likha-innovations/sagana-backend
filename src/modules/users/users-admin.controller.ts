import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminOnly } from '../../core/decorators/admin-only.decorator';
import { CurrentUserId } from '../../core/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateOperatorStatusDto } from './dto/update-operator-status.dto';
import {
  ApiErrorExample,
  profileExample,
  successExample,
} from '../../core/swagger/examples';

@ApiTags('Users')
@ApiErrorExample(500, 'Unexpected server error.', 'Internal server error')
@ApiBearerAuth()
@AdminOnly()
@Controller()
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

  @Patch('operators/:id/status')
  @ApiOperation({
    summary: '[Admin] Update operator status',
    description:
      'Updates the status of an operator in the admin’s assigned barangay (active or suspended).',
  })
  @ApiParam({
    name: 'id',
    description: 'Operator Clerk User ID',
    example: 'user_123',
  })
  @ApiBody({
    type: UpdateOperatorStatusDto,
    examples: {
      suspend: { value: { status: 'suspended' } },
      activate: { value: { status: 'active' } },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Operator status updated successfully.',
    content: {
      'application/json': { example: successExample(profileExample) },
    },
  })
  @ApiErrorExample(400, 'Validation failed.', 'Validation failed')
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
  @ApiErrorExample(
    404,
    'Operator not found in your barangay.',
    'Operator not found in your barangay',
  )
  updateOperatorStatus(
    @CurrentUserId() userId: string,
    @Param('id') operatorId: string,
    @Body() body: UpdateOperatorStatusDto,
  ) {
    return this.usersService.updateOperatorStatus(
      userId,
      operatorId,
      body.status,
    );
  }
}
