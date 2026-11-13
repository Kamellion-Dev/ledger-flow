import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LedgerApplicationService } from './ledger/ledger-application.service.js';
import { PrismaLedgerRepository } from './prisma/prisma-ledger.repository.js';
import { createPrismaClient } from './prisma/prisma-client.js';
import { LedgerGrpcController } from './grpc/ledger-grpc.controller.js';
import { FrankfurterExchangeRateProvider } from './fx/frankfurter-exchange-rate.provider.js';

export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');

@Module({
  controllers: [LedgerGrpcController],
  providers: [
    { provide: PRISMA_CLIENT, useFactory: createPrismaClient },
    {
      provide: LedgerApplicationService,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: ReturnType<typeof createPrismaClient>) =>
        new LedgerApplicationService(
          new PrismaLedgerRepository(prisma),
          {
            nextId: randomUUID,
            now: () => new Date(),
          },
          new FrankfurterExchangeRateProvider(
            fetch,
            process.env['FRANKFURTER_BASE_URL'] ?? 'https://api.frankfurter.dev/v2',
            5_000,
          ),
        ),
    },
  ],
})
export class AppModule {}
