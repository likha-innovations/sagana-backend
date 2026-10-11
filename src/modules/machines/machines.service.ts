import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { RegisterMachineDto } from './dto/register-machine.dto';

@Injectable()
export class MachinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async register(userId: string, dto: RegisterMachineDto) {
    this.logger.log(
      `User ${userId} registering machine MAC=${dto.mac_address}`,
      MachinesService.name,
    );

    // 1. Look up user's barangay_id
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { barangayId: true },
    });

    if (!user) {
      throw new NotFoundException('Authenticated user not found in database');
    }

    if (!user.barangayId) {
      throw new NotFoundException(
        'User is not associated with a barangay. Contact your administrator.',
      );
    }

    // 2. Check for duplicate MAC address
    const existing = await this.prisma.machine.findUnique({
      where: { macAddress: dto.mac_address },
    });

    if (existing) {
      throw new ConflictException(
        'This MAC address is already registered to an existing machine.',
      );
    }

    // 3. Create the machine
    const machine = await this.prisma.machine.create({
      data: {
        barangayId: user.barangayId,
        macAddress: dto.mac_address,
        name: dto.name,
        wifiSsid: dto.wifi_ssid,
        status: 'active',
      },
    });

    this.logger.log(
      `Machine registered: id=${machine.id}`,
      MachinesService.name,
    );

    return machine;
  }
}
