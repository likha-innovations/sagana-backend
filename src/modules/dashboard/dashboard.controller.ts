import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get aggregated dashboard metrics and charts' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard metrics retrieved successfully.',
  })
  getDashboardMetrics() {
    return this.dashboardService.getDashboardMetrics();
  }

  @Get('admin/dashboard')
  @ApiOperation({
    summary: 'Get aggregated dashboard metrics for admin portal',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin dashboard metrics retrieved successfully.',
  })
  getAdminDashboardMetrics() {
    return this.dashboardService.getDashboardMetrics();
  }
}
