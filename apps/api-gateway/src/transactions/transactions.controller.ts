import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, OperatorGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { LEDGER_PORT, type LedgerPort } from '../ledger/ledger.port.js';
import { mapLedgerError } from '../ledger/grpc-error.js';
import { CreateTransferDto, ReverseTransferDto } from './transfer.dto.js';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/transactions')
export class TransactionsController {
  constructor(@Inject(LEDGER_PORT) private readonly ledger: LedgerPort) {}

  @Get()
  list(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 25,
  ) {
    return this.ledger.listTransfers(page, Math.min(pageSize, 100));
  }

  @Post()
  @UseGuards(OperatorGuard)
  async create(
    @Body() dto: CreateTransferDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!idempotencyKey?.trim())
      throw new BadRequestException('Idempotency-Key header is required');
    try {
      return await this.ledger.createTransfer(
        { ...dto, idempotencyKey: idempotencyKey.trim() },
        request.correlationId,
      );
    } catch (error) {
      throw mapLedgerError(error);
    }
  }

  @Post(':id/reverse')
  @UseGuards(OperatorGuard)
  reverse(
    @Param('id') transferId: string,
    @Body() dto: ReverseTransferDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!idempotencyKey?.trim())
      throw new BadRequestException('Idempotency-Key header is required');
    return this.ledger.reverseTransfer(
      { transferId, idempotencyKey: idempotencyKey.trim(), reason: dto.reason },
      request.correlationId,
    );
  }
}
