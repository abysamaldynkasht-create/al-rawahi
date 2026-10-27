/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Currency & Financial Precision Module (Omani Rial / Baisa)
 * 
 * Rules:
 * 1. 1 OMR = 1000 Baisa.
 * 2. Internal financial calculations must use integer Baisa to prevent IEEE 754 floating-point drift.
 * 3. All monetary displays must use a period (.) as the decimal separator.
 * 4. Exactly 3 decimal digits must be displayed (e.g., 10.500 OMR, 2.250 OMR, 0.125 OMR, 125.000 OMR).
 * 5. Thousands separator must never be confused with the decimal separator.
 * 6. Default currency is OMR (Arabic: ر.ع.), configurable in settings.
 */

export interface CurrencyConfig {
  code: string;            // e.g., 'OMR'
  symbolArabic: string;    // e.g., 'ر.ع.'
  symbolEnglish: string;   // e.g., 'OMR'
  decimalPlaces: number;   // 3 for OMR
  decimalSeparator: string;// '.'
  thousandsSeparator: string; // ',' or ''
  baisaPerUnit: number;    // 1000
}

export const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  code: 'OMR',
  symbolArabic: 'ر.ع.',
  symbolEnglish: 'OMR',
  decimalPlaces: 3,
  decimalSeparator: '.',
  thousandsSeparator: ',',
  baisaPerUnit: 1000,
};

/**
 * Converts a decimal OMR amount (or string) into an integer Baisa representation.
 * Rounds half-up to nearest integer to eliminate floating-point drift.
 * 
 * Examples:
 *   toBaisa(10.5) => 10500
 *   toBaisa(2.25) => 2250
 *   toBaisa("0.125") => 125
 *   toBaisa(125) => 125000
 */
export function toBaisa(amountInOmr: number | string | null | undefined): number {
  if (amountInOmr === null || amountInOmr === undefined) {
    return 0;
  }
  const num = typeof amountInOmr === 'string' ? parseOMR(amountInOmr) : amountInOmr;
  if (!Number.isFinite(num)) {
    return 0;
  }
  // Math.round handles half-up for positive numbers
  return Math.round(num * 1000);
}

/**
 * Converts an integer Baisa amount back into a decimal OMR number.
 * 
 * Examples:
 *   fromBaisa(10500) => 10.5
 *   fromBaisa(125) => 0.125
 */
export function fromBaisa(baisa: number): number {
  if (!Number.isFinite(baisa)) {
    return 0;
  }
  return baisa / 1000;
}

export interface FormatOptions {
  /** If true or omitted, appends the currency symbol / code (e.g. "OMR") */
  showCode?: boolean;
  /** If true, uses Arabic currency label 'ر.ع.' instead of 'OMR' */
  arabicLabel?: boolean;
  /** If true, inserts comma thousands separators (e.g. 1,250.000 instead of 1250.000). Default true. */
  useThousandsSeparator?: boolean;
  /** Custom currency configuration override */
  config?: Partial<CurrencyConfig>;
}

/**
 * Formats any monetary amount (decimal OMR or integer Baisa if specified) with:
 * - Exactly three digits after the decimal point
 * - Period (.) strictly as the decimal separator
 * - Guaranteed compliance with Omani Rial standards
 * 
 * Examples:
 *   formatOMR(10.5)              => "10.500 OMR"
 *   formatOMR(2.25)              => "2.250 OMR"
 *   formatOMR(0.125)             => "0.125 OMR"
 *   formatOMR(125)               => "125.000 OMR"
 *   formatOMR(1250, { useThousandsSeparator: true }) => "1,250.000 OMR"
 *   formatOMR(10.5, { arabicLabel: true })           => "10.500 ر.ع."
 *   formatOMR(10.5, { showCode: false })             => "10.500"
 */
export function formatOMR(
  amount: number | string | null | undefined,
  options: FormatOptions = {}
): string {
  const {
    showCode = true,
    arabicLabel = false,
    useThousandsSeparator = false, // clean standard display
    config: customConfig,
  } = options;

  const config = { ...DEFAULT_CURRENCY_CONFIG, ...customConfig };

  let num: number;
  if (typeof amount === 'string') {
    num = parseOMR(amount);
  } else if (typeof amount === 'number') {
    num = Number.isFinite(amount) ? amount : 0;
  } else {
    num = 0;
  }

  // Work with integer baisa to ensure deterministic rounding
  const isNegative = num < 0;
  const absBaisa = Math.abs(Math.round(num * 1000));

  const integerPart = Math.floor(absBaisa / 1000);
  const fractionalPart = absBaisa % 1000;

  // Format fractional part to exactly 3 digits with leading zeros
  const formattedFraction = fractionalPart.toString().padStart(3, '0');

  // Format integer part (with optional thousands separator)
  let formattedInteger = integerPart.toString();
  if (useThousandsSeparator) {
    formattedInteger = formattedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Strict period (.) as decimal separator
  const formattedNumber = `${isNegative ? '-' : ''}${formattedInteger}.${formattedFraction}`;

  if (!showCode) {
    return formattedNumber;
  }

  const symbol = arabicLabel ? config.symbolArabic : config.symbolEnglish;
  return `${formattedNumber} ${symbol}`;
}

/**
 * Formats an amount given directly in integer Baisa.
 */
export function formatBaisa(baisaAmount: number, options: FormatOptions = {}): string {
  return formatOMR(fromBaisa(baisaAmount), options);
}

/**
 * Safely parses a user-entered monetary string into a decimal OMR number.
 * Strips whitespace, thousands separators (commas), and currency labels.
 * 
 * Examples:
 *   parseOMR("10.500 OMR") => 10.5
 *   parseOMR("1,250.000")  => 1250
 *   parseOMR("0.125 ر.ع.")  => 0.125
 *   parseOMR("invalid")    => 0
 */
export function parseOMR(input: string | null | undefined): number {
  if (!input) return 0;

  // Clean string: remove currency codes, Arabic symbols, and thousands commas
  const cleaned = input
    .replace(/[^\d.-]/g, '') // keep only digits, minus, and period
    .trim();

  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ============================================================================
// INTEGER BAISA ARITHMETIC (Deterministic & Decimal-Safe)
// ============================================================================

/**
 * Sums multiple Baisa amounts with zero floating-point error.
 */
export function baisaAdd(...amounts: number[]): number {
  return amounts.reduce((acc, curr) => acc + (Number.isFinite(curr) ? Math.round(curr) : 0), 0);
}

/**
 * Subtracts b from a in integer Baisa.
 */
export function baisaSubtract(a: number, b: number): number {
  return (Number.isFinite(a) ? Math.round(a) : 0) - (Number.isFinite(b) ? Math.round(b) : 0);
}

/**
 * Multiplies a Baisa amount by a factor (e.g. quantity or percentage).
 * Rounds to the nearest integer Baisa.
 */
export function baisaMultiply(baisa: number, factor: number): number {
  if (!Number.isFinite(baisa) || !Number.isFinite(factor)) return 0;
  return Math.round(baisa * factor);
}

/**
 * Divides a Baisa amount by a divisor with integer Baisa rounding.
 */
export function baisaDivide(baisa: number, divisor: number): number {
  if (!Number.isFinite(baisa) || !Number.isFinite(divisor) || divisor === 0) return 0;
  return Math.round(baisa / divisor);
}

// ============================================================================
// FINANCIAL & INVOICE CALCULATIONS (Tax & Totals in Baisa)
// ============================================================================

export interface InvoiceItemCalculationInput {
  quantity: number;
  unitPriceBaisa: number;
  costPriceBaisa?: number;
}

export interface InvoiceTotalsCalculation {
  subtotalPartsBaisa: number;
  subtotalLaborBaisa: number;
  subtotalBaisa: number;
  discountBaisa: number;
  taxableAmountBaisa: number;
  taxRatePercent: number;
  taxAmountBaisa: number;
  grandTotalBaisa: number;
  cogsBaisa: number; // Cost of goods sold for parts
}

/**
 * Deterministically computes invoice financial totals in integer Baisa.
 * Guarantees that:
 * 1. Subtotals = Sum of line totals (qty * unit price)
 * 2. Tax = Round(Taxable Amount * Tax Rate / 100)
 * 3. Grand Total = Taxable Amount + Tax
 * 4. COGS = Sum of (qty * cost price) for parts
 */
export function calculateInvoiceTotals(
  partsItems: InvoiceItemCalculationInput[],
  laborItems: InvoiceItemCalculationInput[],
  discountBaisa: number = 0,
  taxRatePercent: number = 5 // Default 5% Omani VAT
): InvoiceTotalsCalculation {
  // 1. Calculate parts subtotal and COGS
  let subtotalPartsBaisa = 0;
  let cogsBaisa = 0;

  for (const item of partsItems) {
    const lineTotal = baisaMultiply(item.unitPriceBaisa, item.quantity);
    subtotalPartsBaisa = baisaAdd(subtotalPartsBaisa, lineTotal);
    if (item.costPriceBaisa !== undefined) {
      cogsBaisa = baisaAdd(cogsBaisa, baisaMultiply(item.costPriceBaisa, item.quantity));
    }
  }

  // 2. Calculate labor subtotal
  let subtotalLaborBaisa = 0;
  for (const item of laborItems) {
    const lineTotal = baisaMultiply(item.unitPriceBaisa, item.quantity);
    subtotalLaborBaisa = baisaAdd(subtotalLaborBaisa, lineTotal);
  }

  const subtotalBaisa = baisaAdd(subtotalPartsBaisa, subtotalLaborBaisa);
  const validatedDiscount = Math.max(0, Math.min(discountBaisa, subtotalBaisa));
  const taxableAmountBaisa = baisaSubtract(subtotalBaisa, validatedDiscount);

  // 3. Tax calculation: round to nearest integer baisa
  const taxAmountBaisa = Math.round((taxableAmountBaisa * taxRatePercent) / 100);
  const grandTotalBaisa = baisaAdd(taxableAmountBaisa, taxAmountBaisa);

  return {
    subtotalPartsBaisa,
    subtotalLaborBaisa,
    subtotalBaisa,
    discountBaisa: validatedDiscount,
    taxableAmountBaisa,
    taxRatePercent,
    taxAmountBaisa,
    grandTotalBaisa,
    cogsBaisa,
  };
}

/**
 * Calculates remaining balance given grand total and array of payments in Baisa.
 */
export function calculateBalanceDue(
  grandTotalBaisa: number,
  paidAmountsBaisa: number[]
): { totalPaidBaisa: number; balanceDueBaisa: number; isPaidInFull: boolean } {
  const totalPaidBaisa = baisaAdd(...paidAmountsBaisa);
  const balanceDueBaisa = Math.max(0, baisaSubtract(grandTotalBaisa, totalPaidBaisa));
  return {
    totalPaidBaisa,
    balanceDueBaisa,
    isPaidInFull: balanceDueBaisa === 0 && grandTotalBaisa > 0,
  };
}
