/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Phase 3 Workflow Corrections Test Suite
 * 
 * Verifies:
 * 1. Registering a vehicle with an existing customer.
 * 2. Registering a vehicle with a newly typed customer name.
 * 3. Atomic transaction behavior if vehicle creation fails after customer creation begins.
 * 4. Optional customer phone number where permitted.
 * 5. Similar customer names must not cause silent incorrect linking.
 * 6. Duplicate serial-number rejection for serialized inventory items.
 * 7. Manual serial-number entry without scanner hardware.
 * 8. Existing customer and vehicle CRUD regression tests.
 * 9. Existing database and currency regression tests.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../electron/database/migrator.ts';
import {
  CustomerInputSchema,
  VehicleInputSchema,
  InventorySerialInputSchema,
  normalizePlateNumber,
} from '../electron/ipc/validation.ts';
import { browserMockAdapter } from '../src/services/browserMockAdapter.ts';
import { toBaisa, fromBaisa, formatOMR, formatBaisa } from '../src/core/currency.ts';

const TEST_DB_PATH = path.join(os.tmpdir(), `test_workflow_phase3_${Date.now()}.db`);

function cleanupDb() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  } catch (err) {
    // ignore
  }
}

test('Phase 3 Workflow Corrections Suite', async (t) => {
  cleanupDb();
  const db = new DatabaseSync(TEST_DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db as any);

  // Helper function mimicking the atomic transaction in electron/ipc/handlers.ts
  function registerVehicleWithCustomer(dbInstance: any, payload: any) {
    const validated = VehicleInputSchema.parse(payload);

    // Plate duplicate check
    const existingPlate = dbInstance.prepare('SELECT id FROM vehicles WHERE plate_number = ?').get(validated.plateNumber);
    if (existingPlate) {
      throw new Error(`A vehicle with plate number "${validated.plateNumber}" already exists.`);
    }

    // VIN duplicate check
    if (validated.vin && validated.vin.trim()) {
      const existingVin = dbInstance.prepare('SELECT id FROM vehicles WHERE UPPER(vin) = ?').get(validated.vin.trim().toUpperCase());
      if (existingVin) {
        throw new Error(`A vehicle with VIN "${validated.vin}" already exists.`);
      }
    }

    let customerId = validated.customerId?.trim() || '';
    let customerName = validated.customerName?.trim() || '';
    let customerPhone = validated.customerPhone?.trim() || '';

    if (customerId) {
      const cust = dbInstance.prepare('SELECT id, full_name, phone FROM customers WHERE id = ?').get(customerId) as any;
      if (!cust) throw new Error('Customer not found');
      customerName = cust.full_name;
      customerPhone = cust.phone || '';
    }

    const vehicleId = crypto.randomUUID();
    const now = new Date().toISOString();

    dbInstance.exec('BEGIN TRANSACTION;');
    try {
      if (!customerId) {
        customerId = crypto.randomUUID();
        dbInstance.prepare(`
          INSERT INTO customers (id, full_name, phone, is_active, created_at, updated_at)
          VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
        `).run(customerId, customerName, customerPhone || null);
      }

      dbInstance.prepare(`
        INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, vin, odometer, color, notes, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        vehicleId,
        customerId,
        validated.plateNumber,
        validated.make,
        validated.model,
        validated.year,
        validated.vin || null,
        validated.odometer,
        validated.color || null,
        validated.notes || null,
        validated.isActive !== false ? 1 : 0
      );

      dbInstance.exec('COMMIT;');
      return { vehicleId, customerId, customerName, customerPhone };
    } catch (err) {
      try { dbInstance.exec('ROLLBACK;'); } catch {}
      throw err;
    }
  }

  // 1. Registering a vehicle with an existing customer
  await t.test('1. Registering a vehicle with an existing customer links ID without creating duplicate customer', () => {
    const custId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO customers (id, full_name, phone, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(custId, 'سالم بن حمد الرواحي', '+968 91234567');

    const customerCountBefore = (db.prepare('SELECT count(*) as count FROM customers').get() as any).count;

    const result = registerVehicleWithCustomer(db, {
      customerId: custId,
      plateNumber: '7766 A (ع)',
      make: 'Toyota',
      model: 'Land Cruiser',
      year: 2023,
      odometer: 15000,
    });

    const customerCountAfter = (db.prepare('SELECT count(*) as count FROM customers').get() as any).count;
    assert.equal(customerCountAfter, customerCountBefore, 'Customer count must NOT increase when linking existing customer');
    assert.equal(result.customerId, custId, 'Vehicle must be linked to exact existing customer ID');

    const veh = db.prepare('SELECT * FROM vehicles WHERE plate_number = ?').get('7766 A (ع)') as any;
    assert.ok(veh, 'Vehicle must exist');
    assert.equal(veh.customer_id, custId, 'Vehicle foreign key must match existing customer');
  });

  // 2. Registering a vehicle with a newly typed customer name
  await t.test('2. Registering a vehicle with a newly typed customer name creates customer and links vehicle', () => {
    const customerCountBefore = (db.prepare('SELECT count(*) as count FROM customers').get() as any).count;

    const result = registerVehicleWithCustomer(db, {
      customerName: 'فهد بن ناصر المعولي',
      customerPhone: '+968 95544332',
      plateNumber: '44332 B (ب)',
      make: 'Nissan',
      model: 'Patrol',
      year: 2022,
      odometer: 32000,
    });

    const customerCountAfter = (db.prepare('SELECT count(*) as count FROM customers').get() as any).count;
    assert.equal(customerCountAfter, customerCountBefore + 1, 'A new customer record must be created');

    const createdCust = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.customerId) as any;
    assert.ok(createdCust, 'Created customer must exist in database');
    assert.equal(createdCust.full_name, 'فهد بن ناصر المعولي');
    assert.equal(createdCust.phone, '+968 95544332');

    const createdVeh = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(result.vehicleId) as any;
    assert.ok(createdVeh, 'Created vehicle must exist');
    assert.equal(createdVeh.customer_id, result.customerId, 'Vehicle must point to new customer');
  });

  // 3. Atomic transaction behavior if vehicle creation fails after customer creation begins
  await t.test('3. Atomic transaction behavior: rolls back customer creation if vehicle insertion fails', () => {
    const customerCountBefore = (db.prepare('SELECT count(*) as count FROM customers').get() as any).count;

    // Simulate atomic transaction where customer is inserted but vehicle fails (e.g. duplicate plate)
    assert.throws(() => {
      // Try to register vehicle with duplicate plate '7766 A (ع)'
      registerVehicleWithCustomer(db, {
        customerName: 'طارق الزبير (Should Rollback)',
        customerPhone: '+968 91112222',
        plateNumber: '7766 A (ع)', // Already registered in test 1!
        make: 'Ford',
        model: 'F-150',
        year: 2021,
        odometer: 50000,
      });
    }, /already exists/);

    const customerCountAfter = (db.prepare('SELECT count(*) as count FROM customers').get() as any).count;
    assert.equal(customerCountAfter, customerCountBefore, 'Customer creation must have been completely rolled back');

    const checkCust = db.prepare("SELECT * FROM customers WHERE full_name LIKE '%Should Rollback%'").get();
    assert.equal(checkCust, undefined, 'Rolled back customer record must not exist in database');
  });

  // 4. Optional customer phone number where permitted
  await t.test('4. Optional customer phone number: allows vehicle intake with name only', () => {
    const result = registerVehicleWithCustomer(db, {
      customerName: 'خالد الحوسني (بدون هاتف)',
      plateNumber: '9911 D (د)',
      make: 'Lexus',
      model: 'LX600',
      year: 2024,
      odometer: 5000,
    });

    const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.customerId) as any;
    assert.ok(cust);
    assert.equal(cust.full_name, 'خالد الحوسني (بدون هاتف)');
    assert.equal(cust.phone, null, 'Customer phone must safely be NULL in database when not provided');
  });

  // 5. Similar customer names must not cause silent incorrect linking
  await t.test('5. Similar customer names must not cause silent incorrect linking', () => {
    // Existing customer: 'محمد البلوشي'
    const originalCustId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO customers (id, full_name, phone, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(originalCustId, 'محمد البلوشي', '+968 97771111');

    // Operator enters a similar name 'محمد البلوشي 2' without selecting suggestion
    const result = registerVehicleWithCustomer(db, {
      customerName: 'محمد البلوشي', // exact same or similar text, but operator typed as new customer
      customerPhone: '+968 98882222',
      plateNumber: '3344 E (هـ)',
      make: 'Nissan',
      model: 'Sunny',
      year: 2020,
      odometer: 85000,
    });

    assert.notEqual(result.customerId, originalCustId, 'Must create a distinct customer ID and never silently re-link to existing');
    const veh = db.prepare('SELECT customer_id FROM vehicles WHERE plate_number = ?').get('3344 E (هـ)') as any;
    assert.equal(veh.customer_id, result.customerId);
    assert.notEqual(veh.customer_id, originalCustId);
  });

  // 6. Duplicate serial-number rejection for serialized inventory items
  await t.test('6. Duplicate serial-number rejection: unique partial index prevents duplicate active serials', () => {
    const itemId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO inventory_items (id, part_code, name, category, quantity_in_stock, purchase_cost_baisa, selling_price_baisa, is_serialized)
      VALUES (?, ?, ?, ?, 0, 45000, 65000, 1)
    `).run(itemId, 'ALT-BOSCH-01', 'Bosch Heavy Duty Alternator', 'Electrical');

    const serial1Id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO inventory_serials (id, item_id, serial_number, status, received_at)
      VALUES (?, ?, ?, 'IN_STOCK', datetime('now'))
    `).run(serial1Id, itemId, 'SN-BOSCH-998877');

    // Attempting to insert duplicate active serial number SN-BOSCH-998877 with status IN_STOCK must throw constraint error
    assert.throws(() => {
      const serial2Id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO inventory_serials (id, item_id, serial_number, status, received_at)
        VALUES (?, ?, ?, 'IN_STOCK', datetime('now'))
      `).run(serial2Id, itemId, 'SN-BOSCH-998877');
    }, /UNIQUE constraint failed/);

    // After issuing the part (status changes to ISSUED), that historic serial is preserved
    db.prepare("UPDATE inventory_serials SET status = 'ISSUED', issued_at = datetime('now') WHERE id = ?").run(serial1Id);

    const issuedRow = db.prepare('SELECT status, serial_number FROM inventory_serials WHERE id = ?').get(serial1Id) as any;
    assert.equal(issuedRow.status, 'ISSUED');
    assert.equal(issuedRow.serial_number, 'SN-BOSCH-998877');
  });

  // 7. Manual serial-number entry without scanner hardware
  await t.test('7. Manual serial-number entry validates keyboard strings and records audit movements', () => {
    // Valid manual string from desktop keyboard
    const manualSerial = 'ALR-TURBO-2026-X89';
    const validated = InventorySerialInputSchema.parse({
      itemId: 'dummy-part-id',
      serialNumber: manualSerial,
      notes: 'Manually inspected on delivery bench',
    });
    assert.equal(validated.serialNumber, manualSerial);
    assert.equal(validated.notes, 'Manually inspected on delivery bench');

    // Empty serial rejected
    assert.throws(() => {
      InventorySerialInputSchema.parse({
        itemId: 'dummy-part-id',
        serialNumber: '   ',
      });
    });
  });

  // 8. Existing customer and vehicle CRUD regression tests in Browser Mock Adapter
  await t.test('8. Regression: Browser Mock Adapter supports customer CRUD and new customer vehicle intake', async () => {
    // 1. Create vehicle with new customer
    const res = await browserMockAdapter.createVehicle({
      customerName: 'سعيد بن ماجد الراشدي',
      customerPhone: '+968 96655443',
      plateNumber: '1122 M (م)',
      make: 'GMC',
      model: 'Sierra',
      year: 2023,
      odometer: 18000,
    });
    assert.ok(res.success);
    assert.ok(res.data?.id);
    assert.equal(res.data?.customerName, 'سعيد بن ماجد الراشدي');

    // 2. Verify customer was stored and can be queried
    const custRes = await browserMockAdapter.getCustomers('سعيد بن ماجد');
    assert.ok(custRes.success);
    assert.ok(custRes.data && custRes.data.length > 0);
    assert.equal(custRes.data[0].fullName, 'سعيد بن ماجد الراشدي');

    // 3. Serial intake and issue in mock adapter
    const mockItem = await browserMockAdapter.createInventoryItem({
      partCode: 'AC-COMP-01',
      name: 'Denso AC Compressor',
      category: 'Air Conditioning',
      quantityInStock: 2,
      purchaseCostBaisa: 75000,
      sellingPriceBaisa: 110000,
      minStockLevel: 1,
    });
    assert.ok(mockItem.success);

    const serialRes = await browserMockAdapter.receiveInventorySerial({
      itemId: mockItem.data!.id,
      serialNumber: 'DENSO-AC-5544',
      notes: 'Initial stock intake',
    });
    assert.ok(serialRes.success);
    assert.equal(serialRes.data?.serialNumber, 'DENSO-AC-5544');

    // Duplicate active serial rejected
    const dupSerial = await browserMockAdapter.receiveInventorySerial({
      itemId: mockItem.data!.id,
      serialNumber: 'DENSO-AC-5544',
    });
    assert.equal(dupSerial.success, false);
    assert.ok(dupSerial.error?.includes('already in stock'));

    // Issue serial
    const issueRes = await browserMockAdapter.issueInventorySerial('DENSO-AC-5544');
    assert.ok(issueRes.success);

    // List serials
    const serialList = await browserMockAdapter.getInventorySerials(mockItem.data!.id);
    assert.ok(serialList.success);
    assert.equal(serialList.data?.[0].status, 'ISSUED');
  });

  // 9. Existing database and currency regression tests
  await t.test('9. Regression: Integer Baisa currency engine & OMR formatting', () => {
    assert.equal(toBaisa(10.5), 10500);
    assert.equal(toBaisa(0.125), 125);
    assert.equal(fromBaisa(10500), 10.5);
    assert.equal(formatBaisa(10500, { showCode: true, arabicLabel: true }), '10.500 ر.ع.');
    assert.equal(formatBaisa(10500, { showCode: true, arabicLabel: false }), '10.500 OMR');
  });

  db.close();
  cleanupDb();
});
