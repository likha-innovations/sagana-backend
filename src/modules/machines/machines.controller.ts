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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MachinesService } from './machines.service';
import {
  RegisterMachineSchema,
  type RegisterMachineDto,
} from './dto/register-machine.dto';
import { UpdateMachineSchema, UpdateMachineDto } from './dto/update-machine.dto';
import { CurrentUserId } from '../../core/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';

@ApiTags('Machines')
@ApiBearerAuth()
@Controller('machines')
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Get()
  @ApiOperation({
    summary: 'List non-removed machines in the authenticated user barangay',
  })
  @ApiResponse({
    status: 200,
    description:
      'Matching machines, or an empty list when no barangay is assigned.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'User profile not found.' })
  findAll(@CurrentUserId() userId: string) {
    return this.machinesService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a non-removed machine in the authenticated user barangay',
  })
  @ApiResponse({ status: 200, description: 'Machine found.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({
    status: 404,
    description: 'User or accessible machine not found.',
  })
  findOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.machinesService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update machine name or Wi-Fi SSID in the authenticated user barangay',
  })
  @ApiResponse({ status: 200, description: 'Machine updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Machine not found.' })
  update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMachineSchema)) dto: UpdateMachineDto,
  ) {
    return this.machinesService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-remove a machine in the authenticated user barangay',
  })
  @ApiResponse({ status: 200, description: 'Machine removed successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Machine not found.' })
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.machinesService.remove(userId, id);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new AIVSP machine to the operator barangay',
  })
  @ApiResponse({ status: 201, description: 'Machine registered successfully.' })
  @ApiResponse({ status: 409, description: 'MAC address already registered.' })
  async register(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(RegisterMachineSchema)) dto: RegisterMachineDto,
  ) {
    return this.machinesService.register(userId, dto);
  }
}
