import type { AccountType, CreateWalletFundingCommand, Currency } from '@ledgerflow/contracts';
import { assertBalanced, type PostingDraft } from './journal.js';
import { assertMinorUnits } from './money.js';

export interface FundingAccount {
  readonly id: string;
  readonly type: AccountType;
  readonly currency: Currency;
}

export interface WalletFundingJournalDraft {
  readonly currency: Currency;
  readonly reference: string;
  readonly postings: readonly PostingDraft[];
}

export class WalletFundingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletFundingValidationError';
  }
}

export function buildWalletFundingJournal(
  command: CreateWalletFundingCommand,
  accounts: {
    readonly fundingAccount: FundingAccount;
    readonly walletAccount: FundingAccount;
  },
): WalletFundingJournalDraft {
  const amountMinor = assertMinorUnits(command.amountMinor);
  if (!['USD', 'EUR', 'GBP', 'EGP'].includes(command.currency)) {
    throw new WalletFundingValidationError('Unsupported wallet funding currency');
  }
  if (accounts.fundingAccount.id === accounts.walletAccount.id) {
    throw new WalletFundingValidationError('Funding and wallet accounts must be different');
  }
  if (
    accounts.fundingAccount.currency !== command.currency ||
    accounts.walletAccount.currency !== command.currency
  ) {
    throw new WalletFundingValidationError('Account currencies must match the command currency');
  }
  if (accounts.fundingAccount.type !== 'ASSET') {
    throw new WalletFundingValidationError('Wallet funding requires an asset funding account');
  }
  if (accounts.walletAccount.type !== 'LIABILITY') {
    throw new WalletFundingValidationError('Wallet funding requires a liability wallet');
  }

  const postings = Object.freeze<PostingDraft[]>([
    Object.freeze({ accountId: accounts.fundingAccount.id, side: 'DEBIT', amountMinor }),
    Object.freeze({ accountId: accounts.walletAccount.id, side: 'CREDIT', amountMinor }),
  ]);
  assertBalanced(postings);
  return Object.freeze({
    currency: command.currency,
    reference: command.reference.trim(),
    postings,
  });
}
