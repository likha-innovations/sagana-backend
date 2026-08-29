import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryGateway } from './telemetry.gateway';

describe('TelemetryGateway', () => {
  let gateway: TelemetryGateway;
  let mockServer: any;

  beforeEach(async () => {
    mockServer = {
      emit: jest.fn(),
      sockets: new Map(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TelemetryGateway],
    }).compile();

    gateway = module.get<TelemetryGateway>(TelemetryGateway);
    gateway.server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should handle ping and reply with pong', () => {
    const mockSocket = {
      id: 'test-socket-1',
      emit: jest.fn(),
    } as any;

    const response = gateway.handlePing(
      { text: 'ping from client' },
      mockSocket,
    );

    expect(response.status).toBe('ok');
    expect(response.received).toEqual({ text: 'ping from client' });
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'pong',
      expect.objectContaining({ status: 'ok' }),
    );
  });

  it('should broadcast telemetry to all clients', () => {
    const reading = {
      deviceId: 'dev-01',
      sensorId: 'temp-1',
      value: 55.4,
      unit: '°C',
      timestamp: new Date().toISOString(),
    };

    gateway.broadcastTelemetry(reading);
    expect(mockServer.emit).toHaveBeenCalledWith('telemetry:reading', reading);
  });

  it('should broadcast mqtt ping/pong events', () => {
    const eventData = {
      topic: 'sagana/ping',
      message: 'test ping',
      timestamp: new Date().toISOString(),
    };

    gateway.broadcastMqttPingPong('ping', eventData);
    expect(mockServer.emit).toHaveBeenCalledWith('mqtt:ping', eventData);
  });
});
