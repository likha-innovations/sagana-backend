import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UsePipes,
} from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { ZodValidationPipe } from 'nestjs-zod';
import { PublishCommandDto } from './dto/publish-command.dto';
import { TelemetryQueryDto } from './dto/telemetry-query.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Telemetry & IoT')
@ApiBearerAuth()
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Get('readings')
  @ApiOperation({ summary: 'Get historical sensor telemetry readings' })
  @ApiResponse({
    status: 200,
    description: 'Telemetry readings retrieved successfully.',
  })
  @UsePipes(ZodValidationPipe)
  getReadings(@Query() query: TelemetryQueryDto) {
    return this.telemetryService.getReadings(query);
  }

  @Get('devices/:deviceId/latest')
  @ApiOperation({ summary: 'Get latest sensor readings for a device' })
  @ApiParam({ name: 'deviceId', description: 'IoT Device ID' })
  @ApiResponse({
    status: 200,
    description: 'Latest device readings retrieved successfully.',
  })
  getLatestByDevice(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getLatestByDevice(deviceId);
  }

  @Post('devices/:deviceId/command')
  @ApiOperation({ summary: 'Send an MQTT command down to an IoT device' })
  @ApiParam({ name: 'deviceId', description: 'IoT Device ID' })
  @ApiResponse({
    status: 200,
    description: 'Command dispatched to MQTT broker successfully.',
  })
  @UsePipes(ZodValidationPipe)
  sendCommand(
    @Param('deviceId') deviceId: string,
    @Body() command: PublishCommandDto,
  ) {
    return this.telemetryService.sendCommandToDevice(deviceId, command);
  }
}
