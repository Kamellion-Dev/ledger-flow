import { describe, expect, it } from 'vitest';
import type { CreateWalletFundingCommand } from '@ledgerflow/contracts';
import { buildWalletFundingJournal, type FundingAccount } from './wallet-funding.js';

const command: CreateWalletFundingCommand = {
  idempotencyKey: 'funding-demo-001',
  walletId: 'wallet-alice',
  amountMinor: 5_000,
  currency: 'USD',
  reference: 'Bank cash-in',
};

const platformCash: FundingAccount = {
  id: 'platform-cash',
  type: 'ASSET',
  currency: 'USD',
};

const aliceWallet: FundingAccount = {
  id: 'wallet-alice',
  type: 'LIABILITY',
  currency: 'USD',
};

describe('buildWalletFundingJournal', () => {
  it('debits platform cash and credits the customer wallet with equal amounts', () => {
    const journal = buildWalletFundingJournal(command, {
      fundingAccount: platformCash,
      walletAccount: aliceWallet,
    });

    expect(journal).toEqual({
      currency: 'USD',
      reference: 'Bank cash-in',
      postings: [
        { accountId: 'platform-cash', side: 'DEBIT', amountMinor: 5_000 },
        { accountId: 'wallet-alice', side: 'CREDIT', amountMinor: 5_000 },
      ],
    });
  });

  it('rejects a non-positive funding amount', () => {
    expect(() =>
      buildWalletFundingJournal(
        { ...command, amountMinor: 0 },
        { fundingAccount: platformCash, walletAccount: aliceWallet },
      ),
    ).toThrow('Amount must be a positive safe integer in minor units');
  });

  it('requires an asset counter-account and liability wallet', () => {
    expect(() =>
      buildWalletFundingJournal(command, {
        fundingAccount: { ...platformCash, type: 'LIABILITY' },
        walletAccount: aliceWallet,
      }),
    ).toThrow('Wallet funding requires an asset funding account');

    expect(() =>
      buildWalletFundingJournal(command, {
        fundingAccount: platformCash,
        walletAccount: { ...aliceWallet, type: 'ASSET' },
      }),
    ).toThrow('Wallet funding requires a liability wallet');
  });

  it('rejects funding an account from itself', () => {
    expect(() =>
      buildWalletFundingJournal(command, {
        fundingAccount: platformCash,
        walletAccount: platformCash,
      }),
    ).toThrow('Funding and wallet accounts must be different');
  });

  it.each(['EUR', 'GBP', 'EGP'] as const)('supports %s wallet funding', (currency) => {
    expect(
      buildWalletFundingJournal(
        { ...command, currency },
        {
          fundingAccount: { ...platformCash, id: `cash-${currency}`, currency },
          walletAccount: { ...aliceWallet, id: `alice-${currency}`, currency },
        },
      ),
    ).toMatchObject({
      currency,
      postings: [
        { accountId: `cash-${currency}`, side: 'DEBIT', amountMinor: 5_000 },
        { accountId: `alice-${currency}`, side: 'CREDIT', amountMinor: 5_000 },
      ],
    });
  });

  it('rejects an unsupported runtime currency', () => {
    expect(() =>
      buildWalletFundingJournal(
        { ...command, currency: 'JPY' as never },
        {
          fundingAccount: { ...platformCash, currency: 'JPY' as never },
          walletAccount: { ...aliceWallet, currency: 'JPY' as never },
        },
      ),
    ).toThrow('Unsupported wallet funding currency');
  });
});
