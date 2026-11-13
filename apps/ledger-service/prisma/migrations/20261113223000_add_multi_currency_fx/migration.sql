ALTER TYPE "IdempotencyOperation" ADD VALUE 'CREATE_FX_CONVERSION';

ALTER TABLE "Journal" ALTER COLUMN "currency" DROP NOT NULL;
ALTER TABLE "Journal" ADD COLUMN "fxConversionId" TEXT;
ALTER TABLE "Posting" ADD COLUMN "currency" VARCHAR(3);

UPDATE "Posting" AS posting
SET "currency" = account."currency"
FROM "Account" AS account
WHERE account."id" = posting."accountId";

ALTER TABLE "Posting" ALTER COLUMN "currency" SET NOT NULL;

CREATE TABLE "FxQuote" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sourceCurrency" VARCHAR(3) NOT NULL,
  "destinationCurrency" VARCHAR(3) NOT NULL,
  "sourceAmountMinor" BIGINT NOT NULL,
  "destinationAmountMinor" BIGINT NOT NULL,
  "rateDecimal" TEXT NOT NULL,
  "rateNumerator" BIGINT NOT NULL,
  "rateDenominator" BIGINT NOT NULL,
  "rateDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FxQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FxConversion" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "sourceAccountId" TEXT NOT NULL,
  "destinationAccountId" TEXT NOT NULL,
  "sourceAmountMinor" BIGINT NOT NULL,
  "destinationAmountMinor" BIGINT NOT NULL,
  "sourceCurrency" VARCHAR(3) NOT NULL,
  "destinationCurrency" VARCHAR(3) NOT NULL,
  "rateDecimal" TEXT NOT NULL,
  "journalId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FxConversion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FxQuote_sourceCurrency_destinationCurrency_createdAt_idx" ON "FxQuote"("sourceCurrency", "destinationCurrency", "createdAt");
CREATE INDEX "FxQuote_expiresAt_idx" ON "FxQuote"("expiresAt");
CREATE UNIQUE INDEX "FxConversion_idempotencyKey_key" ON "FxConversion"("idempotencyKey");
CREATE UNIQUE INDEX "FxConversion_journalId_key" ON "FxConversion"("journalId");
CREATE INDEX "FxConversion_createdAt_idx" ON "FxConversion"("createdAt");
CREATE INDEX "FxConversion_quoteId_idx" ON "FxConversion"("quoteId");
CREATE INDEX "Journal_fxConversionId_createdAt_idx" ON "Journal"("fxConversionId", "createdAt");

ALTER TABLE "FxConversion" ADD CONSTRAINT "FxConversion_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "FxQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FxConversion" ADD CONSTRAINT "FxConversion_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FxConversion" ADD CONSTRAINT "FxConversion_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_fxConversionId_fkey" FOREIGN KEY ("fxConversionId") REFERENCES "FxConversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
