/**
 * Exchange Rate Auto-Sync Module
 * Fetches live exchange rates from free API (fawazahmed0/exchange-api)
 * and updates the database automatically.
 * Runs daily at startup and every 12 hours.
 */

import { upsertExchangeRate } from "./db";

const API_BASE = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies";
const FALLBACK_API = "https://latest.currency-api.pages.dev/v1/currencies";

// Currency pairs to sync (from -> to SAR)
const CURRENCY_PAIRS = [
  { from: "egp", to: "sar" },
  { from: "usd", to: "sar" },
];

interface FetchResult {
  from: string;
  to: string;
  rate: number;
  source: string;
}

async function fetchRate(fromCurrency: string, toCurrency: string): Promise<FetchResult | null> {
  const from = fromCurrency.toLowerCase();
  const to = toCurrency.toLowerCase();

  // Try primary API first
  for (const base of [API_BASE, FALLBACK_API]) {
    try {
      const url = `${base}/${from}.json`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) continue;
      const data = await response.json() as Record<string, any>;
      const rate = data?.[from]?.[to];
      if (rate && typeof rate === "number" && rate > 0) {
        return { from: from.toUpperCase(), to: to.toUpperCase(), rate, source: base };
      }
    } catch (err) {
      console.warn(`[ExchangeRateSync] Failed to fetch from ${base}:`, (err as Error).message);
    }
  }
  return null;
}

export async function syncExchangeRates(): Promise<{ updated: string[]; failed: string[] }> {
  console.log("[ExchangeRateSync] Starting exchange rate sync...");
  const updated: string[] = [];
  const failed: string[] = [];

  for (const pair of CURRENCY_PAIRS) {
    try {
      const result = await fetchRate(pair.from, pair.to);
      if (result) {
        const rateStr = result.rate.toFixed(8);
        await upsertExchangeRate(result.from, result.to, rateStr);
        console.log(`[ExchangeRateSync] Updated ${result.from} -> ${result.to}: ${rateStr} (source: ${result.source})`);
        updated.push(`${result.from}->${result.to}: ${rateStr}`);
      } else {
        console.warn(`[ExchangeRateSync] Could not fetch rate for ${pair.from} -> ${pair.to}`);
        failed.push(`${pair.from.toUpperCase()}->${pair.to.toUpperCase()}`);
      }
    } catch (err) {
      console.error(`[ExchangeRateSync] Error syncing ${pair.from} -> ${pair.to}:`, err);
      failed.push(`${pair.from.toUpperCase()}->${pair.to.toUpperCase()}`);
    }
  }

  // Always ensure SAR -> SAR = 1
  await upsertExchangeRate("SAR", "SAR", "1.00000000");

  console.log(`[ExchangeRateSync] Sync complete. Updated: ${updated.length}, Failed: ${failed.length}`);
  return { updated, failed };
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startExchangeRateScheduler(): void {
  console.log("[ExchangeRateSync] Starting exchange rate scheduler (every 12 hours)");

  // Run immediately on startup (with delay to let DB connect)
  setTimeout(() => {
    syncExchangeRates().catch((err) => {
      console.error("[ExchangeRateSync] Initial sync failed:", err);
    });
  }, 15000); // 15 seconds after startup

  // Then every 12 hours
  syncInterval = setInterval(() => {
    syncExchangeRates().catch((err) => {
      console.error("[ExchangeRateSync] Scheduled sync failed:", err);
    });
  }, 12 * 60 * 60 * 1000);
}

export function stopExchangeRateScheduler(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("[ExchangeRateSync] Scheduler stopped");
  }
}
