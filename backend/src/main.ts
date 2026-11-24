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

  // Behind nginx / a load balancer: use X-Forwarded-For so req.ip (rate limiting,
  // audit logs) is the real client IP. TRUST_PROXY defaults to 1 hop.
  const trustProxy = process.env.TRUST_PROXY ?? '1';
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

  app.use(helmet());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
