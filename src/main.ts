import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers via Helmet
  app.use(helmet({
    contentSecurityPolicy: false, // APIs generally don't need CSP; disable to avoid blocking Swagger in dev
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: { action: 'deny' },
  }));

  // Hide framework details
  const http = app.getHttpAdapter().getInstance?.();
  if (http?.disable) {
    http.disable('x-powered-by');
  }

  // Explicit and safe CORS defaults for APIs
  app.enableCors({
    origin: (origin, callback) => callback(null, true), // allow all by default; tighten via ENV in production
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
    maxAge: 86400,
  });

  // Ensure each request has a correlation ID
  const requestId = new RequestIdMiddleware();
  app.use(requestId.use.bind(requestId));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global error normalization and logging
  app.useGlobalFilters(new HttpExceptionFilter());

  // Request logging with latency and status and unified API responses
  app.useGlobalInterceptors(
    new (await import('./common/interceptors/api-response.interceptor')).ApiResponseInterceptor(),
    new LoggingInterceptor(),
  );

  const config = new DocumentBuilder()
    .setTitle('Order Management System')
    .setDescription('E-commerce order management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT || 3000);
}

bootstrap();
