import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, OperatorGuard } from '../auth/auth.guard.js';
import { mapLedgerError } from '../ledger/grpc-error.js';
import { LEDGER_PORT, type LedgerPort } from '../ledger/ledger.port.js';
import { CreateWalletBalanceDto } from './wallet.dto.js';

@ApiTags('wallets')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/wallets')
export class WalletsController {
  constructor(@Inject(LEDGER_PORT) private readonly ledger: LedgerPort) {}

  @Get()
  list() {
    return this.ledger.listWallets();
  }

  @Post(':walletId/balances')
  @UseGuards(OperatorGuard)
  async createBalance(@Param('walletId') walletId: string, @Body() dto: CreateWalletBalanceDto) {
    try {
      return await this.ledger.createWalletBalance({ walletId, currency: dto.currency });
    } catch (error) {
      throw mapLedgerError(error);
    }
  }
}
