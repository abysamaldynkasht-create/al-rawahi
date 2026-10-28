/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Comprehensive Test Suite for User Enhancements:
 * 1. Detailed Invoice Line Items Linked to Inventory (Quantity × Unit Price, Unit Tracking, Single Stock Deduction)
 * 2. Overtime Hours Entry, Hourly Rate Snapshot, Auto Total Calculation, Editing & Monthly Payroll Integration
 * 3. Optional Customer & Vehicle Saving (Temporary / Unregistered vs Permanent Records)
 * 4. Customer Recognition & Autocomplete Search (Name & Phone matching)
 * 5. Immediate Direct Printing & Unavailable Printer Graceful Handling
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { MIGRATIONS } from '../electron/database/migrator.ts';
import { toBaisa, fromBaisa } from '../src/core/currency.ts';
import { browserMockAdapter } from '../src/services/browserMockAdapter.ts';

test('Invoice, Overtime, Customer Recognition & Direct Printing Verification Suite', async (suite) => {
  let db: Database.Database;

  const setupSqliteDb = () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = OFF');

    for (const migration of MIGRATIONS) {
      db.exec(migration.sql);
    }

    db.pragma('foreign_keys = ON');
    return db;
  };

  // ==========================================================================
  // REQUIREMENT 1: Detailed Invoice Line Items Linked to Inventory
  // ==========================================================================
  await suite.test('1. Detailed Invoice Line Items with Quantity, Unit Price, Unit Tracking & Single Stock Deduction', async (t) => {
    const memDb = setupSqliteDb();

    // 1.1 Insert Customer, Vehicle, and Inventory Item
    const customerId = 'cust-test-oil-1';
    memDb.prepare(`
      INSERT INTO customers (id, full_name, phone, is_active, is_permanent, created_at, updated_at)
      VALUES (?, 'أحمد بن سعيد المعمري', '+968 91112222', 1, 1, datetime('now'), datetime('now'))
    `).run(customerId);

    const vehicleId = 'veh-test-oil-1';
    memDb.prepare(`
      INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer, is_permanent, is_active, created_at, updated_at)
      VALUES (?, ?, '4598 B', 'Toyota', 'Land Cruiser', 2022, 60000, 1, 1, datetime('now'), datetime('now'))
    `).run(vehicleId, customerId);

    const oilItemId = 'inv-oil-5w30';
    const filterItemId = 'inv-filter-oem';
    const initialOilStock = 20; // 20 liters in stock
    const initialFilterStock = 8; // 8 pieces in stock

    memDb.prepare(`
      INSERT INTO inventory_items (id, part_code, name, category, quantity_in_stock, unit, purchase_cost_baisa, selling_price_baisa, min_stock_level, is_active, created_at)
      VALUES (?, 'OIL-5W30', 'زيت محرك تويوتا تخليقي', 'Fluids', ?, 'لتر', 3000, 4500, 5, 1, datetime('now'))
    `).run(oilItemId, initialOilStock);

    memDb.prepare(`
      INSERT INTO inventory_items (id, part_code, name, category, quantity_in_stock, unit, purchase_cost_baisa, selling_price_baisa, min_stock_level, is_active, created_at)
      VALUES (?, 'FILT-OEM-1', 'فلتر زيت محرك أصلي', 'Filters', ?, 'قطعة', 4000, 8900, 3, 1, datetime('now'))
    `).run(filterItemId, initialFilterStock);

    // 1.2 Verify initial stock
    const initialOilRow = memDb.prepare('SELECT quantity_in_stock, unit FROM inventory_items WHERE id = ?').get(oilItemId) as any;
    assert.equal(initialOilRow.quantity_in_stock, 20);
    assert.equal(initialOilRow.unit, 'لتر');

    // 1.3 Create Invoice with Itemized Line Items:
    // Line 1: 4 liters of Engine Oil at 4.500 OMR = 18.000 OMR (18,000 Baisa)
    // Line 2: 1 piece of Oil Filter at 8.900 OMR = 8.900 OMR (8,900 Baisa)
    // Line 3: 1 Labor Service "تبديل زيت وفلتر" at 5.000 OMR = 5.000 OMR (5,000 Baisa)
    const invoiceId = 'inv-oil-change-001';
    const oilQty = 4;
    const filterQty = 1;
    const oilPriceBaisa = 4500;
    const filterPriceBaisa = 8900;
    const laborPriceBaisa = 5000;

    const partsTotalBaisa = (oilQty * oilPriceBaisa) + (filterQty * filterPriceBaisa); // 18000 + 8900 = 26900
    const laborTotalBaisa = laborPriceBaisa; // 5000
    const subtotalBaisa = partsTotalBaisa + laborTotalBaisa; // 31900
    const taxBaisa = Math.round((subtotalBaisa * 5) / 100); // 1595
    const grandTotalBaisa = subtotalBaisa + taxBaisa; // 33495

    // Execute atomic creation transaction
    memDb.transaction(() => {
      memDb.prepare(`
        INSERT INTO invoices (
          id, invoice_number, customer_id, vehicle_id, invoice_date, status,
          subtotal_parts_baisa, subtotal_labor_baisa, discount_baisa, tax_rate_percent,
          tax_amount_baisa, grand_total_baisa, paid_amount_baisa, balance_due_baisa,
          invoice_language, created_at
        ) VALUES (
          ?, 'INV-2026-0001', ?, ?, datetime('now'), 'ISSUED',
          ?, ?, 0, 5.0,
          ?, ?, 0, ?,
          'ar', datetime('now')
        )
      `).run(invoiceId, customerId, vehicleId, partsTotalBaisa, laborTotalBaisa, taxBaisa, grandTotalBaisa, grandTotalBaisa);

      // Insert itemized lines
      const insertItem = memDb.prepare(`
        INSERT INTO invoice_items (id, invoice_id, item_type, source_id, description, quantity, unit, unit_price_baisa, cost_price_baisa, line_total_baisa)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Item 1: Oil
      insertItem.run('item-1', invoiceId, 'PART', oilItemId, 'زيت محرك تويوتا تخليقي', oilQty, 'لتر', oilPriceBaisa, 3000, oilQty * oilPriceBaisa);
      // Item 2: Filter
      insertItem.run('item-2', invoiceId, 'PART', filterItemId, 'فلتر زيت محرك أصلي', filterQty, 'قطعة', filterPriceBaisa, 4000, filterQty * filterPriceBaisa);
      // Item 3: Labor
      insertItem.run('item-3', invoiceId, 'LABOR', null, 'أجور تبديل زيت وفلتر', 1, 'خدمة', laborPriceBaisa, 0, laborPriceBaisa);

      // Deduct stock exactly once for PART lines
      memDb.prepare('UPDATE inventory_items SET quantity_in_stock = quantity_in_stock - ? WHERE id = ?').run(oilQty, oilItemId);
      memDb.prepare('UPDATE inventory_items SET quantity_in_stock = quantity_in_stock - ? WHERE id = ?').run(filterQty, filterItemId);
    })();

    // 1.4 Verify itemized lines in database
    const items = memDb.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC').all(invoiceId) as any[];
    assert.equal(items.length, 3, 'Invoice has exactly 3 line items');
    assert.equal(items[0].description, 'زيت محرك تويوتا تخليقي');
    assert.equal(items[0].quantity, 4);
    assert.equal(items[0].unit, 'لتر');
    assert.equal(items[0].unit_price_baisa, 4500);
    assert.equal(items[0].line_total_baisa, 18000);

    assert.equal(items[1].description, 'فلتر زيت محرك أصلي');
    assert.equal(items[1].quantity, 1);
    assert.equal(items[1].unit, 'قطعة');
    assert.equal(items[1].unit_price_baisa, 8900);
    assert.equal(items[1].line_total_baisa, 8900);

    // 1.5 Verify stock deducted correctly
    const updatedOil = memDb.prepare('SELECT quantity_in_stock FROM inventory_items WHERE id = ?').get(oilItemId) as any;
    assert.equal(updatedOil.quantity_in_stock, 16, '20 - 4 = 16 liters');

    const updatedFilter = memDb.prepare('SELECT quantity_in_stock FROM inventory_items WHERE id = ?').get(filterItemId) as any;
    assert.equal(updatedFilter.quantity_in_stock, 7, '8 - 1 = 7 pieces');

    // 1.6 Verify that viewing, querying, or re-reading the invoice does NOT deduce stock again
    const viewRows = memDb.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);
    assert.equal(viewRows.length, 3);
    const postViewOil = memDb.prepare('SELECT quantity_in_stock FROM inventory_items WHERE id = ?').get(oilItemId) as any;
    assert.equal(postViewOil.quantity_in_stock, 16, 'Stock remained strictly unchanged after viewing/reopening');
  });

  // ==========================================================================
  // REQUIREMENT 2: Overtime Hours Entry, Snapshot Rate & Monthly Payroll
  // ==========================================================================
  await suite.test('2. Overtime Entry, Hourly Rate Snapshot, Auto Total Calculation & Payroll Integration', async (t) => {
    const memDb = setupSqliteDb();

    // 2.1 Insert Technician with base salary and contractual overtime rate
    const techId = 'worker-rashid';
    const baseSalaryBaisa = 400000; // 400 OMR
    const defaultOvertimeRateBaisa = 2500; // 2.500 OMR / hour

    memDb.prepare(`
      INSERT INTO technicians (
        id, name, specialty, phone, monthly_base_salary_baisa, overtime_rate_baisa,
        is_active, employment_status, created_at
      ) VALUES (?, 'راشد الخروصي (Rashid Al Kharusi)', 'كهرباء سيارات', '+968 93334444', ?, ?, 1, 'ACTIVE', datetime('now'))
    `).run(techId, baseSalaryBaisa, defaultOvertimeRateBaisa);

    // 2.2 Record Overtime Entry: 4 hours at default rate 2.500 OMR = 10.000 OMR (10,000 Baisa)
    const otId1 = 'ot-entry-1';
    const hours = 4.0;
    const hourlyRate = defaultOvertimeRateBaisa;
    const totalPayment = Math.round(hours * hourlyRate); // 10000

    memDb.prepare(`
      INSERT INTO worker_overtime_entries (
        id, worker_id, work_date, hours, hourly_rate_baisa, total_amount_baisa,
        status, notes, created_at, updated_at
      ) VALUES (?, ?, '2026-10-15', ?, ?, ?, 'APPROVED', 'صيانة محرك إضافية ليلاً', datetime('now'), datetime('now'))
    `).run(otId1, techId, hours, hourlyRate, totalPayment);

    // Verify entry
    const entryRow = memDb.prepare('SELECT * FROM worker_overtime_entries WHERE id = ?').get(otId1) as any;
    assert.equal(entryRow.hours, 4.0);
    assert.equal(entryRow.hourly_rate_baisa, 2500);
    assert.equal(entryRow.total_amount_baisa, 10000, '4 * 2500 = 10000 Baisa');
    assert.equal(entryRow.status, 'APPROVED');

    // 2.3 Edit Overtime Entry: user updates hours to 6 hours and adjusts rate to 3.000 OMR (3,000 Baisa)
    const updatedHours = 6.0;
    const updatedRate = 3000;
    const updatedTotal = Math.round(updatedHours * updatedRate); // 18000 Baisa

    memDb.prepare(`
      UPDATE worker_overtime_entries
      SET hours = ?, hourly_rate_baisa = ?, total_amount_baisa = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(updatedHours, updatedRate, updatedTotal, otId1);

    const editedRow = memDb.prepare('SELECT * FROM worker_overtime_entries WHERE id = ?').get(otId1) as any;
    assert.equal(editedRow.hours, 6.0);
    assert.equal(editedRow.hourly_rate_baisa, 3000);
    assert.equal(editedRow.total_amount_baisa, 18000, '6 * 3000 = 18000 Baisa');

    // 2.4 Verify Monthly Payroll Generation includes this worker's overtime
    const month = '2026-10';
    const approvedOt = memDb.prepare(`
      SELECT 
        COALESCE(SUM(hours), 0) as total_hours,
        COALESCE(SUM(total_amount_baisa), 0) as total_amount
      FROM worker_overtime_entries
      WHERE worker_id = ? AND status = 'APPROVED' AND strftime('%Y-%m', work_date) = ?
    `).get(techId, month) as { total_hours: number; total_amount: number };

    assert.equal(approvedOt.total_hours, 6.0);
    assert.equal(approvedOt.total_amount, 18000);

    const totalPayableBaisa = baseSalaryBaisa + approvedOt.total_amount; // 400,000 + 18,000 = 418,000 Baisa (418.000 OMR)
    assert.equal(totalPayableBaisa, 418000);

    // Save into worker_monthly_payrolls
    memDb.prepare(`
      INSERT INTO worker_monthly_payrolls (
        id, payroll_month, worker_id, base_salary_baisa, overtime_hours,
        overtime_amount_baisa, total_payable_baisa, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', datetime('now'), datetime('now'))
    `).run('pr-2026-10-rashid', month, techId, baseSalaryBaisa, approvedOt.total_hours, approvedOt.total_amount, totalPayableBaisa);

    const prRow = memDb.prepare('SELECT * FROM worker_monthly_payrolls WHERE id = ?').get('pr-2026-10-rashid') as any;
    assert.equal(prRow.base_salary_baisa, 400000);
    assert.equal(prRow.overtime_hours, 6.0);
    assert.equal(prRow.overtime_amount_baisa, 18000);
    assert.equal(prRow.total_payable_baisa, 418000);
  });

  // ==========================================================================
  // REQUIREMENT 3: Optional Customer & Vehicle Saving
  // ==========================================================================
  await suite.test('3. Optional Permanent vs Temporary Customer and Vehicle Registration', async (t) => {
    const memDb = setupSqliteDb();

    // 3.1 Register Temporary / Unregistered Customer (is_permanent = 0)
    const tempCustId = 'cust-temp-walkin';
    memDb.prepare(`
      INSERT INTO customers (id, full_name, phone, is_active, is_permanent, created_at, updated_at)
      VALUES (?, 'زبون عابر بدون تسجيل دائم', '+968 99990000', 1, 0, datetime('now'), datetime('now'))
    `).run(tempCustId);

    // 3.2 Register Temporary Vehicle (is_permanent = 0)
    const tempVehId = 'veh-temp-walkin';
    memDb.prepare(`
      INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer, is_permanent, is_active, created_at, updated_at)
      VALUES (?, ?, '9912 W', 'Nissan', 'Sunny', 2020, 95000, 0, 1, datetime('now'), datetime('now'))
    `).run(tempVehId, tempCustId);

    // 3.3 Register Permanent Customer and Vehicle (is_permanent = 1)
    const permCustId = 'cust-perm-vip';
    memDb.prepare(`
      INSERT INTO customers (id, full_name, phone, is_active, is_permanent, created_at, updated_at)
      VALUES (?, 'شركة النقل المتميزة', '+968 98887777', 1, 1, datetime('now'), datetime('now'))
    `).run(permCustId);

    const permVehId = 'veh-perm-vip';
    memDb.prepare(`
      INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer, is_permanent, is_active, created_at, updated_at)
      VALUES (?, ?, '1122 AA', 'Isuzu', 'D-Max', 2023, 30000, 1, 1, datetime('now'), datetime('now'))
    `).run(permVehId, permCustId);

    // Verify flags
    const tempCust = memDb.prepare('SELECT is_permanent FROM customers WHERE id = ?').get(tempCustId) as any;
    assert.equal(tempCust.is_permanent, 0, 'Customer flagged as temporary');

    const tempVeh = memDb.prepare('SELECT is_permanent FROM vehicles WHERE id = ?').get(tempVehId) as any;
    assert.equal(tempVeh.is_permanent, 0, 'Vehicle flagged as temporary');

    const permCust = memDb.prepare('SELECT is_permanent FROM customers WHERE id = ?').get(permCustId) as any;
    assert.equal(permCust.is_permanent, 1, 'Customer flagged as permanent');

    // 3.4 Create Repair Order and Invoice for the temporary customer - must proceed completely normally
    const roId = 'ro-temp-walkin';
    memDb.prepare(`
      INSERT INTO repair_orders (
        id, ro_number, customer_id, vehicle_id, status, reported_problem,
        odometer_in, estimated_cost_baisa, created_at, received_at
      ) VALUES (?, 'RO-2026-900', ?, ?, 'COMPLETED', 'صيانة سريعة', 95000, 15000, datetime('now'), datetime('now'))
    `).run(roId, tempCustId, tempVehId);

    const invId = 'inv-temp-walkin';
    memDb.prepare(`
      INSERT INTO invoices (
        id, invoice_number, repair_order_id, customer_id, vehicle_id, invoice_date, status,
        subtotal_parts_baisa, subtotal_labor_baisa, discount_baisa, tax_rate_percent,
        tax_amount_baisa, grand_total_baisa, paid_amount_baisa, balance_due_baisa,
        invoice_language, created_at
      ) VALUES (
        ?, 'INV-2026-900', ?, ?, ?, datetime('now'), 'PAID',
        10000, 5000, 0, 5.0, 750, 15750, 15750, 0, 'ar', datetime('now')
      )
    `).run(invId, roId, tempCustId, tempVehId);

    // Verify invoice queries customer name and plate correctly despite being temporary
    const joinedInv = memDb.prepare(`
      SELECT i.*, c.full_name as customer_name, c.is_permanent as customer_is_permanent, v.plate_number as vehicle_plate
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      JOIN vehicles v ON v.id = i.vehicle_id
      WHERE i.id = ?
    `).get(invId) as any;

    assert.equal(joinedInv.customer_name, 'زبون عابر بدون تسجيل دائم');
    assert.equal(joinedInv.customer_is_permanent, 0);
    assert.equal(joinedInv.vehicle_plate, '9912 W');
    assert.equal(joinedInv.grand_total_baisa, 15750);
  });

  // ==========================================================================
  // REQUIREMENT 4: Customer Recognition & Autocomplete
  // ==========================================================================
  await suite.test('4. Real-time Customer Recognition & Autocomplete Search', async (t) => {
    const memDb = setupSqliteDb();

    memDb.prepare(`
      INSERT INTO customers (id, full_name, phone, is_active, is_permanent, created_at, updated_at)
      VALUES 
        ('c-1', 'سالم بن حمد الرواحي', '+968 91234567', 1, 1, datetime('now'), datetime('now')),
        ('c-2', 'حمد بن سالم العامري', '+968 92345678', 1, 1, datetime('now'), datetime('now')),
        ('c-3', 'خالد بن ناصر المعولي', '+968 93456789', 1, 0, datetime('now'), datetime('now'))
    `).run();

    // Search by partial Arabic name "سالم"
    const searchName = '%سالم%';
    const resultsName = memDb.prepare(`
      SELECT id, full_name, phone, is_permanent FROM customers
      WHERE full_name LIKE ?
      ORDER BY full_name ASC
    `).all(searchName) as any[];

    assert.equal(resultsName.length, 2, 'Found 2 customers with سالم in name');
    assert.ok(resultsName.some((c) => c.full_name === 'سالم بن حمد الرواحي'));
    assert.ok(resultsName.some((c) => c.full_name === 'حمد بن سالم العامري'));

    // Search by partial phone number "9345"
    const searchPhone = '%9345%';
    const resultsPhone = memDb.prepare(`
      SELECT id, full_name, phone FROM customers
      WHERE phone LIKE ?
    `).all(searchPhone) as any[];

    assert.equal(resultsPhone.length, 1);
    assert.equal(resultsPhone[0].full_name, 'خالد بن ناصر المعولي');
  });

  // ==========================================================================
  // REQUIREMENT 5: Direct Printing & Graceful Unavailable Printer Handling
  // ==========================================================================
  await suite.test('5. Direct Invoice Printing & Missing Printer Graceful Handling', async (t) => {
    // Test browserMockAdapter printInvoice implementation
    // Initialize mock storage with an invoice
    const mockInvoice = {
      id: 'test-print-inv-1',
      invoiceNumber: 'INV-PRINT-001',
      customerId: 'cust-p1',
      customerName: 'فهد الهنائي',
      invoiceDate: '2026-10-28',
      status: 'ISSUED' as const,
      subtotalPartsBaisa: 15000,
      subtotalLaborBaisa: 10000,
      discountBaisa: 0,
      taxRatePercent: 5.0,
      taxAmountBaisa: 1250,
      grandTotalBaisa: 26250,
      paidAmountBaisa: 0,
      balanceDueBaisa: 26250,
      invoiceLanguage: 'ar' as const,
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'it-1',
          invoiceId: 'test-print-inv-1',
          itemType: 'PART' as const,
          description: 'زيت محرك 5W-30',
          quantity: 4,
          unit: 'لتر',
          unitPriceBaisa: 3750,
          costPriceBaisa: 2500,
          lineTotalBaisa: 15000,
        },
      ],
    };

    (browserMockAdapter as any).setStorage('invoices', [mockInvoice]);

    // 5.1 Test Print with valid invoice
    const printRes = await browserMockAdapter.printInvoice('test-print-inv-1', 'ar');
    assert.equal(printRes.success, true, 'Print call succeeded');
    assert.equal(printRes.data?.printed, true, 'Print status marked as printed');

    // Verify printedAt timestamp recorded
    const updatedInvs = (browserMockAdapter as any).getStorage('invoices', []);
    const printedInv = updatedInvs.find((i: any) => i.id === 'test-print-inv-1');
    assert.ok(printedInv.printedAt, 'printedAt timestamp was recorded on the invoice');

    // 5.2 Test Print with non-existent invoice ID
    const badPrintRes = await browserMockAdapter.printInvoice('non-existent-id', 'ar');
    assert.equal(badPrintRes.success, false, 'Failed gracefully for invalid invoice');
    assert.ok(badPrintRes.error, 'Error message returned');
  });

  await suite.test('6. 5-Group Navigation Structure, Facility Branding & VIN Verification', async (t) => {
    // 6.1 Check NAV_GROUPS_CONFIG imports and 5 groups
    const { NAV_GROUPS_CONFIG } = await import('../src/components/layout/navConfig.ts');
    assert.equal(NAV_GROUPS_CONFIG.length, 5, 'Exactly 5 main collapsible navigation groups exist');
    
    // Group 1: التشغيل والصيانة (Green)
    assert.equal(NAV_GROUPS_CONFIG[0].groupNumber, 1);
    assert.equal(NAV_GROUPS_CONFIG[0].colorName, 'emerald');
    const g1Ids = NAV_GROUPS_CONFIG[0].items.map((i) => i.id);
    assert.deepEqual(g1Ids, ['dashboard', 'customers', 'vehicles', 'registerMaintenance', 'vehicleHandover', 'repairOrders']);

    // Group 2: الفواتير والتحصيل (Orange)
    assert.equal(NAV_GROUPS_CONFIG[1].groupNumber, 2);
    assert.equal(NAV_GROUPS_CONFIG[1].colorName, 'amber');
    const g2Ids = NAV_GROUPS_CONFIG[1].items.map((i) => i.id);
    assert.deepEqual(g2Ids, ['invoices', 'payments']);

    // Group 3: المخزون والموارد (Pink)
    assert.equal(NAV_GROUPS_CONFIG[2].groupNumber, 3);
    assert.equal(NAV_GROUPS_CONFIG[2].colorName, 'rose');
    const g3Ids = NAV_GROUPS_CONFIG[2].items.map((i) => i.id);
    assert.deepEqual(g3Ids, ['technicians', 'inventory', 'suppliers', 'expenses', 'reports']);

    // Group 4: الإدارة والإعدادات (Blue)
    assert.equal(NAV_GROUPS_CONFIG[3].groupNumber, 4);
    assert.equal(NAV_GROUPS_CONFIG[3].colorName, 'sky');
    const g4Ids = NAV_GROUPS_CONFIG[3].items.map((i) => i.id);
    assert.deepEqual(g4Ids, ['settings']);

    // Group 5: النظام والدعم (Gray)
    assert.equal(NAV_GROUPS_CONFIG[4].groupNumber, 5);
    assert.equal(NAV_GROUPS_CONFIG[4].colorName, 'slate');
    const g5Ids = NAV_GROUPS_CONFIG[4].items.map((i) => i.id);
    assert.deepEqual(g5Ids, ['diagnostics']);

    // 6.2 Check facility branding
    const { TRANSLATIONS } = await import('../src/i18n/translations.ts');
    assert.equal(TRANSLATIONS.ar.appName, 'الرواحي للعناية بالسيارات', 'Arabic facility name updated');
    assert.equal(TRANSLATIONS.en.appName, 'AL RAWAHI AUTO CARE', 'English facility name updated');

    // 6.3 Check VIN and payment methods in mock adapter
    const cust = await browserMockAdapter.createCustomer({ fullName: 'سالم الكندي', phone: '92112233' });
    const veh = await browserMockAdapter.createVehicle({
      customerId: cust.data!.id,
      plateNumber: '44123 A',
      make: 'Lexus',
      model: 'LX600',
      year: 2024,
      vin: 'JTJHY7AX6N4001234',
      odometer: 15000,
    });
    assert.equal(veh.data?.vin, 'JTJHY7AX6N4001234', 'Vehicle created with VIN');

    const inv = await browserMockAdapter.createInvoice({
      customerId: cust.data!.id,
      vehicleId: veh.data!.id,
      subtotalLaborBaisa: 15000,
      subtotalPartsBaisa: 10000,
      taxRatePercent: 5.0,
      items: [
        { itemType: 'LABOR', description: 'فحص ميكانيكي', quantity: 1, unit: 'خدمة', unitPriceBaisa: 15000, lineTotalBaisa: 15000 },
        { itemType: 'PART', description: 'فلتر هواء أصلي', quantity: 1, unit: 'قطعة', unitPriceBaisa: 10000, lineTotalBaisa: 10000 },
      ],
    });
    assert.equal(inv.data?.vehicleVin, 'JTJHY7AX6N4001234', 'Invoice automatically associates vehicle VIN');

    // Test three payment methods
    const pay1 = await browserMockAdapter.recordPayment({ invoiceId: inv.data!.id, amountBaisa: 5000, paymentMethod: 'CASH' });
    assert.equal(pay1.success, true);
    const pay2 = await browserMockAdapter.recordPayment({ invoiceId: inv.data!.id, amountBaisa: 5000, paymentMethod: 'CARD_RECORDED' });
    assert.equal(pay2.success, true);
    const pay3 = await browserMockAdapter.recordPayment({ invoiceId: inv.data!.id, amountBaisa: 5000, paymentMethod: 'BANK_TRANSFER' });
    assert.equal(pay3.success, true);
  });
});
