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

await prisma.$disconnect();
