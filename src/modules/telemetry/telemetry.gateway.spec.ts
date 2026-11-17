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
        findFirst: jest.fn(),
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

  it('should broadcast notification to specific barangay room', () => {
    const notificationData = {
      id: 'notif-1',
      title: 'Machine Offline',
      message: 'Machine 1 is offline',
      severity: 'warning',
    };
    gateway.broadcastNotification('brgy-123', notificationData);

    expect(mockServer.to).toHaveBeenCalledWith('barangay:brgy-123');
    expect(mockRoom.emit).toHaveBeenCalledWith(
      'notification',
      notificationData,
    );
  });

  it('should allow client to join barangay room via handleJoinBarangay', async () => {
    const mockSocket = {
      id: 'test-socket-1',
      data: { barangayId: 'brgy-123' },
      join: jest.fn().mockResolvedValue(undefined),
    } as any;

    const result = await gateway.handleJoinBarangay(
      { barangayId: 'brgy-123' },
      mockSocket,
    );

    expect(mockSocket.join).toHaveBeenCalledWith('barangay:brgy-123');
    expect(result).toEqual({ status: 'joined', room: 'barangay:brgy-123' });
  });

  it('should reject handleJoinBarangay when client has no authenticated barangayId', async () => {
    const mockSocket = {
      id: 'unauth-socket',
      data: {},
      join: jest.fn().mockResolvedValue(undefined),
    } as any;

    const result = await gateway.handleJoinBarangay(
      { barangayId: 'brgy-spoofed' },
      mockSocket,
    );

    expect(mockSocket.join).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'rejected',
      reason: 'Unauthenticated or no assigned barangay',
    });
  });

  it('should authenticate client with dev token in development when ENABLE_DEV_AUTH_BYPASS is true', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalBypass = process.env.ENABLE_DEV_AUTH_BYPASS;
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_DEV_AUTH_BYPASS = 'true';

    try {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'dev_op_1',
        barangayId: 'brgy_dev_1',
      });

      const mockSocket = {
        id: 'dev-socket-1',
        handshake: {
          auth: { token: 'Bearer dev_operator' },
          headers: {},
        },
        data: {},
        join: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('barangay:brgy_dev_1');
      expect(mockSocket.data.userId).toBe('dev_op_1');
      expect(mockSocket.data.barangayId).toBe('brgy_dev_1');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.ENABLE_DEV_AUTH_BYPASS = originalBypass;
    }
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
