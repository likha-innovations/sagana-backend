import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { BarangaysService } from './barangays.service';
import { Public } from '../../core/decorators/public.decorator';
import { AdminOnly } from '../../core/decorators/admin-only.decorator';
import { CurrentUserId } from '../../core/decorators/current-user.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiErrorExample,
  barangayCodeBody,
  barangayExample,
  successExample,
} from '../../core/swagger/examples';

@ApiTags('Barangays')
@ApiErrorExample(500, 'Unexpected server error.', 'Internal server error')
@Controller('barangays')
export class BarangaysController {
  constructor(private readonly barangaysService: BarangaysService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: '[Public] List barangays',
    description:
      'Public list used for account registration and location selection.',
  })
  @ApiResponse({
    status: 200,
    description: 'Barangay IDs and names, sorted by name.',
    content: {
      'application/json': { example: successExample([barangayExample]) },
    },
  })
  findAll() {
    return this.barangaysService.findAll();
  }

  @Public()
  @Post('validate-code')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: '[Public] Validate a barangay code',
    description:
      'Checks an active barangay code. Limited to 10 requests per minute.',
  })
  @ApiBody({ schema: barangayCodeBody })
  @ApiResponse({
    status: 201,
    description: 'Matching barangay.',
    content: {
      'application/json': { example: successExample(barangayExample) },
    },
  })
  @ApiErrorExample(400, 'Invalid or inactive code.', 'Invalid barangay code')
  @ApiErrorExample(
    429,
    'Rate limit exceeded.',
    'ThrottlerException: Too Many Requests',
  )
  validateCode(@Body() body: { code?: unknown }) {
    return this.barangaysService.validateCode(body?.code);
  }

  @AdminOnly()
  @Get('code')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Admin] Get barangay code',
    description:
      'Returns the code for the admin’s assigned barangay; the code can be null.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current barangay code.',
    content: {
      'application/json': { example: successExample({ code: 'ABC123' }) },
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
  getCode(@CurrentUserId() userId: string) {
    return this.barangaysService.getCode(userId);
  }

  @AdminOnly()
  @Post('code/rotate')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Admin] Rotate barangay code',
    description: 'Replaces the code for the admin’s assigned barangay.',
  })
  @ApiResponse({
    status: 201,
    description: 'New barangay code.',
    content: {
      'application/json': { example: successExample({ code: 'DEF456' }) },
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
  rotateCode(@CurrentUserId() userId: string) {
    return this.barangaysService.rotateCode(userId);
  }
}
