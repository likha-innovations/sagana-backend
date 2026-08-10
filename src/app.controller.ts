import { Controller, Get } from '@nestjs/common';
import { Public } from './core/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  getHello(): any {
    return { status: 'ok', uptime: process.uptime() };
  }
}
