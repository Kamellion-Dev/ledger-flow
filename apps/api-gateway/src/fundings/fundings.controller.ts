import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, OperatorGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { mapLedgerError } from '../ledger/grpc-error.js';
import { LEDGER_PORT, type LedgerPort } from '../ledger/ledger.port.js';
import { CreateWalletFundingDto } from './funding.dto.js';

@ApiTags('wallet-fundings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/wallet-fundings')
export class FundingsController {
  constructor(@Inject(LEDGER_PORT) private readonly ledger: LedgerPort) {}

  @Get()
  list(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 25,
  ) {
    return this.ledger.listWalletFundings(page, Math.min(pageSize, 100));
  }

  @Post()
  @UseGuards(OperatorGuard)
  async create(
    @Body() dto: CreateWalletFundingDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    try {
      return await this.ledger.createWalletFunding(
        { ...dto, idempotencyKey: idempotencyKey.trim() },
        request.correlationId,
      );
    } catch (error) {
      throw mapLedgerError(error);
    }
  }
}
