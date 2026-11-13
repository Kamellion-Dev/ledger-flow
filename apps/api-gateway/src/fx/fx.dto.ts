import { IsIn, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import type { Currency } from '@ledgerflow/contracts';

const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'EGP'];

export class CreateFxQuoteDto {
  @IsIn(currencies)
  sourceCurrency!: Currency;

  @IsIn(currencies)
  destinationCurrency!: Currency;

  @IsInt()
  @Min(1)
  sourceAmountMinor!: number;
}

export class CreateFxConversionDto {
  @IsString()
  @MinLength(1)
  quoteId!: string;

  @IsString()
  @MinLength(1)
  sourceAccountId!: string;

  @IsString()
  @MinLength(1)
  destinationAccountId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(140)
  reference!: string;
}
