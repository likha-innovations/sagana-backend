import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './core/exceptions/global-exception.filter';
import { TransformResponseInterceptor } from './core/interceptors/transform-response.interceptor';
import { LoggerService } from './core/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(LoggerService));

  app.enableCors();

  const apiPrefix = process.env.API_PREFIX || '';
  if (apiPrefix) app.setGlobalPrefix(apiPrefix);

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
