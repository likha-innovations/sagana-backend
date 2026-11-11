import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { CurrentUserId } from '../../core/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  ApiErrorExample,
  barangayCodeBody,
  barangayExample,
  profileExample,
  successExample,
} from '../../core/swagger/examples';

@ApiTags('Profile')
@ApiErrorExample(500, 'Unexpected server error.', 'Internal server error')
@ApiBearerAuth()
@Controller()
export class UsersOperatorController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: '[Shared] Get current profile',
    description:
      'Returns the current user profile, syncing it from Clerk if needed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user profile.',
    content: {
      'application/json': { example: successExample(profileExample) },
    },
  })
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User profile could not be retrieved.',
    'User profile not found',
  )
  getProfile(@CurrentUserId() userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @ApiOperation({
    summary: '[Shared] Update current profile',
    description:
      'Updates supplied profile fields. First and last names must each contain at least two characters.',
  })
  @ApiBody({
    type: UpdateProfileDto,
    examples: {
      update: {
        summary: 'Update a name',
        value: { firstName: 'Juan', lastName: 'Dela Cruz' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Updated profile.',
    content: {
      'application/json': { example: successExample(profileExample) },
    },
  })
  @ApiErrorExample(400, 'Invalid profile fields.', 'Validation failed')
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(404, 'User profile not found.', 'User profile not found')
  updateProfile(
    @CurrentUserId() userId: string,
    @Body() data: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, data);
  }

  @Post('me/barangay-code')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: '[Shared] Join a barangay',
    description:
      'Assigns an active barangay using its code. Reusing the same barangay code succeeds; changing an assigned barangay returns a conflict. Limited to 10 requests per minute.',
  })
  @ApiBody({ schema: barangayCodeBody })
  @ApiResponse({
    status: 201,
    description: 'Assigned barangay.',
    content: {
      'application/json': { example: successExample(barangayExample) },
    },
  })
  @ApiErrorExample(400, 'Invalid or inactive code.', 'Invalid barangay code')
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(404, 'User profile not found.', 'User profile not found')
  @ApiErrorExample(
    409,
    'A different barangay is already assigned.',
    'Barangay already assigned',
  )
  @ApiErrorExample(
    429,
    'Rate limit exceeded.',
    'ThrottlerException: Too Many Requests',
  )
  assignBarangay(
    @CurrentUserId() userId: string,
    @Body() body: { code?: unknown },
  ) {
    return this.usersService.assignBarangay(userId, body?.code);
  }
}
