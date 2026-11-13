import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthController } from './auth/auth.controller.js';
import { AuthGuard, OperatorGuard } from './auth/auth.guard.js';
import { AuthService } from './auth/auth.service.js';
import { TransactionsController } from './transactions/transactions.controller.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { HealthController } from './health/health.controller.js';
import { GrpcLedgerClient, LEDGER_GRPC_CLIENT } from './ledger/grpc-ledger.client.js';
import { LEDGER_PORT } from './ledger/ledger.port.js';
import { FundingsController } from './fundings/fundings.controller.js';
import { FxController } from './fx/fx.controller.js';
import { WalletsController } from './wallets/wallets.controller.js';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: LEDGER_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: {
          package: 'ledgerflow.ledger.v1',
          protoPath: resolve(process.cwd(), '../../packages/contracts/proto/ledger.proto'),
          url: process.env.LEDGER_GRPC_URL ?? 'localhost:50051',
          loader: { longs: Number, enums: String, defaults: true, oneofs: true },
        },
      },
    ]),
  ],
  controllers: [
    AuthController,
    TransactionsController,
    FundingsController,
    FxController,
    WalletsController,
    DashboardController,
    HealthController,
  ],
  providers: [
    AuthService,
    AuthGuard,
    OperatorGuard,
    GrpcLedgerClient,
    { provide: LEDGER_PORT, useExisting: GrpcLedgerClient },
  ],
})
export class AppModule {}
