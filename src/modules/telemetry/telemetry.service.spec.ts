import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
import { LoggerService } from '../../core/logger/logger.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
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
      broadcastMqttPingPong: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        {
          provide: MqttService,
          useValue: mqttService,
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
        {
          provide: TelemetryGateway,
          useValue: gateway,
        },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register onMessage listener on module init', () => {
    service.onModuleInit();
    expect(mqttService.onMessage).toHaveBeenCalled();
  });

  it('should publish a command to a device topic', async () => {
    const result = await service.sendCommandToDevice('dev-01', {
      action: 'calibrate',
      payload: { offset: 0.5 },
    });

    expect(mqttService.publish).toHaveBeenCalledWith(
      'sagana/devices/dev-01/commands',
      { action: 'calibrate', payload: { offset: 0.5 } },
    );
    expect(result.success).toBe(true);
  });
});
