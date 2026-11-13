import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';

const RESERVED_ROUTE_PREFIXES = ['/api', '/health', '/docs'];

function configureDashboard(app: INestApplication): void {
  const webRoot = process.env.WEB_DIST_PATH ?? resolve(process.cwd(), '../web/dist');
  const indexPath = resolve(webRoot, 'index.html');
  if (!existsSync(indexPath)) return;

  app.use(express.static(webRoot));
  app.use((request: Request, response: Response, next: NextFunction) => {
    const reserved = RESERVED_ROUTE_PREFIXES.some(
      (prefix) => request.path === prefix || request.path.startsWith(`${prefix}/`),
    );
    if (request.method !== 'GET' || reserved || extname(request.path)) {
      next();
      return;
    }
    response.sendFile(indexPath);
  });
}

export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.enableCors({ origin: ['http://localhost:3000'], credentials: false });
  configureDashboard(app);
  app.use(
    (request: Request & { correlationId?: string }, response: Response, next: NextFunction) => {
      const incoming = request.headers['x-correlation-id'];
      request.correlationId = typeof incoming === 'string' ? incoming : randomUUID();
      response.setHeader('x-correlation-id', request.correlationId);
      next();
    },
  );
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('LedgerFlow API')
      .setDescription('Simulated financial operations API. No real money is processed.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}
