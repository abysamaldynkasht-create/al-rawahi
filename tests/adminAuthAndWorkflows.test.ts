/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Automated Test Suite: Admin Authentication, Developer Code & Workflow Resilience
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { MIGRATIONS } from '../electron/database/migrator.ts';
import {
  hashPassword,
  verifyPassword,
  verifyDeveloperCode,
} from '../electron/auth/passwords.ts';
import { toBaisa, fromBaisa } from '../src/core/currency.ts';

test('Admin Authentication & Single Administrator Security Vault', async (t) => {
  let db: Database.Database;

  const setupDb = () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Run all migrations 1 to 8
    for (const migration of MIGRATIONS) {
      db.exec(migration.sql);
    }

    // Seed default admin
    const defaultUser = 'admin9988';
    const defaultPass = '1122334455';
    const hashed = hashPassword(defaultPass);
    db.prepare(`
      INSERT OR IGNORE INTO admin_users (id, username, password_hash, salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run('admin-root-1', defaultUser, hashed.hash, hashed.salt);
  };

  const teardownDb = () => {
    if (db) db.close();
  };

  await t.test('initializes default admin account (admin9988 / 1122334455)', () => {
    setupDb();
    try {
      const row = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('admin9988') as any;
      assert.ok(row, 'Admin row must exist');
      assert.equal(row.username, 'admin9988');
      assert.ok(row.password_hash);
      assert.ok(row.salt);

      // Verify correct password matches salted scrypt hash
      const isValid = verifyPassword('1122334455', row.password_hash, row.salt);
      assert.equal(isValid, true);

      // Verify wrong password fails
      const isWrong = verifyPassword('wrongpassword99', row.password_hash, row.salt);
      assert.equal(isWrong, false);
    } finally {
      teardownDb();
    }
  });

  await t.test('prevents creating a second administrator account (single admin trigger)', () => {
    setupDb();
    try {
      const secondHashed = hashPassword('anotherAdminPass');
      assert.throws(() => {
        db.prepare(`
          INSERT INTO admin_users (id, username, password_hash, salt, created_at, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run('admin-root-2', 'admin_secondary', secondHashed.hash, secondHashed.salt);
      }, /Only one administrator account is permitted/);

      const count = db.prepare('SELECT count(*) as cnt FROM admin_users').get() as { cnt: number };
      assert.equal(count.cnt, 1);
    } finally {
      teardownDb();
    }
  });

  await t.test('validates developer authorization code Akasha249 via constant-time comparison', () => {
    assert.equal(verifyDeveloperCode('Akasha249'), true);
    assert.equal(verifyDeveloperCode(' Akasha249 '), true);
    assert.equal(verifyDeveloperCode('WrongCode123'), false);
    assert.equal(verifyDeveloperCode(''), false);
  });

  await t.test('updates admin credentials when developer authorization code is verified', () => {
    setupDb();
    try {
      const devCode = 'Akasha249';
      assert.equal(verifyDeveloperCode(devCode), true);

      const newHashed = hashPassword('NewMasterPassword9988');
      db.prepare(`
        UPDATE admin_users
        SET username = ?, password_hash = ?, salt = ?, updated_at = datetime('now')
      `).run('alrawahi_manager', newHashed.hash, newHashed.salt);

      const updated = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('alrawahi_manager') as any;
      assert.ok(updated);
      assert.equal(verifyPassword('NewMasterPassword9988', updated.password_hash, updated.salt), true);
      assert.equal(verifyPassword('1122334455', updated.password_hash, updated.salt), false);
    } finally {
      teardownDb();
    }
  });
});

test('Invoice Persistence & Financial Calculation Integrity', async (t) => {
  let db: Database.Database;

  const setupDb = () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const migration of MIGRATIONS) {
      db.exec(migration.sql);
    }

    // Seed customer and vehicle
    db.prepare(`
      INSERT INTO customers (id, full_name, phone, is_permanent, is_active, created_at, updated_at)
      VALUES ('cust-test-1', 'سالم الرواحي', '+968 91234567', 1, 1, datetime('now'), datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer, is_active, created_at, updated_at)
      VALUES ('veh-test-1', 'cust-test-1', '12345 A', 'Toyota', 'Land Cruiser', 2022, 50000, 1, datetime('now'), datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO repair_orders (id, ro_number, customer_id, vehicle_id, status, odometer_in, reported_problem, estimated_cost_baisa, created_at)
      VALUES ('ro-test-1', 'RO-202610-9999', 'cust-test-1', 'veh-test-1', 'COMPLETED', 50000, 'فحص دوري', 35000, datetime('now'))
    `).run();
  };

  const teardownDb = () => {
    if (db) db.close();
  };

  await t.test('calculates financial amounts strictly in integer Baisa without floating-point error', () => {
    // 15.250 OMR + 12.750 OMR = 28.000 OMR = 28,000 Baisa
    const baisa1 = toBaisa(15.250);
    const baisa2 = toBaisa(12.750);
    assert.equal(baisa1, 15250);
    assert.equal(baisa2, 12750);
    assert.equal(baisa1 + baisa2, 28000);

    // 5% VAT on 28,000 Baisa = 1,400 Baisa = 1.400 OMR
    const vatBaisa = Math.round((28000 * 5) / 100);
    assert.equal(vatBaisa, 1400);
    assert.equal(fromBaisa(vatBaisa), 1.4);

    // Discount of 3.000 OMR = 3,000 Baisa
    const discountBaisa = toBaisa(3.000);
    const taxableBase = 28000 - discountBaisa;
    assert.equal(taxableBase, 25000);
    const discountedVat = Math.round((taxableBase * 5) / 100);
    assert.equal(discountedVat, 1250);
    const grandTotal = taxableBase + discountedVat;
    assert.equal(grandTotal, 26250);
  });

  await t.test('stores itemized invoice items and links properly to repair orders', () => {
    setupDb();
    try {
      // Insert invoice
      db.prepare(`
        INSERT INTO invoices (
          id, invoice_number, repair_order_id, customer_id, vehicle_id,
          invoice_date, status, subtotal_parts_baisa, subtotal_labor_baisa,
          discount_baisa, tax_rate_percent, tax_amount_baisa, grand_total_baisa,
          paid_amount_baisa, balance_due_baisa, invoice_language, notes, created_at
        ) VALUES (
          'inv-test-1', 'INV-202610-001', 'ro-test-1', 'cust-test-1', 'veh-test-1',
          '2026-10-26', 'ISSUED', 15000, 10000,
          0, 5.0, 1250, 26250,
          0, 26250, 'ar', 'Test Invoice', datetime('now')
        )
      `).run();

      // Insert itemized items
      db.prepare(`
        INSERT INTO invoice_items (id, invoice_id, item_type, description, quantity, unit_price_baisa, line_total_baisa)
        VALUES 
          ('item-1', 'inv-test-1', 'PART', 'فلتر زيت أصلي تويوتا', 1, 5000, 5000),
          ('item-2', 'inv-test-1', 'PART', 'زيت محرك تخليقي 5W-30', 1, 10000, 10000),
          ('item-3', 'inv-test-1', 'LABOR', 'أجور تبديل الزيت والفلتر والفحص', 1, 10000, 10000)
      `).run();

      // Retrieve invoice items
      const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all('inv-test-1') as any[];
      assert.equal(items.length, 3);
      const totalLinesBaisa = items.reduce((sum: number, it: any) => sum + it.line_total_baisa, 0);
      assert.equal(totalLinesBaisa, 25000);
    } finally {
      teardownDb();
    }
  });
});
