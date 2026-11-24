// Must be the first import so process.env is populated before any module reads it.
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { getAllowedOrigins, getJwtSecrets, requireEnv } from './config/env';

async function bootstrap() {
  // Fail fast on missing/weak configuration before anything else starts.
  requireEnv('DATABASE_URL');
  getJwtSecrets();
  const allowedOrigins = getAllowedOrigins();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind a reverse proxy (nginx, Tailscale Funnel): use X-Forwarded-For so req.ip
  // (rate limiting, audit logs) is the real client IP. TRUST_PROXY defaults to 1 hop;
  // start-live.ps1 sets "loopback" because Funnel's proxy connects from 127.0.0.1.
  const trustProxy = process.env.TRUST_PROXY ?? '1';
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

  app.use(helmet());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // HOST=127.0.0.1 keeps the API reachable only through the local proxy (Funnel),
  // so nobody on the LAN can bypass it and spoof X-Forwarded-For.
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST?.trim();
  if (host) await app.listen(port, host);
  else await app.listen(port);
  console.log(
    `Gradify API listening on ${host ?? '*'}:${port} | CORS origins: ${allowedOrigins.join(', ')} | trust proxy: ${trustProxy}`,
  );
}
bootstrap();
