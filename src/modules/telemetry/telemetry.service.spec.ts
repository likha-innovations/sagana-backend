import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
import { LoggerService } from '../../core/logger/logger.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let mqttService: any;

  beforeEach(async () => {
    mqttService = {
      onMessage: jest.fn(),
      publish: jest.fn().mockResolvedValue(undefined),
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

  it('should process valid telemetry payload and store in memory', () => {
    const payload = Buffer.from(
      JSON.stringify({
        batchId: 'batch-123',
        sensorId: 'sensor-456',
        value: 52.4,
        unit: '°C',
      }),
    );

    service.handleIncomingMqttMessage(
      'sagana/devices/dev-01/telemetry',
      payload,
    );

    const readings = service.getReadings({});
    expect(readings.length).toBe(1);
    expect(readings[0].deviceId).toBe('dev-01');
    expect(readings[0].value).toBe(52.4);
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
