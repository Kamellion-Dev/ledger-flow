import type { AccountType, CreateTransferCommand, Currency } from '@ledgerflow/contracts';
import { assertBalanced, type PostingDraft } from './journal.js';
import { assertMinorUnits } from './money.js';

export interface TransferAccount {
  readonly id: string;
  readonly type: AccountType;
  readonly currency: Currency;
  readonly balanceMinor: number;
}

export interface TransferJournalDraft {
  readonly currency: Currency;
  readonly reference: string;
  readonly postings: readonly PostingDraft[];
}

export class TransferValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransferValidationError';
  }
}

export function buildTransferJournal(
  command: CreateTransferCommand,
  accounts: { readonly source: TransferAccount; readonly destination: TransferAccount },
): TransferJournalDraft {
  const amountMinor = assertMinorUnits(command.amountMinor);

  if (command.currency !== 'USD') {
    throw new TransferValidationError('LedgerFlow MVP supports USD only');
  }
  if (command.sourceAccountId === command.destinationAccountId) {
    throw new TransferValidationError('Source and destination accounts must be different');
  }
  if (accounts.source.id !== command.sourceAccountId) {
    throw new TransferValidationError('Source account does not match the command');
  }
  if (accounts.destination.id !== command.destinationAccountId) {
    throw new TransferValidationError('Destination account does not match the command');
  }
  if (
    accounts.source.currency !== command.currency ||
    accounts.destination.currency !== command.currency
  ) {
    throw new TransferValidationError('Account currencies must match the command currency');
  }
  if (accounts.source.type !== 'LIABILITY' || accounts.destination.type !== 'LIABILITY') {
    throw new TransferValidationError('Wallet transfers require liability accounts');
  }
  if (accounts.source.balanceMinor < amountMinor) {
    throw new TransferValidationError('Insufficient balance');
  }

  const postings = Object.freeze<PostingDraft[]>([
    Object.freeze({
      accountId: accounts.source.id,
      side: 'DEBIT',
      amountMinor,
    }),
    Object.freeze({
      accountId: accounts.destination.id,
      side: 'CREDIT',
      amountMinor,
    }),
  ]);

  assertBalanced(postings);

  return Object.freeze({
    currency: command.currency,
    reference: command.reference.trim(),
    postings,
  });
}
