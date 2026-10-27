/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Phase 3 Automated Test Suite: Customer & Vehicle Management
 * 
 * Verifies:
 * 1. Migration 2 schema upgrade & indices (alt_phone, is_active, updated_at)
 * 2. Zod validation schemas for Customer & Vehicle payloads
 * 3. Omani license plate normalization & duplicate prevention
 * 4. Customer CRUD lifecycle, search filtering & archive/restore
 * 5. Vehicle CRUD lifecycle, owner linkage, search & duplicate check
 * 6. Foreign key integrity & safe deletion guardrails
 * 7. Browser mock adapter contract parity
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
// Node 22 built-in synchronous SQLite engine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import { INITIAL_SCHEMA_SQL } from '../electron/database/schema.ts';
import { runMigrations } from '../electron/database/migrator.ts';
import {
  CustomerInputSchema,
  CustomerUpdateSchema,
  VehicleInputSchema,
  VehicleUpdateSchema,
  VehicleDuplicateCheckSchema,
  normalizePlateNumber,
} from '../electron/ipc/validation.ts';
import { browserMockAdapter } from '../src/services/browserMockAdapter.ts';

const TEST_DB_PATH = path.join(os.tmpdir(), `test_garage_phase3_${Date.now()}.db`);

function cleanupTestDb() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  } catch (err) {
    console.warn('Cleanup warning:', err);
  }
}

test('Phase 3 Customer & Vehicle Suite', async (t) => {
  cleanupTestDb();

  await t.test('1. Migration 2 & 3 apply cleanly and add required Phase 3 columns, serials & indices', () => {
    const db = new DatabaseSync(TEST_DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');

    // Apply migrations
    const currentVersion = runMigrations(db as any);
    assert.ok(currentVersion >= 3, `Migration version must reach at least 3 (current: ${currentVersion})`);

    // Inspect columns of customers table
    const customerCols = db.prepare("PRAGMA table_info('customers')").all() as Array<{ name: string; notnull: number }>;
    const customerColNames = new Set(customerCols.map((c) => c.name));
    assert.ok(customerColNames.has('alt_phone'), 'customers must have alt_phone column');
    assert.ok(customerColNames.has('is_active'), 'customers must have is_active column');
    const phoneCol = customerCols.find((c) => c.name === 'phone');
    assert.equal(phoneCol?.notnull, 0, 'customers.phone must be optional / nullable in migration 3');

    // Inspect columns of vehicles table
    const vehicleCols = db.prepare("PRAGMA table_info('vehicles')").all() as Array<{ name: string }>;
    const vehicleColNames = new Set(vehicleCols.map((c) => c.name));
    assert.ok(vehicleColNames.has('updated_at'), 'vehicles must have updated_at column');
    assert.ok(vehicleColNames.has('is_active'), 'vehicles must have is_active column');

    // Inspect serials table and indices
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const tableNames = new Set(tables.map((t) => t.name));
    assert.ok(tableNames.has('inventory_serials'), 'inventory_serials table must exist');

    const indices = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>;
    const indexNames = new Set(indices.map((i) => i.name));
    assert.ok(indexNames.has('idx_vehicles_vin'), 'idx_vehicles_vin must exist');
    assert.ok(indexNames.has('idx_customers_active'), 'idx_customers_active must exist');
    assert.ok(indexNames.has('idx_vehicles_active'), 'idx_vehicles_active must exist');
    assert.ok(indexNames.has('idx_unique_active_serial'), 'idx_unique_active_serial must exist');

    db.close();
  });

  await t.test('2. Plate Number normalization standardizes Omani plates and collapses whitespace', () => {
    assert.equal(normalizePlateNumber('  12345   a  '), '12345 A');
    assert.equal(normalizePlateNumber('98765 b (ب)'), '98765 B (ب)');
    assert.equal(normalizePlateNumber('   55441   d   '), '55441 D');
    assert.equal(normalizePlateNumber('321 x'), '321 X');
  });

  await t.test('3. Zod validation enforces customer and vehicle rules', () => {
    // Valid Customer
    const validCust = CustomerInputSchema.parse({
      fullName: 'سالم بن حمد الرواحي',
      phone: '+968 91234567',
      altPhone: '+968 24567890',
      email: 'salim@example.om',
      address: 'مسقط، عُمان',
      notes: 'عميل دائم',
    });
    assert.equal(validCust.fullName, 'سالم بن حمد الرواحي');
    assert.equal(validCust.isActive, true);

    // Invalid Customer (too short name)
    assert.throws(() => {
      CustomerInputSchema.parse({
        fullName: 'A',
        phone: '1234567',
      });
    });

    // Invalid Customer (invalid email)
    assert.throws(() => {
      CustomerInputSchema.parse({
        fullName: 'Valid Name',
        phone: '1234567',
        email: 'invalid-email-string',
      });
    });

    // Valid Vehicle
    const validVeh = VehicleInputSchema.parse({
      customerId: 'cust-123',
      plateNumber: '  12345 a  ',
      make: 'Toyota',
      model: 'Land Cruiser Prado',
      year: 2022,
      vin: 'JTEBU5JR2N5123456',
      odometer: 48500,
    });
    assert.equal(validVeh.plateNumber, '12345 A'); // Automatically normalized
    assert.equal(validVeh.year, 2022);
    assert.equal(validVeh.odometer, 48500);

    // Invalid Vehicle (negative odometer)
    assert.throws(() => {
      VehicleInputSchema.parse({
        customerId: 'cust-123',
        plateNumber: '12345 A',
        make: 'Toyota',
        model: 'Prado',
        year: 2022,
        odometer: -50,
      });
    });
  });

  await t.test('4. Customer and Vehicle relational persistence in SQLite', () => {
    const db = new DatabaseSync(TEST_DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');

    const custId = crypto.randomUUID();
    const vehId = crypto.randomUUID();

    // 1. Insert customer
    db.prepare(`
      INSERT INTO customers (id, full_name, phone, alt_phone, email, address, notes, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(custId, 'أحمد بن سعيد المعمري', '+968 95551234', '+968 26667890', 'ahmed@example.om', 'صحار، سلطنة عُمان', 'صيانة سيارات الدفع الرباعي');

    // Read back customer
    const fetchedCust = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId) as any;
    assert.equal(fetchedCust.full_name, 'أحمد بن سعيد المعمري');
    assert.equal(fetchedCust.alt_phone, '+968 26667890');
    assert.equal(fetchedCust.is_active, 1);

    // 2. Insert vehicle linked to customer
    db.prepare(`
      INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, vin, odometer, color, notes, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(vehId, custId, '77889 K', 'Nissan', 'Patrol Titanium', 2023, 'JN8AY2NC4P778899', 31200, 'فضي ميتاليك', 'تبديل زيت المحرك وفحص المكابح');

    // Read back vehicle joined with customer
    const fetchedVeh = db.prepare(`
      SELECT v.*, c.full_name as customer_name, c.phone as customer_phone
      FROM vehicles v
      LEFT JOIN customers c ON c.id = v.customer_id
      WHERE v.id = ?
    `).get(vehId) as any;

    assert.equal(fetchedVeh.plate_number, '77889 K');
    assert.equal(fetchedVeh.customer_name, 'أحمد بن سعيد المعمري');
    assert.equal(fetchedVeh.customer_phone, '+968 95551234');
    assert.equal(fetchedVeh.odometer, 31200);

    // 3. Verify vehicle count on customer
    const countRow = db.prepare('SELECT count(*) as count FROM vehicles WHERE customer_id = ?').get(custId) as { count: number };
    assert.equal(countRow.count, 1);

    // 4. Verify foreign key protection: cannot insert vehicle with non-existent customer
    assert.throws(() => {
      db.prepare(`
        INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer, created_at, updated_at)
        VALUES (?, 'non-existent-cust', '99999 Z', 'Ford', 'F-150', 2021, 10000, datetime('now'), datetime('now'))
      `).run(crypto.randomUUID());
    });

    // 5. Test Archive and Restore
    db.prepare("UPDATE customers SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(custId);
    const archivedCust = db.prepare('SELECT is_active FROM customers WHERE id = ?').get(custId) as any;
    assert.equal(archivedCust.is_active, 0);

    db.prepare("UPDATE customers SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(custId);
    const restoredCust = db.prepare('SELECT is_active FROM customers WHERE id = ?').get(custId) as any;
    assert.equal(restoredCust.is_active, 1);

    db.close();
  });

  await t.test('5. Browser Preview Adapter full CRUD and duplicate checking', async () => {
    // 1. Create Customer
    const createCustRes = await browserMockAdapter.createCustomer({
      fullName: 'خالد بن ناصر السيابي',
      phone: '+968 97778888',
      altPhone: '+968 24445555',
      address: 'نزوى، سلطنة عُمان',
    });
    assert.equal(createCustRes.success, true);
    assert.ok(createCustRes.data?.id);
    const newCustId = createCustRes.data!.id;

    // 2. Fetch customers and verify inclusion
    const listRes = await browserMockAdapter.getCustomers('السيابي');
    assert.equal(listRes.success, true);
    assert.ok(listRes.data!.some((c) => c.id === newCustId));

    // 3. Create Vehicle for customer
    const createVehRes = await browserMockAdapter.createVehicle({
      customerId: newCustId,
      plateNumber: '44332 M',
      make: 'GMC',
      model: 'Yukon Denali',
      year: 2023,
      vin: '1GKS2CKJ0PR443322',
      odometer: 15400,
    });
    assert.equal(createVehRes.success, true);
    assert.equal(createVehRes.data?.plateNumber, '44332 M');
    assert.equal(createVehRes.data?.customerName, 'خالد بن ناصر السيابي');

    // 4. Duplicate Check
    const dupCheck = await browserMockAdapter.checkVehicleDuplicates('44332 M');
    assert.equal(dupCheck.success, true);
    assert.equal(dupCheck.data?.plateExists, true);

    const nonDupCheck = await browserMockAdapter.checkVehicleDuplicates('99999 UNIQUE');
    assert.equal(nonDupCheck.success, true);
    assert.equal(nonDupCheck.data?.plateExists, false);

    // 5. Update Vehicle
    const updateVehRes = await browserMockAdapter.updateVehicle(createVehRes.data!.id, {
      odometer: 16200,
      color: 'أسود فحمي',
    });
    assert.equal(updateVehRes.success, true);
    assert.equal(updateVehRes.data?.odometer, 16200);
    assert.equal(updateVehRes.data?.color, 'أسود فحمي');

    // 6. Safe deletion test: cannot delete customer with vehicles
    const deleteCustRes = await browserMockAdapter.deleteCustomer(newCustId);
    assert.equal(deleteCustRes.success, false);
    assert.equal(deleteCustRes.errorCode, 'CUSTOMER_HAS_LINKED_RECORDS');

    // 7. Delete vehicle first, then delete customer
    const deleteVehRes = await browserMockAdapter.deleteVehicle(createVehRes.data!.id);
    assert.equal(deleteVehRes.success, true);

    const deleteCustFinal = await browserMockAdapter.deleteCustomer(newCustId);
    assert.equal(deleteCustFinal.success, true);
  });
});
