import { describe, expect, it, vi } from 'vitest';
import type {
  FxConversionView,
  FxQuoteView,
  TransferView,
  WalletFundingView,
  WalletView,
} from '@ledgerflow/contracts';
import { LedgerFlowApi } from './api-client';

const transfer: TransferView = {
  id: 'transfer-001',
  idempotencyKey: 'idem-001',
  sourceAccountId: 'wallet-alice',
  destinationAccountId: 'wallet-bob',
  amountMinor: 2500,
  currency: 'USD',
  reference: 'Dinner split',
  status: 'PENDING',
  journalId: 'journal-001',
  createdAt: '2026-11-13T18:00:00.000Z',
};

const funding: WalletFundingView = {
  id: 'funding-001',
  idempotencyKey: 'funding-key-001',
  fundingAccountId: 'platform-cash',
  walletAccountId: 'wallet-alice',
  walletName: 'Alice Wallet',
  amountMinor: 5_000,
  currency: 'USD',
  reference: 'Bank cash-in',
  journalId: 'funding-journal-001',
  createdAt: '2026-11-13T19:00:00.000Z',
};

describe('LedgerFlowApi', () => {
  it('lists wallets and creates a missing customer currency balance', async () => {
    const wallets: WalletView[] = [
      { id: 'wallet-alice', ownerName: 'Alice', balances: [{ currency: 'USD', balanceMinor: 0 }] },
    ];
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'demo-token' }), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(wallets), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...wallets[0],
            balances: [...wallets[0]!.balances, { currency: 'EGP', balanceMinor: 0 }],
          }),
          { status: 201 },
        ),
      );
    const api = new LedgerFlowApi(fetcher);

    await expect(api.listWallets()).resolves.toEqual(wallets);
    await api.createWalletBalance({ walletId: 'wallet-alice', currency: 'EGP' });

    expect(fetcher.mock.calls[1]?.[0]).toBe('/api/wallets');
    expect(fetcher.mock.calls[2]?.[0]).toBe('/api/wallets/wallet-alice/balances');
    expect(fetcher.mock.calls[2]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ currency: 'EGP' }),
    });
  });
  it('posts FX quote and conversion commands to their authenticated routes', async () => {
    const quote = { id: 'quote-001' } as FxQuoteView;
    const conversion = { id: 'conversion-001' } as FxConversionView;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'demo-token' }), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(quote), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(conversion), { status: 201 }));
    const api = new LedgerFlowApi(fetcher);

    await api.createFxQuote({
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      sourceAmountMinor: 10_000,
    });
    await api.createFxConversion(
      {
        quoteId: 'quote-001',
        sourceAccountId: 'wallet-usd',
        destinationAccountId: 'wallet-eur',
        reference: 'Travel money',
      },
      'fx-key-001',
    );

    expect(fetcher.mock.calls[1]?.[0]).toBe('/api/fx/quotes');
    expect(fetcher.mock.calls[2]?.[0]).toBe('/api/fx/conversions');
    expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get('idempotency-key')).toBe(
      'fx-key-001',
    );
  });

  it('posts a wallet funding with auth and the supplied idempotency key', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'demo-token', user: {} }), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(funding), { status: 201 }));
    const api = new LedgerFlowApi(fetcher);

    await expect(
      api.createWalletFunding(
        {
          walletId: 'wallet-alice',
          amountMinor: 5_000,
          currency: 'USD',
          reference: 'Bank cash-in',
        },
        'funding-key-001',
      ),
    ).resolves.toEqual(funding);

    const [path, init] = fetcher.mock.calls[1]!;
    expect(path).toBe('/api/wallet-fundings');
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        walletId: 'wallet-alice',
        amountMinor: 5_000,
        currency: 'USD',
        reference: 'Bank cash-in',
      }),
    });
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer demo-token');
    expect(headers.get('idempotency-key')).toBe('funding-key-001');
  });

  it('logs in once and sends the token and idempotency key with a transfer', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'demo-token', user: {} }), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(transfer), { status: 201 }));
    const api = new LedgerFlowApi(fetcher);

    const result = await api.createTransfer(
      {
        sourceWalletId: 'wallet-alice',
        destinationWalletId: 'wallet-bob',
        amountMinor: 2500,
        currency: 'USD',
        reference: 'Dinner split',
      },
      'idem-001',
    );

    expect(result).toEqual(transfer);
    const [loginPath, loginInit] = fetcher.mock.calls[0]!;
    expect(loginPath).toBe('/api/auth/login');
    expect(loginInit).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        email: 'operator@ledgerflow.local',
        password: 'ledgerflow-demo',
      }),
    });
    const [transferPath, transferInit] = fetcher.mock.calls[1]!;
    const transferHeaders = new Headers(transferInit?.headers);
    expect(transferPath).toBe('/api/transactions');
    expect(transferInit).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        sourceWalletId: 'wallet-alice',
        destinationWalletId: 'wallet-bob',
        amountMinor: 2500,
        currency: 'USD',
        reference: 'Dinner split',
      }),
    });
    expect(transferHeaders.get('authorization')).toBe('Bearer demo-token');
    expect(transferHeaders.get('idempotency-key')).toBe('idem-001');
  });

  it('reports the API message when a command is rejected', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'demo-token', user: {} }), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Insufficient simulated funds' }), { status: 409 }),
      );
    const api = new LedgerFlowApi(fetcher);

    await expect(
      api.createTransfer(
        {
          sourceWalletId: 'wallet-alice',
          destinationWalletId: 'wallet-bob',
          amountMinor: 999_999,
          currency: 'USD',
          reference: 'Too large',
        },
        'idem-rejected',
      ),
    ).rejects.toThrow('Insufficient simulated funds');
  });

  it('refreshes an expired token once and retries the protected request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'expired-token', user: {} }), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'fresh-token', user: {} }), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 25 }), {
          status: 200,
        }),
      );
    const api = new LedgerFlowApi(fetcher);

    await expect(api.listTransfers()).resolves.toMatchObject({ total: 0 });
    const [path, init] = fetcher.mock.calls.at(-1)!;
    expect(path).toBe('/api/transactions?page=1&pageSize=25');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fresh-token');
  });
});
