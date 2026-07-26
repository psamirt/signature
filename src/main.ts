import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';

async function bootstrap() {
  // rawBody: true expone req.rawBody, necesario para validar la firma
  // X-Hub-Signature-256 de Meta contra los bytes exactos que envió.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(appConfig.port);
  console.log(`API listening on http://localhost:${appConfig.port}`);
  console.log('Webhook de WhatsApp: POST /whatsapp/webhook');
}
void bootstrap();
