import { Controller, Get } from '@nestjs/common';
import { Public } from './core/decorators/public.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorExample, successExample } from './core/swagger/examples';

@ApiTags('System')
@ApiErrorExample(500, 'Unexpected server error.', 'Internal server error')
@Controller()
export class AppController {
  @Public()
  @Get()
  @ApiOperation({
    summary: '[Public] API status',
    description: 'Returns the API status and process uptime in seconds.',
  })
  @ApiResponse({
    status: 200,
    description: 'API status.',
    content: {
      'application/json': {
        example: successExample({
          status: 'ok',
          message: 'Sagana Backend API is running',
          uptime: 123.45,
        }),
      },
    },
  })
  getRoot() {
    return {
      status: 'ok',
      message: 'Sagana Backend API is running',
      uptime: process.uptime(),
    };
  }

  @Public()
  @Get('health')
  @ApiOperation({
    summary: '[Public] Health check',
    description: 'Returns the process status and uptime in seconds.',
  })
  @ApiResponse({
    status: 200,
    description: 'Process status.',
    content: {
      'application/json': {
        example: successExample({ status: 'ok', uptime: 123.45 }),
      },
    },
  })
  getHealth() {
    return { status: 'ok', uptime: process.uptime() };
  }
}
