/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Unit Tests for Currency Formatting & Financial Arithmetic
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toBaisa,
  fromBaisa,
  formatOMR,
  formatBaisa,
  parseOMR,
  baisaAdd,
  baisaSubtract,
  baisaMultiply,
  baisaDivide,
  calculateInvoiceTotals,
  calculateBalanceDue,
} from '../src/core/currency.ts';

test('1. Exact 3-decimal formatting with period decimal separator for OMR examples', () => {
  // Test the user's specific examples
  assert.equal(formatOMR(10.5), '10.500 OMR');
  assert.equal(formatOMR(2.25), '2.250 OMR');
  assert.equal(formatOMR(0.125), '0.125 OMR');
  assert.equal(formatOMR(125), '125.000 OMR');

  // Verify that decimal separator is strictly a period (.)
  const formatted = formatOMR(10.5);
  assert.match(formatted, /^10\.500 OMR$/);
  assert.equal(formatted.includes(','), false);
});

test('2. Formatting with and without currency codes & Arabic label', () => {
  assert.equal(formatOMR(10.5, { showCode: false }), '10.500');
  assert.equal(formatOMR(2.25, { arabicLabel: true }), '2.250 ر.ع.');
  assert.equal(formatOMR(0, { showCode: true }), '0.000 OMR');
  assert.equal(formatOMR(-5.5, { showCode: false }), '-5.500');
});

test('3. Thousands separator formatting does not confuse decimal separator', () => {
  // 1250.000 with thousands separator
  const formattedThousands = formatOMR(1250, { useThousandsSeparator: true });
  assert.equal(formattedThousands, '1,250.000 OMR');

  // Verify thousands separator is comma and decimal separator is strictly period
  const parts = formattedThousands.split(' ')[0].split('.');
  assert.equal(parts[0], '1,250');
  assert.equal(parts[1], '000');
});

test('4. Baisa conversion (toBaisa and fromBaisa) eliminates floating-point drift', () => {
  // Classical JS float issues: 0.1 + 0.2 = 0.30000000000000004
  const sumFloat = 0.1 + 0.2;
  assert.equal(toBaisa(sumFloat), 300); // 300 Baisa = 0.300 OMR

  assert.equal(toBaisa(10.5), 10500);
  assert.equal(toBaisa(2.25), 2250);
  assert.equal(toBaisa(0.125), 125);
  assert.equal(toBaisa(125), 125000);
  assert.equal(toBaisa('10.500 OMR'), 10500);

  assert.equal(fromBaisa(10500), 10.5);
  assert.equal(fromBaisa(125), 0.125);
  assert.equal(fromBaisa(125000), 125);
  assert.equal(formatBaisa(10500), '10.500 OMR');
});

test('5. parseOMR safely parses various input strings', () => {
  assert.equal(parseOMR('10.500 OMR'), 10.5);
  assert.equal(parseOMR('1,250.000 OMR'), 1250);
  assert.equal(parseOMR('0.125 ر.ع.'), 0.125);
  assert.equal(parseOMR('  45.750  '), 45.75);
  assert.equal(parseOMR('abc'), 0);
  assert.equal(parseOMR(''), 0);
});

test('6. Integer Baisa arithmetic is strictly deterministic', () => {
  // Addition
  assert.equal(baisaAdd(10500, 2250, 125), 12875); // 12.875 OMR
  assert.equal(formatBaisa(baisaAdd(10500, 2250, 125)), '12.875 OMR');

  // Subtraction
  assert.equal(baisaSubtract(10500, 2250), 8250); // 8.250 OMR

  // Multiplication (rounding half-up)
  assert.equal(baisaMultiply(125, 3), 375); // 0.125 * 3 = 0.375 OMR
  assert.equal(baisaMultiply(333, 3), 999);

  // Division
  assert.equal(baisaDivide(1000, 3), 333); // 1.000 / 3 = 0.333 OMR
});

test('7. Tax calculations and invoice totals with 5% Omani VAT', () => {
  // Example scenario:
  // Part 1: Oil filter, qty 1 @ 3.500 OMR (3500 baisa), cost 2.000 OMR (2000 baisa)
  // Part 2: Engine oil 4L, qty 4 @ 4.250 OMR (4250 baisa), cost 3.000 OMR (3000 baisa)
  // Labor: Oil & filter replacement, qty 1 @ 5.000 OMR (5000 baisa)
  // Discount: 1.000 OMR (1000 baisa)
  // Tax rate: 5% (Omani standard VAT)

  const parts = [
    { quantity: 1, unitPriceBaisa: 3500, costPriceBaisa: 2000 },
    { quantity: 4, unitPriceBaisa: 4250, costPriceBaisa: 3000 },
  ];
  const labor = [
    { quantity: 1, unitPriceBaisa: 5000 },
  ];

  const totals = calculateInvoiceTotals(parts, labor, 1000, 5);

  // Parts subtotal: 3500 + (4 * 4250 = 17000) = 20500 Baisa (20.500 OMR)
  assert.equal(totals.subtotalPartsBaisa, 20500);
  assert.equal(formatBaisa(totals.subtotalPartsBaisa), '20.500 OMR');

  // COGS: 2000 + (4 * 3000 = 12000) = 14000 Baisa (14.000 OMR)
  assert.equal(totals.cogsBaisa, 14000);
  assert.equal(formatBaisa(totals.cogsBaisa), '14.000 OMR');

  // Labor subtotal: 5000 Baisa (5.000 OMR)
  assert.equal(totals.subtotalLaborBaisa, 5000);
  assert.equal(formatBaisa(totals.subtotalLaborBaisa), '5.000 OMR');

  // Total subtotal: 20500 + 5000 = 25500 Baisa (25.500 OMR)
  assert.equal(totals.subtotalBaisa, 25500);

  // Discount: 1000 Baisa (1.000 OMR)
  assert.equal(totals.discountBaisa, 1000);

  // Taxable amount: 25500 - 1000 = 24500 Baisa (24.500 OMR)
  assert.equal(totals.taxableAmountBaisa, 24500);

  // 5% Tax: 24500 * 0.05 = 1225 Baisa (1.225 OMR)
  assert.equal(totals.taxAmountBaisa, 1225);
  assert.equal(formatBaisa(totals.taxAmountBaisa), '1.225 OMR');

  // Grand Total: 24500 + 1225 = 25725 Baisa (25.725 OMR)
  assert.equal(totals.grandTotalBaisa, 25725);
  assert.equal(formatBaisa(totals.grandTotalBaisa), '25.725 OMR');
});

test('8. Partial payments and balance due calculations', () => {
  const grandTotalBaisa = 25725; // 25.725 OMR
  
  // Payment 1: 10.000 OMR (10000 baisa)
  const afterFirstPayment = calculateBalanceDue(grandTotalBaisa, [10000]);
  assert.equal(afterFirstPayment.totalPaidBaisa, 10000);
  assert.equal(afterFirstPayment.balanceDueBaisa, 15725); // 15.725 OMR
  assert.equal(afterFirstPayment.isPaidInFull, false);
  assert.equal(formatBaisa(afterFirstPayment.balanceDueBaisa), '15.725 OMR');

  // Payment 2: 15.725 OMR (15725 baisa) - Full clearance
  const afterSecondPayment = calculateBalanceDue(grandTotalBaisa, [10000, 15725]);
  assert.equal(afterSecondPayment.totalPaidBaisa, 25725);
  assert.equal(afterSecondPayment.balanceDueBaisa, 0);
  assert.equal(afterSecondPayment.isPaidInFull, true);
  assert.equal(formatBaisa(afterSecondPayment.balanceDueBaisa), '0.000 OMR');
});
