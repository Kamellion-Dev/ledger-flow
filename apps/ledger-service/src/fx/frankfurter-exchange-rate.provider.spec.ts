import { describe, expect, it, vi } from 'vitest';
import { FrankfurterExchangeRateProvider } from './frankfurter-exchange-rate.provider.js';

const completeCsv = `date,base,quote,rate
2026-11-13,USD,EGP,53.557
2026-11-13,USD,EUR,0.90244
2026-11-13,USD,GBP,0.75368
`;

describe('FrankfurterExchangeRateProvider', () => {
  it('preserves exact rate text when Frankfurter returns its default JSON representation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('[{"date":"2026-11-13","base":"USD","quote":"EUR","rate":0.90244}]', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      new FrankfurterExchangeRateProvider(fetcher).getRate('USD', 'EUR'),
    ).resolves.toEqual({
      provider: 'frankfurter',
      base: 'USD',
      quote: 'EUR',
      decimal: '0.90244',
      effectiveDate: '2026-11-13',
    });
  });

  it('requests CSV and returns the exact decimal text for the requested pair', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(completeCsv, {
        status: 200,
        headers: { 'content-type': 'text/csv' },
      }),
    );
    const provider = new FrankfurterExchangeRateProvider(fetcher, 'https://rates.example/v2', 3210);

    await expect(provider.getRate('USD', 'EUR')).resolves.toEqual({
      provider: 'frankfurter',
      base: 'USD',
      quote: 'EUR',
      decimal: '0.90244',
      effectiveDate: '2026-11-13',
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://rates.example/v2/rates?base=USD&quotes=EUR');
    expect(init?.headers).toEqual({ accept: 'text/csv' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects an unsuccessful provider response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('upstream down', { status: 503 }));
    const provider = new FrankfurterExchangeRateProvider(fetcher);

    await expect(provider.getRate('USD', 'EUR')).rejects.toThrow('503');
  });

  it.each([
    ['missing row', 'date,base,quote,rate\n2026-11-13,USD,GBP,0.75\n'],
    ['wrong header', 'when,base,quote,value\n2026-11-13,USD,EUR,0.90\n'],
    ['malformed row', 'date,base,quote,rate\n2026-11-13,USD,EUR\n'],
  ])('rejects %s CSV', async (_label, body) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 200 }));
    const provider = new FrankfurterExchangeRateProvider(fetcher);

    await expect(provider.getRate('USD', 'EUR')).rejects.toThrow('Frankfurter');
  });
});
