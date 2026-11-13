FROM node:24-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api-gateway/package.json apps/api-gateway/package.json
COPY apps/ledger-service/package.json apps/ledger-service/package.json
COPY apps/settlement-worker/package.json apps/settlement-worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ledger-domain/package.json packages/ledger-domain/package.json

RUN npm ci --include=dev

COPY . .
RUN npm run build

EXPOSE 3000 50051
