import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [TelemetryModule],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
