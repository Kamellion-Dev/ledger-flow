import type {
  AccountView,
  DashboardSummary,
  JournalView,
  SettlementView,
  TransferView,
} from '@ledgerflow/contracts';

export const demoTransfers: TransferView[] = [
  {
    id: 'trf_7N2K8A',
    idempotencyKey: 'demo-001',
    sourceAccountId: 'wallet-alice',
    destinationAccountId: 'wallet-bob',
    amountMinor: 2500,
    currency: 'USD',
    reference: 'Dinner split',
    status: 'SETTLED',
    journalId: 'jnl_3H9P2M',
    createdAt: '2026-11-11T19:47:00.000Z',
    settledAt: '2026-11-11T19:47:02.000Z',
  },
  {
    id: 'trf_4C8W1Q',
    idempotencyKey: 'demo-002',
    sourceAccountId: 'wallet-bob',
    destinationAccountId: 'wallet-alice',
    amountMinor: 4875,
    currency: 'USD',
    reference: 'Supplier refund',
    status: 'PENDING',
    journalId: 'jnl_8R4L6D',
    createdAt: '2026-11-11T19:58:00.000Z',
  },
  {
    id: 'trf_2B5J9X',
    idempotencyKey: 'demo-003',
    sourceAccountId: 'wallet-alice',
    destinationAccountId: 'wallet-bob',
    amountMinor: 12000,
    currency: 'USD',
    reference: 'Monthly allocation',
    status: 'SETTLED',
    journalId: 'jnl_5T1K7V',
    createdAt: '2026-11-11T18:32:00.000Z',
    settledAt: '2026-11-11T18:32:02.000Z',
  },
];

export const demoSummary: DashboardSummary = {
  totalVolumeMinor: 182_450,
  settledVolumeMinor: 167_200,
  pendingCount: 3,
  settledCount: 42,
  failedCount: 1,
  accountCount: 3,
  recentTransfers: demoTransfers,
  volumeByHour: [
    { hour: '2026-11-11T14:00:00.000Z', amountMinor: 18_000 },
    { hour: '2026-11-11T15:00:00.000Z', amountMinor: 27_500 },
    { hour: '2026-11-11T16:00:00.000Z', amountMinor: 21_900 },
    { hour: '2026-11-11T17:00:00.000Z', amountMinor: 42_400 },
    { hour: '2026-11-11T18:00:00.000Z', amountMinor: 31_800 },
    { hour: '2026-11-11T19:00:00.000Z', amountMinor: 40_850 },
  ],
  generatedAt: '2026-11-11T20:00:00.000Z',
};

export const demoAccounts: AccountView[] = [
  {
    id: 'wallet-alice',
    code: '2100-ALICE',
    name: 'Alice Wallet',
    type: 'LIABILITY',
    currency: 'USD',
    balanceMinor: 10_000,
  },
  {
    id: 'wallet-bob',
    code: '2100-BOB',
    name: 'Bob Wallet',
    type: 'LIABILITY',
    currency: 'USD',
    balanceMinor: 5_000,
  },
];

export const demoJournal: JournalView = {
  id: 'jnl_3H9P2M',
  transferId: 'trf_7N2K8A',
  currency: 'USD',
  reference: 'Dinner split',
  createdAt: '2026-11-11T19:47:00.000Z',
  postings: [
    {
      id: 'pst_1',
      accountId: 'wallet-alice',
      accountCode: '2100-ALICE',
      accountName: 'Alice Wallet',
      side: 'DEBIT',
      amountMinor: 2500,
    },
    {
      id: 'pst_2',
      accountId: 'wallet-bob',
      accountCode: '2100-BOB',
      accountName: 'Bob Wallet',
      side: 'CREDIT',
      amountMinor: 2500,
    },
  ],
};

export const demoSettlements: SettlementView[] = [
  {
    id: 'stl_trf_7N2K8A',
    transferId: 'trf_7N2K8A',
    eventId: 'evt_7N2K8A',
    status: 'SETTLED',
    attemptCount: 1,
    createdAt: '2026-11-11T19:47:01.000Z',
    completedAt: '2026-11-11T19:47:02.000Z',
  },
  {
    id: 'stl_trf_4C8W1Q',
    transferId: 'trf_4C8W1Q',
    eventId: 'evt_4C8W1Q',
    status: 'PENDING',
    attemptCount: 1,
    createdAt: '2026-11-11T19:58:01.000Z',
  },
];
