import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MachinesService } from './machines.service';
import { RegisterMachineDto } from './dto/register-machine.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';
import { AutomationLogsQueryDto } from './dto/automation-logs-query.dto';
import { CurrentUserId } from '../../core/decorators/current-user.decorator';
import {
  ApiErrorExample,
  machineExample,
  successExample,
} from '../../core/swagger/examples';

@ApiTags('Machines')
@ApiErrorExample(500, 'Unexpected server error.', 'Internal server error')
@ApiBearerAuth()
@Controller('machines')
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Get()
  @ApiOperation({
    summary: '[Shared] List barangay machines',
    description:
      'Returns non-removed machines in the current user’s barangay. Returns an empty list when no barangay is assigned.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Matching machines, or an empty list when no barangay is assigned.',
    content: {
      'application/json': { example: successExample([machineExample]) },
    },
  })
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User profile not found.',
    'Authenticated user not found in database',
  )
  findAll(@CurrentUserId() userId: string) {
    return this.machinesService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '[Shared] Get a machine',
    description:
      'Returns a non-removed machine in the current user’s barangay.',
  })
  @ApiParam({ name: 'id', description: 'Machine ID', example: 'machine123' })
  @ApiResponse({
    status: 200,
    description: 'Machine found.',
    content: {
      'application/json': { example: successExample(machineExample) },
    },
  })
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User or accessible machine not found.',
    'Machine not found',
  )
  findOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.machinesService.findOne(userId, id);
  }

  @Get(':id/overview')
  @ApiOperation({
    summary: '[Shared] Get machine overview and live automation state',
    description:
      'Returns current active batch details and live automation targets (aeration and sprinkler status).',
  })
  @ApiParam({ name: 'id', description: 'Machine ID', example: 'machine123' })
  @ApiResponse({
    status: 200,
    description: 'Machine overview returned.',
    content: {
      'application/json': {
        example: successExample({
          machineId: 'machine123',
          batchId: 'batch123',
          currentWeight: 32.5,
          recordedAt: '2026-11-12T14:00:00.000Z',
          automations: [
            { kind: 'aeration', enabled: true, until: '6:07' },
            { kind: 'sprinkler', enabled: false, until: '45%' },
          ],
        }),
      },
    },
  })
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User or accessible machine not found.',
    'Machine not found',
  )
  getOverview(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.machinesService.getOverview(userId, id);
  }

  @Get(':id/automation-logs')
  @ApiOperation({
    summary: '[Shared] Get machine automation logs',
    description:
      'Returns historical automation and actuator events (blower, sprinkler, emergency stop) for a machine.',
  })
  @ApiParam({ name: 'id', description: 'Machine ID', example: 'machine123' })
  @ApiResponse({
    status: 200,
    description: 'Automation logs returned.',
    content: {
      'application/json': {
        example: successExample([
          {
            id: 'log123',
            machineId: 'machine123',
            batchId: 'batch123',
            type: 'blower_on',
            message:
              'The air blower has been turned on and will be running for 5 minutes.',
            metadata: { durationMinutes: 5 },
            createdAt: '2026-11-12T14:00:00.000Z',
          },
        ]),
      },
    },
  })
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User or accessible machine not found.',
    'Machine not found',
  )
  getAutomationLogs(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Query() query: AutomationLogsQueryDto,
  ) {
    return this.machinesService.getAutomationLogs(userId, id, query);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '[Shared] Update a machine',
    description:
      'Updates a non-removed machine in the user’s barangay. Supply at least one field; a name change also sends an MQTT command when MQTT is available.',
  })
  @ApiParam({ name: 'id', description: 'Machine ID', example: 'machine123' })
  @ApiBody({
    type: UpdateMachineDto,
    examples: {
      update: { value: { name: 'Composter 1', wifiSsid: 'SaganaNet' } },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Updated machine.',
    content: {
      'application/json': { example: successExample(machineExample) },
    },
  })
  @ApiErrorExample(
    400,
    'Invalid or empty update.',
    'At least one field (name or wifiSsid) must be provided',
  )
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User or accessible machine not found.',
    'Machine not found',
  )
  update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMachineDto,
  ) {
    return this.machinesService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '[Shared] Remove a machine',
    description:
      'Soft-removes a non-removed machine in the user’s barangay and marks it inactive.',
  })
  @ApiParam({ name: 'id', description: 'Machine ID', example: 'machine123' })
  @ApiResponse({
    status: 200,
    description: 'Machine removed.',
    content: {
      'application/json': {
        example: successExample({
          success: true,
          message: 'Machine removed successfully',
        }),
      },
    },
  })
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User or accessible machine not found.',
    'Machine not found',
  )
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.machinesService.remove(userId, id);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Shared] Register a machine',
    description:
      'Registers a machine to the user’s barangay. An existing device in that barangay is re-provisioned; a device assigned to another barangay causes a conflict.',
  })
  @ApiBody({
    type: RegisterMachineDto,
    examples: {
      register: {
        value: {
          name: 'Composter 1',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          wifiSsid: 'SaganaNet',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Machine registered or re-provisioned.',
    content: {
      'application/json': { example: successExample(machineExample) },
    },
  })
  @ApiErrorExample(
    400,
    'Invalid machine fields.',
    'Invalid MAC address or device identifier format',
  )
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User or barangay assignment not found.',
    'User is not associated with a barangay. Contact your administrator.',
  )
  @ApiErrorExample(
    409,
    'Device belongs to another barangay.',
    'This machine is already registered to a different barangay.',
  )
  async register(
    @CurrentUserId() userId: string,
    @Body() dto: RegisterMachineDto,
  ) {
    return this.machinesService.register(userId, dto);
  }
}
