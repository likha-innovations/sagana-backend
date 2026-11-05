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
  ApiBody,
} from '@nestjs/swagger';
import { ApiErrorExample, successExample } from '../../core/swagger/examples';

@ApiTags('Telemetry')
@ApiErrorExample(500, 'Unexpected server error.', 'Internal server error')
@ApiBearerAuth()
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('devices/:deviceId/command')
  @ApiOperation({
    summary: '[Shared] Send a device command',
    description:
      'Publishes the supplied action and optional payload to the MQTT command topic. Success indicates dispatch to the broker, not confirmation from the device. Any valid Clerk token can call this endpoint; it does not check device ownership or barangay.',
  })
  @ApiBody({
    type: PublishCommandDto,
    examples: { command: { value: { action: 'restart', payload: {} } } },
  })
  @ApiParam({
    name: 'deviceId',
    description: 'Device MAC address used in its MQTT topic.',
  })
  @ApiResponse({
    status: 201,
    description: 'Command dispatched to MQTT broker successfully.',
    content: {
      'application/json': {
        example: successExample({
          success: true,
          macAddress: 'AA:BB:CC:DD:EE:FF',
          action: 'restart',
          timestamp: '2026-10-10T00:00:00.000Z',
        }),
      },
    },
  })
  @ApiErrorExample(400, 'Invalid command.', 'Validation failed')
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @UsePipes(ZodValidationPipe)
  sendCommand(
    @Param('deviceId') deviceId: string,
    @Body() command: PublishCommandDto,
  ) {
    return this.telemetryService.sendCommandToDevice(deviceId, command);
  }
}
