import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeedstocksService } from './feedstocks.service';
import { Public } from '../../core/decorators/public.decorator';

@ApiTags('Feedstocks')
@Controller('feedstocks')
export class FeedstocksController {
  constructor(private readonly feedstocksService: FeedstocksService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all active feedstocks' })
  @ApiResponse({
    status: 200,
    description: 'Active feedstocks list retrieved successfully.',
  })
  findAll() {
    return this.feedstocksService.findAll();
  }
}
