const LOCALE_BY_CURRENCY: Record<string, string> = {
  SAR: "ar-SA",
  EGP: "ar-EG",
  USD: "en-US",
  AED: "ar-AE",
  EUR: "en-IE",
};

export function fmtMoney(
  value: number | string | null | undefined,
  currency: string = "SAR"
): string {
  const amount = Number(value ?? 0);
  const code = (currency || "SAR").toUpperCase();
  const locale = LOCALE_BY_CURRENCY[code] || "en";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${(Number.isFinite(amount) ? amount : 0).toLocaleString(locale, {
      maximumFractionDigits: 2,
    })} ${code}`;
  }
}

export const BASE_CURRENCY = "SAR";
export const BASE_CURRENCY_LABEL_EN = "SAR (Base)";
export const BASE_CURRENCY_LABEL_AR = "ر.س (محول)";
