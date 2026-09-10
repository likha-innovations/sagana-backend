import { Controller, Get } from '@nestjs/common';
import { Public } from './core/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  getRoot() {
    return { status: 'ok', message: 'Sagana Backend API is running', uptime: process.uptime() };
  }

  @Public()
  @Get('health')
  getHealth() {
    return { status: 'ok', uptime: process.uptime() };
  }
}
