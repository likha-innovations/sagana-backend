import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryGateway } from './telemetry.gateway';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('TelemetryGateway', () => {
  let gateway: TelemetryGateway;
  let mockServer: any;
  let mockRoom: any;
  let mockMqttService: any;
  let mockPrisma: any;

  beforeEach(async () => {
    mockRoom = {
      emit: jest.fn(),
    };

    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue(mockRoom),
      sockets: new Map(),
    };

    mockMqttService = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryGateway,
        {
          provide: MqttService,
          useValue: mockMqttService,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    gateway = module.get<TelemetryGateway>(TelemetryGateway);
    gateway.server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should broadcast telemetry data to specific barangay room when barangayId is provided', () => {
    const testData = {
      temperature: 28.5,
      humidity: 65,
      barangayId: 'brgy-123',
    };
    gateway.broadcastTelemetry(testData);

    expect(mockServer.to).toHaveBeenCalledWith('barangay:brgy-123');
    expect(mockRoom.emit).toHaveBeenCalledWith('telemetry', testData);
  });

  it('should broadcast telemetry data to all when barangayId is missing', () => {
    const testData = { temperature: 28.5, humidity: 65 };
    gateway.broadcastTelemetry(testData);

    expect(mockServer.emit).toHaveBeenCalledWith('telemetry', testData);
  });

  it('should broadcast status to specific barangay room', () => {
    const statusData = {
      machineId: 'm-1',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      status: 'active',
      barangayId: 'brgy-123',
    };
    gateway.broadcastStatus(statusData);

    expect(mockServer.to).toHaveBeenCalledWith('barangay:brgy-123');
    expect(mockRoom.emit).toHaveBeenCalledWith('status', statusData);
  });

  it('should broadcast automation log to specific barangay room', () => {
    const logData = {
      id: 'log-1',
      type: 'blower_on',
      barangayId: 'brgy-123',
    };
    gateway.broadcastAutomationLog(logData);

    expect(mockServer.to).toHaveBeenCalledWith('barangay:brgy-123');
    expect(mockRoom.emit).toHaveBeenCalledWith('automation_log', logData);
  });

  it('should route command to the device-specific MQTT topic', async () => {
    const mockSocket = { id: 'test-socket-1' } as any;
    const macAddress = 'AA:BB:CC:DD:EE:FF';
    const commandPayload = { macAddress, action: 'RELAY_ON' };

    const response = await gateway.handleCommand(commandPayload, mockSocket);
    const expectedTopic = `sagana/devices/${macAddress}/commands`;

    expect(mockMqttService.publish).toHaveBeenCalledWith(
      expectedTopic,
      commandPayload,
    );
    expect(response.status).toBe('published');
    expect(response.topic).toBe(expectedTopic);
  });
});
