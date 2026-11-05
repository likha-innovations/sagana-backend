import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeedstocksService } from './feedstocks.service';
import { Public } from '../../core/decorators/public.decorator';
import { ApiErrorExample, successExample } from '../../core/swagger/examples';

@ApiTags('Feedstocks')
@ApiErrorExample(500, 'Unexpected server error.', 'Internal server error')
@Controller('feedstocks')
export class FeedstocksController {
  constructor(private readonly feedstocksService: FeedstocksService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: '[Public] List active feedstocks',
    description: 'Returns active feedstocks sorted by name.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active feedstocks list retrieved successfully.',
    content: {
      'application/json': {
        example: successExample([
          {
            id: 'feedstock123',
            name: 'Dry Leaves',
            category: 'brown',
            description: null,
            status: 'active',
          },
        ]),
      },
    },
  })
  findAll() {
    return this.feedstocksService.findAll();
  }
}
