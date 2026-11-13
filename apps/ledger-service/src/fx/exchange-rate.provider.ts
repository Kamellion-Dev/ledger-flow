import type { Currency } from '@ledgerflow/contracts';

export interface ProviderRate {
  readonly provider: string;
  readonly base: Currency;
  readonly quote: Currency;
  readonly decimal: string;
  readonly effectiveDate: string;
}

export interface ExchangeRateProvider {
  getRate(base: Currency, quote: Currency): Promise<ProviderRate>;
}

export class ExchangeRateProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ExchangeRateProviderError';
  }
}
