import {
  Body,
  Controller,
  Get,
  Param,
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
