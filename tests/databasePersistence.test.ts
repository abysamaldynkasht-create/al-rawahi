/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Task 3: Automated Database Persistence & Integrity Test Suite
 * 
 * Verifies:
 * 1. Temporary SQLite database creation on disk
 * 2. Execution of INITIAL_SCHEMA_SQL
 * 3. Existence of all 17 required relational tables
 * 4. Strict foreign key enforcement
 * 5. Data insertion and read-back with integer Baisa precision
 * 6. Data persistence across database close and reopen
 * 7. Migration idempotency (no schema corruption on re-run)
 * 8. Transaction rollback on failure
 * 9. Clean shutdown without corrupting the file
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// Node 22 built-in synchronous SQLite engine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import { INITIAL_SCHEMA_SQL } from '../electron/database/schema.ts';

const TEST_DB_PATH = path.join(os.tmpdir(), `test_garage_audit_${Date.now()}.db`);

function cleanupTestDb() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  } catch (err) {
    console.warn('Cleanup warning:', err);
  }
}

test('Database Persistence & Schema Integrity Suite', async (t) => {
  // Ensure clean starting slate
  cleanupTestDb();

  await t.test('1. Temporary database creation and schema migration execution', () => {
    const db = new DatabaseSync(TEST_DB_PATH);
    
    // Enable WAL and foreign keys
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');

    // Execute full initial schema DDL
    db.exec(INITIAL_SCHEMA_SQL);

    // Verify migrations table can track version
    db.exec(`INSERT INTO schema_migrations (version, name) VALUES (1, 'initial_schema');`);
    const mig = db.prepare('SELECT max(version) as version FROM schema_migrations').get() as { version: number };
    assert.equal(mig.version, 1);

    db.close();
    assert.equal(fs.existsSync(TEST_DB_PATH), true);
  });

  await t.test('2. Verification of all 17 relational tables in sqlite_master', () => {
    const db = new DatabaseSync(TEST_DB_PATH);
    const expectedTables = [
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

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;
    const tableNames = new Set(tables.map((t) => t.name));

    for (const expected of expectedTables) {
      assert.equal(
        tableNames.has(expected),
        true,
        `Expected table '${expected}' to be present in database schema`
      );
    }
    db.close();
  });

  await t.test('3. Foreign key enforcement prevents orphan records', () => {
    const db = new DatabaseSync(TEST_DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');

    // Attempting to insert a vehicle with a non-existent customer_id MUST throw
    assert.throws(
      () => {
        db.exec(`
          INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer)
          VALUES ('v-orphan', 'non-existent-cust-id', '99999 X', 'Toyota', 'Prado', 2022, 10000);
        `);
      },
      (err: Error) => {
        return err.message.includes('FOREIGN KEY constraint failed') || err.message.includes('foreign key');
      },
      'Expected foreign key constraint violation when inserting orphan vehicle'
    );

    db.close();
  });

  await t.test('4. Data insertion and read-back with integer Baisa amounts', () => {
    const db = new DatabaseSync(TEST_DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');

    // 1. Insert customer
    db.exec(`
      INSERT INTO customers (id, full_name, phone, address, notes)
      VALUES ('cust-audit-1', 'عادل الرواحي (Adil Al Rawahi)', '+968 91112222', 'مسقط', 'عميل تدقيق');
    `);

    // 2. Insert vehicle
    db.exec(`
      INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer)
      VALUES ('veh-audit-1', 'cust-audit-1', '44321 A', 'Toyota', 'Land Cruiser', 2023, 35000);
    `);

    // 3. Insert repair order with integer Baisa (42.500 OMR = 42500 baisa)
    db.exec(`
      INSERT INTO repair_orders (
        id, ro_number, customer_id, vehicle_id, status, odometer_in,
        reported_problem, estimated_cost_baisa, customer_approved
      ) VALUES (
        'ro-audit-1', 'RO-202610-9999', 'cust-audit-1', 'veh-audit-1', 'RECEIVED', 35000,
        'فحص دوري واستبدال فحمات', 42500, 1
      );
    `);

    // Read back and verify exact values
    const ro = db.prepare('SELECT * FROM repair_orders WHERE id = ?').get('ro-audit-1') as {
      id: string;
      ro_number: string;
      estimated_cost_baisa: number;
      customer_approved: number;
    };

    assert.equal(ro.ro_number, 'RO-202610-9999');
    assert.equal(ro.estimated_cost_baisa, 42500); // Exactly 42.500 OMR in Baisa
    assert.equal(ro.customer_approved, 1);

    db.close();
  });

  await t.test('5. Data persistence across database close and reopen', () => {
    // Reopen database from disk
    const db = new DatabaseSync(TEST_DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');

    const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get('cust-audit-1') as {
      id: string;
      full_name: string;
      phone: string;
    };

    assert.ok(cust);
    assert.equal(cust.full_name, 'عادل الرواحي (Adil Al Rawahi)');
    assert.equal(cust.phone, '+968 91112222');

    const roCount = db.prepare('SELECT count(*) as count FROM repair_orders').get() as { count: number };
    assert.equal(roCount.count >= 1, true);

    db.close();
  });

  await t.test('6. Re-running migrations is idempotent and does not duplicate schema', () => {
    const db = new DatabaseSync(TEST_DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');

    // Re-execute schema DDL
    assert.doesNotThrow(() => {
      db.exec(INITIAL_SCHEMA_SQL);
    });

    // Verify existing data remains untouched
    const cust = db.prepare('SELECT full_name FROM customers WHERE id = ?').get('cust-audit-1') as { full_name: string };
    assert.equal(cust.full_name, 'عادل الرواحي (Adil Al Rawahi)');

    db.close();
  });

  await t.test('7. Failed transaction rolls back without leaving partial data', () => {
    const db = new DatabaseSync(TEST_DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');

    // Record count before transaction
    const beforeCount = (db.prepare('SELECT count(*) as count FROM customers').get() as { count: number }).count;

    // Execute transaction that fails mid-way
    try {
      db.exec('BEGIN TRANSACTION;');
      db.exec(`INSERT INTO customers (id, full_name, phone) VALUES ('cust-rollback', 'Temporary', '0000');`);
      // Deliberately cause a unique constraint / foreign key violation
      db.exec(`INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer) VALUES ('v-fail', 'non-existent', 'FAIL-PLATE', 'X', 'Y', 2020, 0);`);
      db.exec('COMMIT;');
    } catch {
      db.exec('ROLLBACK;');
    }

    // Verify row was rolled back
    const afterCount = (db.prepare('SELECT count(*) as count FROM customers').get() as { count: number }).count;
    assert.equal(afterCount, beforeCount);

    const checkTemp = db.prepare('SELECT * FROM customers WHERE id = ?').get('cust-rollback');
    assert.equal(checkTemp, undefined);

    db.close();
  });

  await t.test('8. Final clean database shutdown and cleanup', () => {
    // Verify database opens normally after all operations
    const db = new DatabaseSync(TEST_DB_PATH);
    const integrityCheck = db.prepare('PRAGMA integrity_check;').get() as { integrity_check: string };
    assert.equal(integrityCheck.integrity_check, 'ok');
    db.close();

    // Clean up temporary test database
    cleanupTestDb();
    assert.equal(fs.existsSync(TEST_DB_PATH), false);
  });
});
