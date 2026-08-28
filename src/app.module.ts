import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { DatabaseModule } from './infrastructure/database/database.module';
import { validate } from './core/config/env.validation';
import { LoggerModule } from './core/logger/logger.module';
import { UsersModule } from './modules/users/users.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { MqttModule } from './infrastructure/mqtt/mqtt.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { APP_GUARD } from '@nestjs/core';
import { ClerkAuthGuard } from './core/guards/clerk-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    LoggerModule,
    MqttModule,
    TelemetryModule,
    UsersModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
  ],
})
export class AppModule {}
