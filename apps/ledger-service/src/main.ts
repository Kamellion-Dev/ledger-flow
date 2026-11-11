import 'reflect-metadata';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import {
  GrpcExceptionFilter,
  type MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { AppModule, PRISMA_CLIENT } from './app.module.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { OutboxDispatcher } from './events/outbox-dispatcher.js';
import { PrismaOutboxStore } from './events/prisma-outbox.store.js';
import { RabbitMqEventPublisher } from './events/rabbitmq-event.publisher.js';
import { PrismaSettlementResultStore } from './events/prisma-settlement-result.store.js';
import { SettlementResultHandler } from './events/settlement-result.handler.js';
import { RabbitMqSettlementConsumer } from './events/rabbitmq-settlement.consumer.js';

async function bootstrap(): Promise<void> {
  const rabbitUrl = process.env.RABBITMQ_URL;
  if (!rabbitUrl) throw new Error('RABBITMQ_URL is required');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'ledgerflow.ledger.v1',
      protoPath: resolve(process.cwd(), '../../packages/contracts/proto/ledger.proto'),
      url: process.env.LEDGER_GRPC_URL ?? '0.0.0.0:50051',
      loader: { longs: Number, enums: String, defaults: true, oneofs: true },
    },
  });
  app.useGlobalFilters(new GrpcExceptionFilter());

  const prisma = app.get<PrismaClient>(PRISMA_CLIENT);
  const publisher = new RabbitMqEventPublisher(rabbitUrl);
  const dispatcher = new OutboxDispatcher(new PrismaOutboxStore(prisma), publisher);
  const settlementConsumer = new RabbitMqSettlementConsumer(
    rabbitUrl,
    new SettlementResultHandler(new PrismaSettlementResultStore(prisma)),
  );
  const timer = setInterval(() => {
    void dispatcher.runOnce().catch((error: unknown) => {
      console.error('Outbox dispatch failed', error);
    });
  }, 1_000);

  const shutdown = async () => {
    clearInterval(timer);
    await settlementConsumer.close();
    await publisher.close();
    await prisma.$disconnect();
    await app.close();
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  await app.listen();
  console.log(`Ledger gRPC service listening on ${process.env.LEDGER_GRPC_URL ?? '0.0.0.0:50051'}`);
}

void bootstrap();
