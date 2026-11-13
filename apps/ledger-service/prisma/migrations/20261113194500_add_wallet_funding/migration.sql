ALTER TYPE "IdempotencyOperation" ADD VALUE 'CREATE_WALLET_FUNDING';

ALTER TABLE "Journal" ALTER COLUMN "transferId" DROP NOT NULL;
ALTER TABLE "Journal" ADD COLUMN "fundingId" TEXT;

CREATE TABLE "WalletFunding" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "fundingAccountId" TEXT NOT NULL,
  "walletAccountId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "reference" TEXT NOT NULL,
  "journalId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletFunding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletFunding_idempotencyKey_key" ON "WalletFunding"("idempotencyKey");
CREATE UNIQUE INDEX "WalletFunding_journalId_key" ON "WalletFunding"("journalId");
CREATE INDEX "WalletFunding_createdAt_idx" ON "WalletFunding"("createdAt");
CREATE INDEX "WalletFunding_walletAccountId_createdAt_idx" ON "WalletFunding"("walletAccountId", "createdAt");
CREATE INDEX "Journal_fundingId_createdAt_idx" ON "Journal"("fundingId", "createdAt");

ALTER TABLE "WalletFunding" ADD CONSTRAINT "WalletFunding_fundingAccountId_fkey" FOREIGN KEY ("fundingAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletFunding" ADD CONSTRAINT "WalletFunding_walletAccountId_fkey" FOREIGN KEY ("walletAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_fundingId_fkey" FOREIGN KEY ("fundingId") REFERENCES "WalletFunding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
