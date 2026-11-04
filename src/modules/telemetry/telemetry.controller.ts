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
  @ApiOperation({
    summary: 'Publish a device command',
    description:
      'Publishes the supplied action and optional payload to the MQTT command topic. Success indicates dispatch to the broker, not confirmation from the device.',
  })
  @ApiParam({
    name: 'deviceId',
    description: 'Device MAC address used in its MQTT topic.',
  })
  @ApiResponse({
    status: 201,
    description: 'Command dispatched to MQTT broker successfully.',
  })
  @ApiResponse({ status: 400, description: 'Invalid command.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @UsePipes(ZodValidationPipe)
  sendCommand(
    @Param('deviceId') deviceId: string,
    @Body() command: PublishCommandDto,
  ) {
    return this.telemetryService.sendCommandToDevice(deviceId, command);
  }
}
