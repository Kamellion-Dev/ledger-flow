import { describe, expect, it } from 'vitest';
import type { CreateTransferCommand } from '@ledgerflow/contracts';
import { buildTransferJournal, type TransferAccount } from './transfer.js';

const command: CreateTransferCommand = {
  idempotencyKey: 'demo-transfer-001',
  sourceAccountId: 'wallet-alice',
  destinationAccountId: 'wallet-bob',
  amountMinor: 2500,
  currency: 'USD',
  reference: 'Dinner split',
};

const source: TransferAccount = {
  id: 'wallet-alice',
  type: 'LIABILITY',
  currency: 'USD',
  balanceMinor: 10_000,
};

const destination: TransferAccount = {
  id: 'wallet-bob',
  type: 'LIABILITY',
  currency: 'USD',
  balanceMinor: 5_000,
};

describe('buildTransferJournal', () => {
  it('creates an immutable balanced liability transfer', () => {
    const journal = buildTransferJournal(command, { source, destination });

    expect(journal).toEqual({
      currency: 'USD',
      reference: 'Dinner split',
      postings: [
        { accountId: 'wallet-alice', side: 'DEBIT', amountMinor: 2500 },
        { accountId: 'wallet-bob', side: 'CREDIT', amountMinor: 2500 },
      ],
    });
    expect(Object.isFrozen(journal)).toBe(true);
    expect(Object.isFrozen(journal.postings)).toBe(true);
  });

  it('rejects a self-transfer', () => {
    expect(() =>
      buildTransferJournal(
        { ...command, destinationAccountId: command.sourceAccountId },
        { source, destination: { ...destination, id: source.id } },
      ),
    ).toThrow('different');
  });

  it('rejects insufficient source balance', () => {
    expect(() =>
      buildTransferJournal({ ...command, amountMinor: 10_001 }, { source, destination }),
    ).toThrow('Insufficient balance');
  });

  it('rejects a non-USD command at runtime', () => {
    expect(() =>
      buildTransferJournal(
        { ...command, currency: 'EUR' } as unknown as CreateTransferCommand,
        { source, destination },
      ),
    ).toThrow('USD');
  });

  it('rejects an account whose currency differs from the command', () => {
    expect(() =>
      buildTransferJournal(command, {
        source,
        destination: { ...destination, currency: 'EUR' } as unknown as TransferAccount,
      }),
    ).toThrow('Account currencies');
  });
});
