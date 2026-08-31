import { Controller, Post, Body, Param, UsePipes } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { ZodValidationPipe } from 'nestjs-zod';
import { PublishCommandDto } from './dto/publish-command.dto';
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
