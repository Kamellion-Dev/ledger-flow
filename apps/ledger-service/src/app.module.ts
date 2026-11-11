import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LedgerApplicationService } from './ledger/ledger-application.service.js';
import { PrismaLedgerRepository } from './prisma/prisma-ledger.repository.js';
import { createPrismaClient } from './prisma/prisma-client.js';
import { LedgerGrpcController } from './grpc/ledger-grpc.controller.js';

export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');

@Module({
  controllers: [LedgerGrpcController],
  providers: [
    { provide: PRISMA_CLIENT, useFactory: createPrismaClient },
    {
      provide: LedgerApplicationService,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: ReturnType<typeof createPrismaClient>) =>
        new LedgerApplicationService(new PrismaLedgerRepository(prisma), {
          nextId: randomUUID,
          now: () => new Date(),
        }),
    },
  ],
})
export class AppModule {}
