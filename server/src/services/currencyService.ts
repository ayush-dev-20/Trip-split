import { env } from '../config/env';

interface ExchangeRates {
  [currency: string]: number;
}

let cachedRates: { base: string; rates: ExchangeRates; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetches latest exchange rates from the API.
 * Caches results for 1 hour.
 */
export async function getExchangeRates(baseCurrency = 'USD'): Promise<ExchangeRates> {
  if (
    cachedRates &&
    cachedRates.base === baseCurrency &&
    Date.now() - cachedRates.timestamp < CACHE_TTL
  ) {
    return cachedRates.rates;
  }

  try {
    const url = `${env.EXCHANGE_RATE_API_URL}/latest/${baseCurrency}`;
    const response = await fetch(url);
    const data: any = await response.json();

    cachedRates = {
      base: baseCurrency,
      rates: data.rates || data.conversion_rates || {},
      timestamp: Date.now(),
    };

    return cachedRates.rates;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    // Return basic fallback rates
    return { USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.5, JPY: 150.0 };
  }
}

/**
 * Convert an amount from one currency to another.
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ convertedAmount: number; exchangeRate: number }> {
  if (fromCurrency === toCurrency) {
    return { convertedAmount: amount, exchangeRate: 1 };
  }

  const rates = await getExchangeRates(fromCurrency);
  const rate = rates[toCurrency];

  if (!rate) {
    throw new Error(`Exchange rate not found for ${fromCurrency} -> ${toCurrency}`);
  }

  return {
    convertedAmount: Math.round(amount * rate * 100) / 100,
    exchangeRate: rate,
  };
}

/**
 * Get the exchange rate between two currencies.
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) return 1;
  const rates = await getExchangeRates(fromCurrency);
  return rates[toCurrency] || 1;
}
