import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import type { RegisterMachineDto } from './dto/register-machine.dto';
import type { UpdateMachineDto } from './dto/update-machine.dto';

@Injectable()
export class MachinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    @Optional() private readonly mqttService?: MqttService,
  ) {}

  private async getBarangayId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { barangayId: true },
    });
    if (!user) {
      throw new NotFoundException('Authenticated user not found in database');
    }
    return user.barangayId;
  }

  async findAll(userId: string) {
    const barangayId = await this.getBarangayId(userId);
    if (!barangayId) return [];
    return this.prisma.machine.findMany({
      where: { barangayId, removedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(userId: string, id: string) {
    const barangayId = await this.getBarangayId(userId);
    const machine = barangayId
      ? await this.prisma.machine.findFirst({
          where: { id, barangayId, removedAt: null },
        })
      : null;
    if (!machine) throw new NotFoundException('Machine not found');
    return machine;
  }

  async update(userId: string, id: string, dto: UpdateMachineDto) {
    const machine = await this.findOne(userId, id);
    const data: { name?: string; wifiSsid?: string } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.wifi_ssid !== undefined) data.wifiSsid = dto.wifi_ssid;

    const updated = await this.prisma.machine.update({
      where: { id: machine.id },
      data,
    });

    if (dto.name !== undefined && machine.macAddress && this.mqttService) {
      await this.mqttService.publish(
        `sagana/devices/${machine.macAddress}/commands`,
        { action: 'SET_NAME', name: dto.name },
      );
    }

    this.logger.log(`Machine updated: id=${updated.id}`, MachinesService.name);
    return updated;
  }

  async remove(userId: string, id: string) {
    const machine = await this.findOne(userId, id);

    const removed = await this.prisma.machine.update({
      where: { id: machine.id },
      data: { removedAt: new Date(), status: 'inactive' },
    });

    this.logger.log(`Machine removed: id=${removed.id}`, MachinesService.name);
    return { success: true, message: 'Machine removed successfully' };
  }

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

    // 2. Check for duplicate MAC
    const existing = await this.prisma.machine.findUnique({
      where: { macAddress: dto.mac_address },
    });

    if (existing) {
      if (existing.barangayId !== user.barangayId) {
        throw new ConflictException(
          'This machine is already registered to a different barangay.',
        );
      }

      // Same barangay: device was re-provisioned (NVS wiped), restore credentials
      const machine = await this.prisma.machine.update({
        where: { macAddress: dto.mac_address },
        data: {
          name: dto.name,
          wifiSsid: dto.wifi_ssid,
          status: 'active',
          removedAt: null,
        },
      });

      this.logger.log(
        `Machine re-provisioned: id=${machine.id}`,
        MachinesService.name,
      );
      return machine;
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
