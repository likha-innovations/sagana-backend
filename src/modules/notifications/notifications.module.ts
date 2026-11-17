import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [DatabaseModule, TelemetryModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
