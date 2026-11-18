import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { resolve } from 'node:path';
import { type Express } from 'express';
import { AppModule } from './app.module';
import { serveWeb } from './web-static';

function databaseEnv(): void {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL =
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL;
  }
}

async function bootstrap() {
  databaseEnv();
  const app = await NestFactory.create(
    AppModule,
    process.env.VERCEL ? { logger: ['error', 'warn'] } : {},
  );
  const config = app.get(ConfigService);
  const configured = config.get<string>('CORS_ORIGIN', 'http://localhost:4200');
  const vercelHosts = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ]
    .filter((host): host is string => Boolean(host))
    .map((host) => (host.startsWith('http') ? host : `https://${host}`));
  const capacitorOrigins = ['capacitor://localhost', 'https://localhost'];

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: [configured, ...vercelHosts, ...capacitorOrigins],
    credentials: true,
  });

  if (process.env.SERVE_WEB === 'true') {
    const browserDirectory = resolve(
      process.cwd(),
      'apps/web/dist/web/browser',
    );
    serveWeb(app.getHttpAdapter().getInstance() as Express, browserDirectory);
  }

  const port = Number(config.get('PORT') ?? 3001);
  await app.listen(port);
}

void bootstrap();
