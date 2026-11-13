import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed LedgerFlow');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const accounts = [
  {
    id: 'platform-cash',
    code: '1000-CASH',
    name: 'Platform Cash',
    type: 'ASSET' as const,
    currency: 'USD',
    balanceMinor: 15_000n,
  },
  {
    id: 'wallet-alice',
    code: '2100-ALICE',
    name: 'Alice Wallet',
    type: 'LIABILITY' as const,
    currency: 'USD',
    balanceMinor: 10_000n,
  },
  {
    id: 'wallet-bob',
    code: '2100-BOB',
    name: 'Bob Wallet',
    type: 'LIABILITY' as const,
    currency: 'USD',
    balanceMinor: 5_000n,
  },
  ...(['EUR', 'GBP', 'EGP'] as const).map((currency) => ({
    id: `platform-cash-${currency.toLowerCase()}`,
    code: `1000-CASH-${currency}`,
    name: `Platform ${currency} Cash`,
    type: 'ASSET' as const,
    currency,
    balanceMinor: 0n,
  })),
  {
    id: 'wallet-alice-eur',
    code: '2100-ALICE-EUR',
    name: 'Alice EUR Balance',
    type: 'LIABILITY' as const,
    currency: 'EUR',
    balanceMinor: 0n,
  },
  {
    id: 'wallet-bob-gbp',
    code: '2100-BOB-GBP',
    name: 'Bob GBP Balance',
    type: 'LIABILITY' as const,
    currency: 'GBP',
    balanceMinor: 0n,
  },
];

for (const account of accounts) {
  await prisma.account.upsert({
    where: { id: account.id },
    create: account,
    update: {
      code: account.code,
      name: account.name,
      type: account.type,
      currency: account.currency,
    },
  });
}

for (const wallet of [
  { id: 'wallet-alice', ownerName: 'Alice' },
  { id: 'wallet-bob', ownerName: 'Bob' },
]) {
  await prisma.wallet.upsert({
    where: { id: wallet.id },
    create: wallet,
    update: { ownerName: wallet.ownerName },
  });
}

for (const balance of [
  { walletId: 'wallet-alice', currency: 'USD', accountId: 'wallet-alice' },
  { walletId: 'wallet-alice', currency: 'EUR', accountId: 'wallet-alice-eur' },
  { walletId: 'wallet-bob', currency: 'USD', accountId: 'wallet-bob' },
  { walletId: 'wallet-bob', currency: 'GBP', accountId: 'wallet-bob-gbp' },
]) {
  await prisma.walletBalance.upsert({
    where: {
      walletId_currency: { walletId: balance.walletId, currency: balance.currency },
    },
    create: balance,
    update: { accountId: balance.accountId },
  });
}

await prisma.$disconnect();
