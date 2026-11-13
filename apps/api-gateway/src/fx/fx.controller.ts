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
import { CreateFxConversionDto, CreateFxQuoteDto } from './fx.dto.js';

@ApiTags('fx')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/fx')
export class FxController {
  constructor(@Inject(LEDGER_PORT) private readonly ledger: LedgerPort) {}

  @Post('quotes')
  @UseGuards(OperatorGuard)
  async createQuote(@Body() dto: CreateFxQuoteDto) {
    if (dto.sourceCurrency === dto.destinationCurrency) {
      throw new BadRequestException('Source and destination currencies must be different');
    }
    try {
      return await this.ledger.createFxQuote(dto);
    } catch (error) {
      throw mapLedgerError(error);
    }
  }

  @Post('conversions')
  @UseGuards(OperatorGuard)
  async createConversion(
    @Body() dto: CreateFxConversionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    try {
      return await this.ledger.createFxConversion(
        { ...dto, idempotencyKey: idempotencyKey.trim() },
        request.correlationId,
      );
    } catch (error) {
      throw mapLedgerError(error);
    }
  }

  @Get('conversions')
  listConversions(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 25,
  ) {
    return this.ledger.listFxConversions(page, Math.min(pageSize, 100));
  }
}
