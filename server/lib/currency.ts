import Decimal from "decimal.js";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { exchangeRates } from "../../drizzle/schema";

export const BASE_CURRENCY = "SAR";

export function normalizeCurrency(currency?: string | null): string {
  return (currency || BASE_CURRENCY).trim().toUpperCase();
}

export function toDecimalString(value: string | number | null | undefined): string {
  return new Decimal(value || 0).toDecimalPlaces(2).toFixed(2);
}

export async function getExchangeRate(
  fromCurrency?: string | null,
  toCurrency: string = BASE_CURRENCY
): Promise<Decimal> {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);

  if (from === to) return new Decimal(1);

  const [direct] = await db
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.fromCurrency, from),
        eq(exchangeRates.toCurrency, to)
      )
    )
    .orderBy(desc(exchangeRates.updatedAt))
    .limit(1);

  if (direct?.rate) {
    return new Decimal(direct.rate);
  }

  const [inverse] = await db
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.fromCurrency, to),
        eq(exchangeRates.toCurrency, from)
      )
    )
    .orderBy(desc(exchangeRates.updatedAt))
    .limit(1);

  if (inverse?.rate) {
    return new Decimal(1).div(new Decimal(inverse.rate));
  }

  console.warn(`Missing exchange rate for ${from} -> ${to}, defaulting to 1`);
  return new Decimal(1);
}

export async function convertMoney(
  amount: string | number | null | undefined,
  fromCurrency?: string | null,
  toCurrency: string = BASE_CURRENCY
): Promise<string> {
  const value = new Decimal(amount || 0);
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return value.mul(rate).toDecimalPlaces(2).toFixed(2);
}

// Cached converter for batch operations (avoids repeated DB queries)
export function createCachedConverter() {
  const cache = new Map<string, Decimal>();

  return async (
    amount: string | number | null | undefined,
    fromCurrency?: string | null,
    toCurrency: string = BASE_CURRENCY
  ): Promise<Decimal> => {
    const from = normalizeCurrency(fromCurrency);
    const to = normalizeCurrency(toCurrency);
    const key = `${from}->${to}`;

    if (!cache.has(key)) {
      cache.set(key, await getExchangeRate(from, to));
    }

    const rate = cache.get(key)!;
    return new Decimal(amount || 0).mul(rate).toDecimalPlaces(2);
  };
}
