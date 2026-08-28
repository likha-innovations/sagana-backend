import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

describe('TelemetryController', () => {
  let controller: TelemetryController;
  let service: any;

  beforeEach(async () => {
    service = {
      getReadings: jest.fn().mockReturnValue([]),
      getLatestByDevice: jest.fn().mockReturnValue([]),
      sendCommandToDevice: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelemetryController],
      providers: [
        {
          provide: TelemetryService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<TelemetryController>(TelemetryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get readings', () => {
    const result = controller.getReadings({ limit: 10 });
    expect(service.getReadings).toHaveBeenCalledWith({ limit: 10 });
    expect(result).toEqual([]);
  });

  it('should get latest device readings', () => {
    const result = controller.getLatestByDevice('dev-01');
    expect(service.getLatestByDevice).toHaveBeenCalledWith('dev-01');
    expect(result).toEqual([]);
  });

  it('should send command to device', async () => {
    const command = { action: 'restart' };
    const result = await controller.sendCommand('dev-01', command);
    expect(service.sendCommandToDevice).toHaveBeenCalledWith('dev-01', command);
    expect(result).toEqual({ success: true });
  });
});
