import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
import { LoggerService } from '../../core/logger/logger.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TelemetryGateway } from './telemetry.gateway';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let mqttService: any;
  let gateway: any;

  beforeEach(async () => {
    mqttService = {
      onMessage: jest.fn(),
      publish: jest.fn().mockResolvedValue(undefined),
    };

    gateway = {
      broadcastTelemetry: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        {
          provide: MqttService,
          useValue: mqttService,
        },
        {
          provide: PrismaService,
          useValue: {
            machine: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            telemetryLog: {
              create: jest.fn(),
            },
            automationLog: {
              create: jest.fn().mockImplementation(({ data }) =>
                Promise.resolve({
                  id: 'log_1',
                  createdAt: new Date(),
                  ...data,
                }),
              ),
            },
            notification: {
              create: jest.fn().mockImplementation(({ data }) =>
                Promise.resolve({
                  id: 'notif_1',
                  isRead: false,
                  readAt: null,
                  createdAt: new Date(),
                  ...data,
                }),
              ),
            },
          },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
        {
          provide: TelemetryGateway,
          useValue: {
            broadcastTelemetry: jest.fn(),
            broadcastStatus: jest.fn(),
            broadcastAutomationLog: jest.fn(),
            broadcastNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
    gateway = module.get<TelemetryGateway>(TelemetryGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register onMessage listener on module init', () => {
    service.onModuleInit();
    expect(mqttService.onMessage).toHaveBeenCalled();
  });

  it('should publish a command to a device topic', async () => {
    const result = await service.sendCommandToDevice('AA:BB:CC:DD:EE:FF', {
      action: 'calibrate',
      payload: { offset: 0.5 },
    });

    expect(mqttService.publish).toHaveBeenCalledWith(
      'sagana/devices/AA:BB:CC:DD:EE:FF/commands',
      { action: 'calibrate', payload: { offset: 0.5 } },
    );
    expect(result.success).toBe(true);
    expect(result.macAddress).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('should ingest discrete automation events and broadcast them', async () => {
    const prisma = (service as any).prisma;
    prisma.machine.findUnique.mockResolvedValue({
      id: 'machine_1',
      name: 'Composter 1',
      barangayId: 'brgy_1',
      batches: [{ id: 'batch_1', status: 'active' }],
    });

    const eventPayload = Buffer.from(
      JSON.stringify({
        type: 'blower_on',
        message:
          'The air blower has been turned on and will be running for 5 minutes.',
        metadata: { durationMinutes: 5 },
      }),
    );

    await service.handleIncomingMqttMessage(
      'sagana/devices/AA:BB:CC:DD:EE:FF/events',
      eventPayload,
    );

    expect(prisma.automationLog.create).toHaveBeenCalledWith({
      data: {
        machineId: 'machine_1',
        batchId: 'batch_1',
        type: 'blower_on',
        message:
          'The air blower has been turned on and will be running for 5 minutes.',
        metadata: { durationMinutes: 5 },
      },
    });

    expect(gateway.broadcastAutomationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        machineId: 'machine_1',
        type: 'blower_on',
        macAddress: 'AA:BB:CC:DD:EE:FF',
      }),
    );
  });

  it('should auto-synthesize event message if omitted in payload', async () => {
    const prisma = (service as any).prisma;
    prisma.machine.findUnique.mockResolvedValue({
      id: 'machine_1',
      name: 'Composter 1',
      barangayId: 'brgy_1',
      batches: [],
    });

    const eventPayload = Buffer.from(
      JSON.stringify({
        type: 'sprinkler_off',
        targetMoisture: 60,
      }),
    );

    await service.handleIncomingMqttMessage(
      'sagana/devices/AA:BB:CC:DD:EE:FF/events',
      eventPayload,
    );

    expect(prisma.automationLog.create).toHaveBeenCalledWith({
      data: {
        machineId: 'machine_1',
        batchId: null,
        type: 'sprinkler_off',
        message: 'The sprinkler has been turned off as it already reached 60%.',
        metadata: { type: 'sprinkler_off', targetMoisture: 60 },
      },
    });
  });

  it('should create and broadcast a warning notification when machine transitions to offline', async () => {
    const prisma = (service as any).prisma;
    prisma.machine.findUnique.mockResolvedValue({
      id: 'machine_1',
      name: 'Composter 1',
      barangayId: 'brgy_1',
    });

    const statusPayload = Buffer.from(JSON.stringify({ status: 'offline' }));
    await service.handleIncomingMqttMessage(
      'sagana/devices/AA:BB:CC:DD:EE:FF/status',
      statusPayload,
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        barangayId: 'brgy_1',
        machineId: 'machine_1',
        type: 'machine',
        severity: 'warning',
        title: 'Composter 1 Offline',
      }),
    });

    expect(gateway.broadcastNotification).toHaveBeenCalledWith(
      'brgy_1',
      expect.objectContaining({
        barangayId: 'brgy_1',
        type: 'machine',
        severity: 'warning',
      }),
    );
  });

  it('should create and broadcast a critical notification on emergency stop event', async () => {
    const prisma = (service as any).prisma;
    prisma.machine.findUnique.mockResolvedValue({
      id: 'machine_1',
      name: 'Composter 1',
      barangayId: 'brgy_1',
      batches: [{ id: 'batch_1', status: 'active' }],
    });

    const eventPayload = Buffer.from(
      JSON.stringify({
        type: 'emergency_stop',
      }),
    );

    await service.handleIncomingMqttMessage(
      'sagana/devices/AA:BB:CC:DD:EE:FF/events',
      eventPayload,
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        barangayId: 'brgy_1',
        type: 'automation',
        severity: 'critical',
        title: 'Emergency Stop Triggered',
      }),
    });

    expect(gateway.broadcastNotification).toHaveBeenCalledWith(
      'brgy_1',
      expect.objectContaining({
        barangayId: 'brgy_1',
        type: 'automation',
        severity: 'critical',
      }),
    );
  });

  it('should create and broadcast a critical sensor notification when temperature exceeds threshold', async () => {
    const prisma = (service as any).prisma;
    prisma.machine.findUnique.mockResolvedValue({
      id: 'machine_1',
      name: 'Composter 1',
      barangayId: 'brgy_1',
    });

    const telemetryPayload = Buffer.from(
      JSON.stringify({
        temperature: 82.5,
        humidity: 60,
      }),
    );

    await service.handleIncomingMqttMessage(
      'sagana/devices/AA:BB:CC:DD:EE:FF/telemetry',
      telemetryPayload,
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        barangayId: 'brgy_1',
        type: 'sensor',
        severity: 'critical',
        title: 'High Temperature Alert',
      }),
    });

    expect(gateway.broadcastNotification).toHaveBeenCalledWith(
      'brgy_1',
      expect.objectContaining({
        barangayId: 'brgy_1',
        type: 'sensor',
        severity: 'critical',
      }),
    );
  });

  it('should not allow event metadata to override macAddress and logId in notification metadata', async () => {
    const prisma = (service as any).prisma;
    prisma.machine.findUnique.mockResolvedValue({
      id: 'machine_1',
      name: 'Composter 1',
      barangayId: 'brgy_1',
      batches: [{ id: 'batch_1', status: 'active' }],
    });
    prisma.automationLog.create.mockResolvedValue({
      id: 'authoritative_log_123',
      machineId: 'machine_1',
      type: 'emergency_stop',
    });

    const maliciousPayload = Buffer.from(
      JSON.stringify({
        type: 'emergency_stop',
        message: 'E-stop pressed',
        metadata: {
          macAddress: 'SPOOFED_MAC',
          logId: 'SPOOFED_LOG',
          customField: 'valid_data',
        },
      }),
    );

    await service.handleIncomingMqttMessage(
      'sagana/devices/AA:BB:CC:DD:EE:FF/events',
      maliciousPayload,
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          macAddress: 'AA:BB:CC:DD:EE:FF',
          logId: 'authoritative_log_123',
          customField: 'valid_data',
        }),
      }),
    });
  });
});
