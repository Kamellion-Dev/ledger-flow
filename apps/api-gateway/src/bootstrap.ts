import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';

export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.enableCors({ origin: ['http://localhost:3000'], credentials: false });
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
