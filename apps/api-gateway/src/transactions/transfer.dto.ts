import { IsIn, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import type { Currency } from '@ledgerflow/contracts';

const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'EGP'];

export class CreateTransferDto {
  @IsString()
  @MinLength(1)
  sourceWalletId!: string;

  @IsString()
  @MinLength(1)
  destinationWalletId!: string;

  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsIn(currencies)
  currency!: Currency;

  @IsString()
  @MinLength(1)
  @MaxLength(140)
  reference!: string;
}

export class ReverseTransferDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  reason!: string;
}
