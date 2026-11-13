import type { Currency } from '@ledgerflow/contracts';
import {
  ExchangeRateProviderError,
  type ExchangeRateProvider,
  type ProviderRate,
} from './exchange-rate.provider.js';

const DEFAULT_BASE_URL = 'https://api.frankfurter.dev/v2';
const DEFAULT_TIMEOUT_MS = 5_000;

export class FrankfurterExchangeRateProvider implements ExchangeRateProvider {
  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly baseUrl = DEFAULT_BASE_URL,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async getRate(base: Currency, quote: Currency): Promise<ProviderRate> {
    const url = `${this.baseUrl.replace(/\/$/u, '')}/rates?base=${encodeURIComponent(base)}&quotes=${encodeURIComponent(quote)}`;
    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: { accept: 'text/csv' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new ExchangeRateProviderError('Frankfurter request failed', { cause: error });
    }
    if (!response.ok) {
      throw new ExchangeRateProviderError(`Frankfurter returned HTTP ${response.status}`);
    }

    const body = (await response.text()).replace(/^\uFEFF/u, '');
    if (body.trimStart().startsWith('[')) {
      return parseJsonRate(body, base, quote);
    }

    const rows = body
      .split(/\r?\n/u)
      .filter((line) => line.length > 0)
      .map((line) => line.split(','));
    const header = rows.shift();
    if (!header || header.join(',') !== 'date,base,quote,rate') {
      throw new ExchangeRateProviderError('Frankfurter CSV header is invalid');
    }
    for (const row of rows) {
      if (row.length !== 4) {
        throw new ExchangeRateProviderError('Frankfurter CSV row is invalid');
      }
      const [effectiveDate, rowBase, rowQuote, decimal] = row;
      if (rowBase === base && rowQuote === quote && effectiveDate && decimal) {
        return {
          provider: 'frankfurter',
          base,
          quote,
          decimal,
          effectiveDate,
        };
      }
    }
    throw new ExchangeRateProviderError(`Frankfurter CSV did not contain ${base}/${quote}`);
  }
}

function parseJsonRate(body: string, base: Currency, quote: Currency): ProviderRate {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch (error) {
    throw new ExchangeRateProviderError('Frankfurter JSON is invalid', { cause: error });
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new ExchangeRateProviderError('Frankfurter JSON must contain one rate');
  }
  const rows = parsed as unknown[];
  const row: unknown = rows[0];
  if (!row || typeof row !== 'object') {
    throw new ExchangeRateProviderError('Frankfurter JSON rate is invalid');
  }
  const record = row as Record<string, unknown>;
  if (record['base'] !== base || record['quote'] !== quote || typeof record['date'] !== 'string') {
    throw new ExchangeRateProviderError(`Frankfurter JSON did not contain ${base}/${quote}`);
  }
  return {
    provider: 'frankfurter',
    base,
    quote,
    decimal: extractJsonRateDecimal(body),
    effectiveDate: record['date'],
  };
}

function extractJsonRateDecimal(body: string): string {
  const keyIndex = body.indexOf('"rate"');
  if (keyIndex < 0) throw new ExchangeRateProviderError('Frankfurter JSON rate is missing');
  let cursor = keyIndex + '"rate"'.length;
  while (cursor < body.length && isWhitespace(body[cursor])) cursor += 1;
  if (body[cursor] !== ':') {
    throw new ExchangeRateProviderError('Frankfurter JSON rate is invalid');
  }
  cursor += 1;
  while (cursor < body.length && isWhitespace(body[cursor])) cursor += 1;
  const start = cursor;
  while (cursor < body.length && isDecimalCharacter(body[cursor])) cursor += 1;
  if (cursor === start) throw new ExchangeRateProviderError('Frankfurter JSON rate is invalid');
  return body.slice(start, cursor);
}

function isWhitespace(character: string | undefined): boolean {
  return character === ' ' || character === '\n' || character === '\r' || character === '\t';
}

function isDecimalCharacter(character: string | undefined): boolean {
  return character === '.' || (character !== undefined && character >= '0' && character <= '9');
}
