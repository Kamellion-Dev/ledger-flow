import type {
  AccountType,
  CreateFxConversionCommand,
  Currency,
  FxQuoteView,
  PostingSide,
} from '@ledgerflow/contracts';
import { assertBalanced } from './journal.js';
import { assertMinorUnits } from './money.js';

export interface FxConversionAccount {
  readonly id: string;
  readonly type: AccountType;
  readonly currency: Currency;
  readonly balanceMinor: number;
}

export interface FxPostingDraft {
  readonly accountId: string;
  readonly currency: Currency;
  readonly side: PostingSide;
  readonly amountMinor: number;
}

export interface FxConversionJournalDraft {
  readonly currencies: readonly [Currency, Currency];
  readonly reference: string;
  readonly postings: readonly FxPostingDraft[];
}

export class FxConversionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FxConversionValidationError';
  }
}

export function buildFxConversionJournal(
  command: CreateFxConversionCommand,
  quote: FxQuoteView,
  accounts: {
    readonly sourceWallet: FxConversionAccount;
    readonly destinationWallet: FxConversionAccount;
    readonly sourceCash: FxConversionAccount;
    readonly destinationCash: FxConversionAccount;
  },
): FxConversionJournalDraft {
  const sourceAmountMinor = assertMinorUnits(quote.sourceAmountMinor);
  const destinationAmountMinor = assertMinorUnits(quote.destinationAmountMinor);

  if (quote.id !== command.quoteId) {
    throw new FxConversionValidationError('Quote does not match the conversion command');
  }
  if (quote.sourceCurrency === quote.destinationCurrency) {
    throw new FxConversionValidationError('FX conversion requires two different currencies');
  }
  if (
    accounts.sourceWallet.id !== command.sourceAccountId ||
    accounts.destinationWallet.id !== command.destinationAccountId
  ) {
    throw new FxConversionValidationError('Wallet accounts do not match the conversion command');
  }
  if (
    accounts.sourceWallet.currency !== quote.sourceCurrency ||
    accounts.sourceCash.currency !== quote.sourceCurrency ||
    accounts.destinationWallet.currency !== quote.destinationCurrency ||
    accounts.destinationCash.currency !== quote.destinationCurrency
  ) {
    throw new FxConversionValidationError('Account currencies must match the quote currencies');
  }
  if (
    accounts.sourceWallet.type !== 'LIABILITY' ||
    accounts.destinationWallet.type !== 'LIABILITY'
  ) {
    throw new FxConversionValidationError('FX wallet accounts must be liability accounts');
  }
  if (accounts.sourceCash.type !== 'ASSET' || accounts.destinationCash.type !== 'ASSET') {
    throw new FxConversionValidationError('FX platform cash accounts must be asset accounts');
  }
  if (accounts.sourceWallet.balanceMinor < sourceAmountMinor) {
    throw new FxConversionValidationError('Insufficient source wallet balance');
  }
  if (accounts.sourceCash.balanceMinor < sourceAmountMinor) {
    throw new FxConversionValidationError('Insufficient source platform cash balance');
  }

  const postings = Object.freeze<FxPostingDraft[]>([
    Object.freeze({
      accountId: accounts.sourceWallet.id,
      currency: quote.sourceCurrency,
      side: 'DEBIT',
      amountMinor: sourceAmountMinor,
    }),
    Object.freeze({
      accountId: accounts.sourceCash.id,
      currency: quote.sourceCurrency,
      side: 'CREDIT',
      amountMinor: sourceAmountMinor,
    }),
    Object.freeze({
      accountId: accounts.destinationCash.id,
      currency: quote.destinationCurrency,
      side: 'DEBIT',
      amountMinor: destinationAmountMinor,
    }),
    Object.freeze({
      accountId: accounts.destinationWallet.id,
      currency: quote.destinationCurrency,
      side: 'CREDIT',
      amountMinor: destinationAmountMinor,
    }),
  ]);

  for (const currency of [quote.sourceCurrency, quote.destinationCurrency]) {
    assertBalanced(postings.filter((posting) => posting.currency === currency));
  }

  const currencies: readonly [Currency, Currency] = Object.freeze([
    quote.sourceCurrency,
    quote.destinationCurrency,
  ]);

  return Object.freeze({
    currencies,
    reference: command.reference.trim(),
    postings,
  });
}
