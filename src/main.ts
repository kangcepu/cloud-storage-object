import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import session from 'express-session';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const origins = config
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const expressApp = app.getHttpAdapter().getInstance() as { set(name: string, value: unknown): void };
  expressApp.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: origins.length ? origins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Token', 'X-CSRF-Token', 'Range'],
    exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Content-Disposition'],
  });
  app.use(
    session({
      name: config.get<string>('SESSION_NAME', 'ES3SMSESSID_NEST'),
      secret: config.getOrThrow<string>('SESSION_SECRET'),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: config.get<string>('SESSION_SECURE', 'false') === 'true',
        sameSite: 'lax',
        maxAge: Number(config.get<string>('SESSION_LIFETIME_MINUTES', '120')) * 60_000,
      },
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(Number(config.get<string>('PORT', '3000')), '0.0.0.0');
}

void bootstrap();
