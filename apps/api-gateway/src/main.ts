import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  const port = Number(process.env.GATEWAY_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`LedgerFlow API listening on http://localhost:${port}`);
}

void bootstrap();
