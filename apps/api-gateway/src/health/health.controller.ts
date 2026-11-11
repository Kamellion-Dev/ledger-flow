import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { LEDGER_PORT, type LedgerPort } from '../ledger/ledger.port.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(LEDGER_PORT) private readonly ledger: LedgerPort) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.ledger.health();
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Ledger service is unavailable');
    }
  }
}
