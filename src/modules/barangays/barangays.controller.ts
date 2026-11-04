import { Controller, Get } from '@nestjs/common';
import { BarangaysService } from './barangays.service';
import { Public } from '../../core/decorators/public.decorator';
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
}
