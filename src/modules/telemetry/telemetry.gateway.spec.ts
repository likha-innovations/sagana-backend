import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryGateway } from './telemetry.gateway';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';

describe('TelemetryGateway', () => {
  let gateway: TelemetryGateway;
  let mockServer: any;
  let mockMqttService: any;

  beforeEach(async () => {
    mockServer = {
      emit: jest.fn(),
      sockets: new Map(),
    };

    mockMqttService = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryGateway,
        {
          provide: MqttService,
          useValue: mockMqttService,
        },
      ],
    }).compile();

    gateway = module.get<TelemetryGateway>(TelemetryGateway);
    gateway.server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should broadcast telemetry data to all connected clients', () => {
    const testData = { temperature: 28.5, humidity: 65 };
    gateway.broadcastTelemetry(testData);

    expect(mockServer.emit).toHaveBeenCalledWith('telemetry', testData);
  });

  it('should handle command from client and publish to sagana/commands topic', async () => {
    const mockSocket = {
      id: 'test-socket-1',
    } as any;

    const commandPayload = { action: 'RELAY_ON' };
    const response = await gateway.handleCommand(commandPayload, mockSocket);

    expect(mockMqttService.publish).toHaveBeenCalledWith(
      'sagana/commands',
      commandPayload,
    );
    expect(response.status).toBe('published');
    expect(response.topic).toBe('sagana/commands');
  });
});
