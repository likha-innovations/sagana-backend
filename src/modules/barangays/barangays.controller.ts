import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { BarangaysService } from './barangays.service';
import { Public } from '../../core/decorators/public.decorator';
import { AdminOnly } from '../../core/decorators/admin-only.decorator';
import { CurrentUserId } from '../../core/decorators/current-user.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Barangays')
@Controller('barangays')
export class BarangaysController {
  constructor(private readonly barangaysService: BarangaysService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List barangays',
    description:
      'Public list used for account registration and location selection.',
  })
  @ApiResponse({
    status: 200,
    description: 'Barangay IDs and names, sorted by name.',
  })
  findAll() {
    return this.barangaysService.findAll();
  }

  @Public()
  @Post('validate-code')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  validateCode(@Body() body: { code?: unknown }) {
    return this.barangaysService.validateCode(body?.code);
  }

  @AdminOnly()
  @Get('admin/code')
  getCode(@CurrentUserId() userId: string) {
    return this.barangaysService.getCode(userId);
  }

  @AdminOnly()
  @Post('admin/code/rotate')
  rotateCode(@CurrentUserId() userId: string) {
    return this.barangaysService.rotateCode(userId);
  }
}
