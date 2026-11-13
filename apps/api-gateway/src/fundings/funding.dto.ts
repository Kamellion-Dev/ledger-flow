import { IsIn, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import type { Currency } from '@ledgerflow/contracts';

const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'EGP'];

export class CreateWalletFundingDto {
  @IsString()
  @MinLength(1)
  walletId!: string;

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
