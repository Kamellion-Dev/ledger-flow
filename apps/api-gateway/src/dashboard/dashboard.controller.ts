import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard.js';
import { LEDGER_PORT, type LedgerPort } from '../ledger/ledger.port.js';

@ApiTags('operations')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api')
export class DashboardController {
  constructor(@Inject(LEDGER_PORT) private readonly ledger: LedgerPort) {}

  @Get('dashboard/summary')
  summary() {
    return this.ledger.getSummary();
  }

  @Get('accounts')
  accounts() {
    return this.ledger.listAccounts();
  }

  @Get('journals/:id')
  journal(@Param('id') id: string) {
    return this.ledger.getJournal(id);
  }

  @Get('settlements')
  settlements(@Query('page') page = '1', @Query('pageSize') pageSize = '25') {
    return this.ledger.listSettlements(Number(page), Math.min(Number(pageSize), 100));
  }
}
