/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Automated Data Persistence & SQLite Schema Verification Tests
 * 
 * Verifies real SQLite engine behavior using Node.js 22 built-in SQLite:
 * 1. Temporary database creation
 * 2. Migrations execution
 * 3. All 17 expected tables exist
 * 4. Foreign-key enforcement (PRAGMA foreign_keys = ON)
 * 5. Data insertion and query accuracy
 * 6. Data persistence across database close and reopen
 * 7. Migration idempotency (no schema corruption on re-run)
 * 8. Transaction rollback on failure
 * 9. Clean shutdown without corruption
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { INITIAL_SCHEMA_SQL } from '../electron/database/schema.ts';

const EXPECTED_TABLES = [
  'schema_migrations',
  'settings',
  'customers',
  'vehicles',
  'technicians',
  'repair_orders',
  'repair_order_status_history',
  'labor_tasks',
  'suppliers',
  'inventory_items',
  'inventory_movements',
  'invoices',
  'invoice_items',
  'payments',
  'expenses',
  'cash_transactions',
  'audit_log',
];

test('1. Temporary database creation and migration execution', () => {
  const tempDbPath = path.join(os.tmpdir(), `garage_test_${Date.now()}_1.db`);
  try {
    const db = new DatabaseSync(tempDbPath);
    db.exec(INITIAL_SCHEMA_SQL);

    // Verify all 17 tables exist
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>;
    const tableNames = rows.map((r) => r.name);

    for (const expectedTable of EXPECTED_TABLES) {
      assert.ok(
        tableNames.includes(expectedTable),
        `Expected table '${expectedTable}' was not found in database.`
      );
    }
    db.close();
  } finally {
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
  }
});

test('2. Foreign key enforcement (PRAGMA foreign_keys = ON)', () => {
  const tempDbPath = path.join(os.tmpdir(), `garage_test_${Date.now()}_2.db`);
  try {
    const db = new DatabaseSync(tempDbPath);
    db.exec(INITIAL_SCHEMA_SQL);

    // Attempt to insert vehicle with non-existent customer_id -> MUST FAIL
    assert.throws(
      () => {
        db.prepare(`
          INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer)
          VALUES ('v-1', 'non-existent-customer-id', '12345 A', 'Toyota', 'Prado', 2022, 10000)
        `).run();
      },
      /FOREIGN KEY constraint failed/i,
      'Inserting vehicle with invalid customer_id should throw FOREIGN KEY constraint violation.'
    );

    // Now insert valid customer first, then insert vehicle -> MUST SUCCEED
    db.prepare(`
      INSERT INTO customers (id, full_name, phone)
      VALUES ('c-1', 'Salim Al Rawahi', '+96891234567')
    `).run();

    db.prepare(`
      INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer)
      VALUES ('v-1', 'c-1', '12345 A', 'Toyota', 'Prado', 2022, 10000)
    `).run();

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get('v-1') as { plate_number: string };
    assert.equal(vehicle.plate_number, '12345 A');

    // Attempt to delete customer while vehicle still references it -> MUST FAIL (ON DELETE RESTRICT)
    assert.throws(
      () => {
        db.prepare('DELETE FROM customers WHERE id = ?').run('c-1');
      },
      /FOREIGN KEY constraint failed/i,
      'Deleting customer with existing vehicle must be restricted by foreign key.'
    );

    db.close();
  } finally {
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
  }
});

test('3. Data persistence across database close and reopen', () => {
  const tempDbPath = path.join(os.tmpdir(), `garage_test_${Date.now()}_3.db`);
  try {
    // Session 1: Create and write data
    const db1 = new DatabaseSync(tempDbPath);
    db1.exec(INITIAL_SCHEMA_SQL);

    db1.prepare(`
      INSERT INTO customers (id, full_name, phone, notes)
      VALUES ('cust-persist-1', 'Ahmed Al Rawahi', '+96899112233', 'VIP Customer')
    `).run();

    db1.prepare(`
      INSERT INTO settings (key, value)
      VALUES ('garage_name', 'AL RAWAHI GARAGE')
    `).run();

    db1.close();

    // Session 2: Reopen same file and read data
    const db2 = new DatabaseSync(tempDbPath);
    const customer = db2.prepare('SELECT * FROM customers WHERE id = ?').get('cust-persist-1') as {
      full_name: string;
      phone: string;
      notes: string;
    };
    const setting = db2.prepare('SELECT value FROM settings WHERE key = ?').get('garage_name') as {
      value: string;
    };

    assert.ok(customer, 'Customer should exist after database reopen.');
    assert.equal(customer.full_name, 'Ahmed Al Rawahi');
    assert.equal(customer.phone, '+96899112233');
    assert.equal(customer.notes, 'VIP Customer');
    assert.equal(setting.value, 'AL RAWAHI GARAGE');

    db2.close();
  } finally {
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
  }
});

test('4. Migration idempotency (no schema corruption or duplication on re-run)', () => {
  const tempDbPath = path.join(os.tmpdir(), `garage_test_${Date.now()}_4.db`);
  try {
    const db = new DatabaseSync(tempDbPath);
    // Run schema first time
    db.exec(INITIAL_SCHEMA_SQL);

    // Insert data
    db.prepare("INSERT INTO customers (id, full_name, phone) VALUES ('c-idemp-1', 'Test User', '+96890000000')").run();

    // Run schema second time (idempotency check)
    assert.doesNotThrow(() => {
      db.exec(INITIAL_SCHEMA_SQL);
    }, 'Re-executing schema should not throw errors due to CREATE TABLE IF NOT EXISTS');

    // Verify existing data is preserved
    const row = db.prepare('SELECT full_name FROM customers WHERE id = ?').get('c-idemp-1') as { full_name: string };
    assert.equal(row.full_name, 'Test User');

    db.close();
  } finally {
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
  }
});

test('5. Transaction rollback on failure preserves database consistency', () => {
  const tempDbPath = path.join(os.tmpdir(), `garage_test_${Date.now()}_5.db`);
  try {
    const db = new DatabaseSync(tempDbPath);
    db.exec(INITIAL_SCHEMA_SQL);

    // Pre-populate customer
    db.prepare("INSERT INTO customers (id, full_name, phone) VALUES ('c-roll-1', 'Rollback User', '+96892222222')").run();

    // Execute atomic transaction that fails halfway
    try {
      db.exec('BEGIN TRANSACTION;');
      db.prepare(`
        INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer)
        VALUES ('v-roll-1', 'c-roll-1', '77777 C', 'Nissan', 'Sunny', 2020, 50000)
      `).run();

      // Intentionally violate UNIQUE constraint on plate_number
      db.prepare(`
        INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer)
        VALUES ('v-roll-2', 'c-roll-1', '77777 C', 'Nissan', 'Altima', 2021, 30000)
      `).run();

      db.exec('COMMIT;');
    } catch {
      db.exec('ROLLBACK;');
    }

    // Verify vehicle v-roll-1 was rolled back and DOES NOT exist
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get('v-roll-1');
    assert.equal(vehicle, undefined, 'Vehicle insert should have been rolled back upon transaction failure.');

    db.close();
  } finally {
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
  }
});
