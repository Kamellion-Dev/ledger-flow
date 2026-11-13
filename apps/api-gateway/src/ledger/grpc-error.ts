import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
  ServiceUnavailableException,
} from '@nestjs/common';

export function mapLedgerError(error: unknown): unknown {
  const grpcError = error as { code?: unknown; details?: unknown };
  const message =
    typeof grpcError.details === 'string' ? grpcError.details : 'Ledger operation failed';
  switch (grpcError.code) {
    case 3:
      return new BadRequestException(message);
    case 5:
      return new NotFoundException(message);
    case 6:
      return new ConflictException(message);
    case 9:
      return new UnprocessableEntityException(message);
    case 14:
      return new ServiceUnavailableException(message);
    default:
      return error;
  }
}
