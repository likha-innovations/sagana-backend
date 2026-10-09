import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MachinesService } from './machines.service';
import { RegisterMachineSchema } from './dto/register-machine.dto';
import type { RegisterMachineDto } from './dto/register-machine.dto';
import { CurrentUserId } from '../../core/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';

@ApiTags('Machines')
@ApiBearerAuth()
@Controller('machines')
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

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
