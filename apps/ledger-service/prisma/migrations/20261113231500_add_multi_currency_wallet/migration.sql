CREATE TABLE "Wallet" (
  "id" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletBalance" (
  "walletId" TEXT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "accountId" TEXT NOT NULL,
  CONSTRAINT "WalletBalance_pkey" PRIMARY KEY ("walletId", "currency")
);

CREATE UNIQUE INDEX "WalletBalance_accountId_key" ON "WalletBalance"("accountId");
CREATE INDEX "WalletBalance_currency_idx" ON "WalletBalance"("currency");

ALTER TABLE "WalletBalance" ADD CONSTRAINT "WalletBalance_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletBalance" ADD CONSTRAINT "WalletBalance_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Wallet" ("id", "ownerName") VALUES
  ('wallet-alice', 'Alice'),
  ('wallet-bob', 'Bob')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "WalletBalance" ("walletId", "currency", "accountId")
SELECT mapping."walletId", mapping."currency", mapping."accountId"
FROM (VALUES
  ('wallet-alice', 'USD', 'wallet-alice'),
  ('wallet-alice', 'EUR', 'wallet-alice-eur'),
  ('wallet-bob', 'USD', 'wallet-bob'),
  ('wallet-bob', 'GBP', 'wallet-bob-gbp')
) AS mapping("walletId", "currency", "accountId")
JOIN "Account" account ON account."id" = mapping."accountId"
ON CONFLICT DO NOTHING;
