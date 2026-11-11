import type { PostingSide } from '@ledgerflow/contracts';
import { assertMinorUnits } from './money.js';

export interface PostingDraft {
  readonly accountId: string;
  readonly side: PostingSide;
  readonly amountMinor: number;
}

export class JournalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JournalValidationError';
  }
}

export function assertBalanced(postings: readonly PostingDraft[]): void {
  if (postings.length < 2) {
    throw new JournalValidationError('A journal requires at least two postings');
  }

  let debits = 0;
  let credits = 0;

  for (const posting of postings) {
    assertMinorUnits(posting.amountMinor);
    if (!posting.accountId.trim()) {
      throw new JournalValidationError('Every posting requires an account');
    }
    if (posting.side === 'DEBIT') {
      debits += posting.amountMinor;
    } else {
      credits += posting.amountMinor;
    }
  }

  if (debits !== credits) {
    throw new JournalValidationError('Debits and credits must balance');
  }
}
