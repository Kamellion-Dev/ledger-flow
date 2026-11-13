import type {
  AccountView,
  Currency,
  DashboardSummary,
  FxConversionView,
  FxQuoteView,
  JournalView,
  Page,
  SettlementView,
  TransferView,
  WalletFundingView,
  WalletView,
} from '@ledgerflow/contracts';

export interface NewTransfer {
  sourceWalletId: string;
  destinationWalletId: string;
  amountMinor: number;
  currency: Currency;
  reference: string;
}

export interface NewWalletFunding {
  walletId: string;
  amountMinor: number;
  currency: Currency;
  reference: string;
}

export interface NewWalletBalance {
  walletId: string;
  currency: Currency;
}

export interface NewFxQuote {
  sourceCurrency: Currency;
  destinationCurrency: Currency;
  sourceAmountMinor: number;
}

export interface NewFxConversion {
  quoteId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  reference: string;
}

export interface LedgerFlowApiPort {
  createFxQuote(input: NewFxQuote): Promise<FxQuoteView>;
  createFxConversion(input: NewFxConversion, idempotencyKey: string): Promise<FxConversionView>;
  listFxConversions(): Promise<Page<FxConversionView>>;
  getSummary(): Promise<DashboardSummary>;
  listAccounts(): Promise<AccountView[]>;
  listWallets(): Promise<WalletView[]>;
  createWalletBalance(input: NewWalletBalance): Promise<WalletView>;
  listTransfers(): Promise<Page<TransferView>>;
  listSettlements(): Promise<Page<SettlementView>>;
  getJournal(id: string): Promise<JournalView>;
  createTransfer(input: NewTransfer, idempotencyKey: string): Promise<TransferView>;
  listWalletFundings(): Promise<Page<WalletFundingView>>;
  createWalletFunding(input: NewWalletFunding, idempotencyKey: string): Promise<WalletFundingView>;
}

interface ErrorBody {
  message?: string | string[];
}

export class LedgerFlowApi implements LedgerFlowApiPort {
  private accessToken: string | undefined;

  constructor(private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  getSummary(): Promise<DashboardSummary> {
    return this.request('/api/dashboard/summary');
  }

  createFxQuote(input: NewFxQuote): Promise<FxQuoteView> {
    return this.request('/api/fx/quotes', { method: 'POST', body: JSON.stringify(input) });
  }

  createFxConversion(input: NewFxConversion, idempotencyKey: string): Promise<FxConversionView> {
    return this.request('/api/fx/conversions', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    });
  }

  listFxConversions(): Promise<Page<FxConversionView>> {
    return this.request('/api/fx/conversions?page=1&pageSize=25');
  }

  listAccounts(): Promise<AccountView[]> {
    return this.request('/api/accounts');
  }

  async listWallets(): Promise<WalletView[]> {
    return this.request<WalletView[]>('/api/wallets');
  }

  createWalletBalance(input: NewWalletBalance): Promise<WalletView> {
    return this.request(`/api/wallets/${encodeURIComponent(input.walletId)}/balances`, {
      method: 'POST',
      body: JSON.stringify({ currency: input.currency }),
    });
  }

  listTransfers(): Promise<Page<TransferView>> {
    return this.request('/api/transactions?page=1&pageSize=25');
  }

  listSettlements(): Promise<Page<SettlementView>> {
    return this.request('/api/settlements?page=1&pageSize=25');
  }

  getJournal(id: string): Promise<JournalView> {
    return this.request(`/api/journals/${encodeURIComponent(id)}`);
  }

  createTransfer(input: NewTransfer, idempotencyKey: string): Promise<TransferView> {
    return this.request('/api/transactions', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    });
  }

  listWalletFundings(): Promise<Page<WalletFundingView>> {
    return this.request('/api/wallet-fundings?page=1&pageSize=25');
  }

  createWalletFunding(input: NewWalletFunding, idempotencyKey: string): Promise<WalletFundingView> {
    return this.request('/api/wallet-fundings', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    });
  }

  private async login(): Promise<string> {
    const response = await this.fetcher('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'operator@ledgerflow.local',
        password: 'ledgerflow-demo',
      }),
    });
    if (!response.ok) throw await this.errorFrom(response);
    const body = (await response.json()) as { accessToken: string };
    this.accessToken = body.accessToken;
    return body.accessToken;
  }

  private async request<T>(path: string, init: RequestInit = {}, canRetry = true): Promise<T> {
    const token = this.accessToken ?? (await this.login());
    const response = await this.fetcher(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...this.toHeaders(init.headers),
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.status === 401 && canRetry) {
      this.accessToken = undefined;
      return this.request<T>(path, init, false);
    }
    if (!response.ok) throw await this.errorFrom(response);
    return (await response.json()) as T;
  }

  private toHeaders(headers: HeadersInit | undefined): Record<string, string> {
    return Object.fromEntries(new Headers(headers).entries());
  }

  private async errorFrom(response: Response): Promise<Error> {
    try {
      const body = (await response.json()) as ErrorBody;
      const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      if (message) return new Error(message);
    } catch {
      // A non-JSON response falls back to the HTTP status below.
    }
    return new Error(`LedgerFlow request failed with HTTP ${response.status}`);
  }
}
