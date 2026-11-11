CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY');
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'SETTLED', 'REVERSED', 'FAILED');
CREATE TYPE "PostingSide" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'SETTLED', 'FAILED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED');
CREATE TYPE "IdempotencyOperation" AS ENUM ('CREATE_TRANSFER', 'REVERSE_TRANSFER');

CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AccountType" NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "balanceMinor" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transfer" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "sourceAccountId" TEXT NOT NULL,
  "destinationAccountId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "reference" TEXT NOT NULL,
  "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
  "journalId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settledAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),
  CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Journal" (
  "id" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "reference" TEXT NOT NULL,
  "reversalOfJournalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Posting" (
  "id" TEXT NOT NULL,
  "journalId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "side" "PostingSide" NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Posting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdempotencyRecord" (
  "key" TEXT NOT NULL,
  "operation" "IdempotencyOperation" NOT NULL,
  "requestHash" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "OutboxEvent" (
  "id" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Settlement" (
  "id" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessedEvent" (
  "eventId" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("eventId")
);

CREATE UNIQUE INDEX "Account_code_key" ON "Account"("code");
CREATE UNIQUE INDEX "Transfer_idempotencyKey_key" ON "Transfer"("idempotencyKey");
CREATE UNIQUE INDEX "Transfer_journalId_key" ON "Transfer"("journalId");
CREATE INDEX "Transfer_createdAt_idx" ON "Transfer"("createdAt");
CREATE INDEX "Transfer_status_createdAt_idx" ON "Transfer"("status", "createdAt");
CREATE UNIQUE INDEX "Journal_reversalOfJournalId_key" ON "Journal"("reversalOfJournalId");
CREATE INDEX "Journal_transferId_createdAt_idx" ON "Journal"("transferId", "createdAt");
CREATE INDEX "Posting_journalId_idx" ON "Posting"("journalId");
CREATE INDEX "Posting_accountId_createdAt_idx" ON "Posting"("accountId", "createdAt");
CREATE INDEX "IdempotencyRecord_resourceId_idx" ON "IdempotencyRecord"("resourceId");
CREATE INDEX "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");
CREATE UNIQUE INDEX "Settlement_transferId_key" ON "Settlement"("transferId");
CREATE UNIQUE INDEX "Settlement_eventId_key" ON "Settlement"("eventId");
CREATE INDEX "Settlement_status_createdAt_idx" ON "Settlement"("status", "createdAt");

ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_reversalOfJournalId_fkey" FOREIGN KEY ("reversalOfJournalId") REFERENCES "Journal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
