import { IsIn } from 'class-validator';
import type { Currency } from '@ledgerflow/contracts';

const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'EGP'];

export class CreateWalletBalanceDto {
  @IsIn(currencies)
  currency!: Currency;
}
