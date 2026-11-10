import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { TransformResponseInterceptor } from './../src/core/interceptors/transform-response.interceptor';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    await app.init();
  });

  it('/ (GET)', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        message: 'Sagana Backend API is running',
      },
    });
    expect(typeof response.body.data.uptime).toBe('number');
    expect(response.body.timestamp).toBeDefined();
  });

  it('/health (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
      },
    });
    expect(typeof response.body.data.uptime).toBe('number');
    expect(response.body.timestamp).toBeDefined();
  });

  afterEach(async () => {
    await app.close();
  });
});
