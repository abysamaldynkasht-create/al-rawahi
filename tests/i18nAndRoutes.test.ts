/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Automated Test Suite: Phase 2 Bilingual Registry & View Routing
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTE_REGISTRY, TRANSLATIONS, type RouteId } from '../src/i18n/translations.ts';
import { formatOMR } from '../src/core/currency.ts';

test('Phase 2 Bilingual & Route Registry Suite', async (t) => {
  await t.test('1. All application routes are registered with bilingual metadata', () => {
    const expectedRoutes: RouteId[] = [
      'dashboard',
      'customers',
      'vehicles',
      'registerMaintenance',
      'vehicleHandover',
      'repairOrders',
      'technicians',
      'inventory',
      'invoices',
      'payments',
      'expenses',
      'cashRegister',
      'suppliers',
      'reports',
      'settings',
      'diagnostics',
    ];

    assert.equal(Object.keys(ROUTE_REGISTRY).length, expectedRoutes.length);

    for (const routeId of expectedRoutes) {
      const meta = ROUTE_REGISTRY[routeId];
      assert.ok(meta, `Route ${routeId} must exist in ROUTE_REGISTRY`);
      assert.ok(meta.labelAr.length > 0, `Route ${routeId} must have an Arabic label`);
      assert.ok(meta.labelEn.length > 0, `Route ${routeId} must have an English label`);
      assert.ok(meta.descriptionAr.length > 0, `Route ${routeId} must have an Arabic description`);
      assert.ok(meta.descriptionEn.length > 0, `Route ${routeId} must have an English description`);
      assert.ok(typeof meta.phasePlanned === 'number', `Route ${routeId} must have a planned phase number`);
    }
  });

  await t.test('2. Phase roadmap numbers are correctly mapped across all modules', () => {
    assert.equal(ROUTE_REGISTRY.dashboard.phasePlanned, 2);
    assert.equal(ROUTE_REGISTRY.customers.phasePlanned, 3);
    assert.equal(ROUTE_REGISTRY.vehicles.phasePlanned, 3);
    assert.equal(ROUTE_REGISTRY.repairOrders.phasePlanned, 4);
    assert.equal(ROUTE_REGISTRY.technicians.phasePlanned, 4);
    assert.equal(ROUTE_REGISTRY.inventory.phasePlanned, 5);
    assert.equal(ROUTE_REGISTRY.suppliers.phasePlanned, 5);
    assert.equal(ROUTE_REGISTRY.invoices.phasePlanned, 6);
    assert.equal(ROUTE_REGISTRY.payments.phasePlanned, 6);
    assert.equal(ROUTE_REGISTRY.expenses.phasePlanned, 7);
    assert.equal(ROUTE_REGISTRY.cashRegister.phasePlanned, 7);
    assert.equal(ROUTE_REGISTRY.reports.phasePlanned, 8);
    assert.equal(ROUTE_REGISTRY.settings.phasePlanned, 9);
  });

  await t.test('3. Arabic and English dictionaries have matching translation keys', () => {
    const arKeys = Object.keys(TRANSLATIONS.ar);
    const enKeys = Object.keys(TRANSLATIONS.en);

    assert.equal(arKeys.length, enKeys.length, 'Arabic and English dictionaries must have the exact same number of keys');

    for (const key of arKeys) {
      assert.ok(
        key in TRANSLATIONS.en,
        `Key '${key}' found in Arabic dictionary but missing in English dictionary`
      );
    }
  });

  await t.test('4. Currency formatting in Arabic and English adheres strictly to 3 decimal places', () => {
    const formattedAr = formatOMR(10.5, { arabicLabel: true });
    assert.equal(formattedAr, '10.500 ر.ع.');

    const formattedEn = formatOMR(10.5, { arabicLabel: false });
    assert.equal(formattedEn, '10.500 OMR');

    const formattedThousands = formatOMR(1250, { useThousandsSeparator: true });
    assert.equal(formattedThousands, '1,250.000 OMR');
  });
});
