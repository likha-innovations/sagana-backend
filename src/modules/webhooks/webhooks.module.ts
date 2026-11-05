import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [TelemetryModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
