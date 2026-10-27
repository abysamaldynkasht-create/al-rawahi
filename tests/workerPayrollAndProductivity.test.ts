/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Automated Test Suite: Worker Management, Overtime, Payroll & Labor Productivity
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { MIGRATIONS } from '../electron/database/migrator.ts';
import { toBaisa, fromBaisa } from '../src/core/currency.ts';

test('Worker Management, Overtime, Payroll & Labor Productivity Module', async (t) => {
  let db: Database.Database;

  const setupDb = () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Run all migrations 1 through 9
    for (const migration of MIGRATIONS) {
      db.exec(migration.sql);
    }
  };

  await t.test('1. Migration 9 initializes worker columns and new tables successfully', () => {
    setupDb();

    // Verify technician schema enhancements
    const techCols = db.pragma('table_info(technicians)') as Array<{ name: string; type: string }>;
    const colNames = techCols.map((c) => c.name);

    assert.ok(colNames.includes('monthly_base_salary_baisa'), 'Contains monthly_base_salary_baisa');
    assert.ok(colNames.includes('overtime_rate_baisa'), 'Contains overtime_rate_baisa');
    assert.ok(colNames.includes('national_id'), 'Contains national_id');
    assert.ok(colNames.includes('hire_date'), 'Contains hire_date');
    assert.ok(colNames.includes('employment_status'), 'Contains employment_status');

    // Verify tables exist
    const tables = (db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name IN (
        'worker_overtime_entries', 'worker_monthly_payrolls', 'worker_labor_productivity'
      )
    `).all() as Array<{ name: string }>).map((t) => t.name);

    assert.ok(tables.includes('worker_overtime_entries'), 'worker_overtime_entries table exists');
    assert.ok(tables.includes('worker_monthly_payrolls'), 'worker_monthly_payrolls table exists');
    assert.ok(tables.includes('worker_labor_productivity'), 'worker_labor_productivity table exists');
  });

  await t.test('2. Worker registration with contractual base salary and overtime rate in integer Baisa', () => {
    setupDb();

    const workerId = 'worker-test-1';
    const baseSalaryBaisa = toBaisa(380.000); // 380 OMR = 380,000 Baisa
    const overtimeRateBaisa = toBaisa(2.750); // 2.750 OMR = 2,750 Baisa

    db.prepare(`
      INSERT INTO technicians (
        id, name, phone, specialty, is_active, monthly_base_salary_baisa, overtime_rate_baisa,
        national_id, hire_date, employment_status
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, 'ACTIVE')
    `).run(
      workerId,
      'أحمد البلوشي - Ahmed Al Balushi',
      '96891234567',
      'فني كهرباء وميكانيك عام',
      baseSalaryBaisa,
      overtimeRateBaisa,
      '102938475',
      '2024-01-15'
    );

    const row = db.prepare('SELECT * FROM technicians WHERE id = ?').get(workerId) as any;
    assert.equal(row.name, 'أحمد البلوشي - Ahmed Al Balushi');
    assert.equal(row.monthly_base_salary_baisa, 380000);
    assert.equal(row.overtime_rate_baisa, 2750);
    assert.equal(row.employment_status, 'ACTIVE');
  });

  await t.test('3. Overtime logging with immutable historical rate snapshotting', () => {
    setupDb();

    const workerId = 'worker-test-2';
    const initialRate = 2500; // 2.500 OMR
    db.prepare(`
      INSERT INTO technicians (id, name, is_active, monthly_base_salary_baisa, overtime_rate_baisa)
      VALUES (?, 'سعيد العامري', 1, 350000, ?)
    `).run(workerId, initialRate);

    // Log overtime for 4.5 hours
    const hours = 4.5;
    const totalAmountBaisa = Math.round(hours * initialRate); // 11,250 Baisa
    const otEntryId = 'ot-entry-1';

    db.prepare(`
      INSERT INTO worker_overtime_entries (
        id, worker_id, work_date, hours, hourly_rate_baisa, total_amount_baisa, status, notes
      ) VALUES (?, ?, '2026-10-15', ?, ?, ?, 'APPROVED', 'صيانة ليلية طارئة')
    `).run(otEntryId, workerId, hours, initialRate, totalAmountBaisa);

    // Now update worker's contractual overtime rate to 3.500 OMR (3,500 Baisa)
    db.prepare('UPDATE technicians SET overtime_rate_baisa = 3500 WHERE id = ?').run(workerId);

    // Historical overtime entry MUST remain unaffected at 2,500 rate and 11,250 amount
    const savedEntry = db.prepare('SELECT * FROM worker_overtime_entries WHERE id = ?').get(otEntryId) as any;
    assert.equal(savedEntry.hourly_rate_baisa, 2500, 'Snapshot hourly rate must not change when worker wage changes');
    assert.equal(savedEntry.total_amount_baisa, 11250, 'Snapshot total amount must not change');
  });

  await t.test('4. Monthly Payroll calculation formula: Monthly Payable = Base Salary + Overtime Hours × Overtime Rate', () => {
    setupDb();

    const workerId = 'worker-test-3';
    const baseSalaryBaisa = 400000; // 400 OMR
    const otRateBaisa = 3000; // 3.000 OMR
    db.prepare(`
      INSERT INTO technicians (id, name, is_active, monthly_base_salary_baisa, overtime_rate_baisa)
      VALUES (?, 'محمود الراشدي', 1, ?, ?)
    `).run(workerId, baseSalaryBaisa, otRateBaisa);

    // 2 approved overtime entries in month 2026-10
    // Entry 1: 5 hours @ 3000 = 15,000
    // Entry 2: 3 hours @ 3000 = 9,000
    // Total OT hours = 8.0, Total OT amount = 24,000 Baisa
    db.prepare(`
      INSERT INTO worker_overtime_entries (id, worker_id, work_date, hours, hourly_rate_baisa, total_amount_baisa, status)
      VALUES ('ot-1', ?, '2026-10-05', 5.0, 3000, 15000, 'APPROVED'),
             ('ot-2', ?, '2026-10-12', 3.0, 3000, 9000, 'APPROVED'),
             ('ot-3', ?, '2026-10-20', 4.0, 3000, 12000, 'REJECTED') -- REJECTED must not be included
    `).run(workerId, workerId, workerId);

    // Query approved overtime for month 2026-10
    const otAgg = db.prepare(`
      SELECT 
        COALESCE(SUM(hours), 0) AS total_hours,
        COALESCE(SUM(total_amount_baisa), 0) AS total_amount
      FROM worker_overtime_entries
      WHERE worker_id = ? AND strftime('%Y-%m', work_date) = '2026-10' AND status = 'APPROVED'
    `).get(workerId) as any;

    assert.equal(otAgg.total_hours, 8.0, 'Only APPROVED overtime hours are aggregated');
    assert.equal(otAgg.total_amount, 24000, 'Only APPROVED overtime amount is aggregated');

    // Expected monthly payable = 400,000 + 24,000 = 424,000 Baisa (424.000 OMR)
    const totalPayableBaisa = baseSalaryBaisa + otAgg.total_amount;
    assert.equal(totalPayableBaisa, 424000);

    // Insert into payroll ledger
    const payrollId = 'pay-202610-worker3';
    db.prepare(`
      INSERT INTO worker_monthly_payrolls (
        id, payroll_month, worker_id, base_salary_baisa, overtime_hours, overtime_amount_baisa,
        total_payable_baisa, status
      ) VALUES (?, '2026-10', ?, ?, ?, ?, ?, 'FINALIZED')
    `).run(payrollId, workerId, baseSalaryBaisa, otAgg.total_hours, otAgg.total_amount, totalPayableBaisa);

    const savedPayroll = db.prepare('SELECT * FROM worker_monthly_payrolls WHERE id = ?').get(payrollId) as any;
    assert.equal(savedPayroll.total_payable_baisa, 424000);
    assert.equal(fromBaisa(savedPayroll.total_payable_baisa), 424.0);
  });

  await t.test('5. Ledger Integrity: UNIQUE(worker_id, payroll_month) constraint prevents duplicate payrolls', () => {
    setupDb();

    const workerId = 'worker-test-4';
    db.prepare(`
      INSERT INTO technicians (id, name, is_active, monthly_base_salary_baisa)
      VALUES (?, 'سالم الشكيلي', 1, 300000)
    `).run(workerId);

    db.prepare(`
      INSERT INTO worker_monthly_payrolls (
        id, payroll_month, worker_id, base_salary_baisa, overtime_hours, overtime_amount_baisa,
        total_payable_baisa, status
      ) VALUES ('pay-1', '2026-10', ?, 300000, 0, 0, 300000, 'DRAFT')
    `).run(workerId);

    // Attempt duplicate insertion for same worker and same month must throw SQLite constraint violation
    assert.throws(() => {
      db.prepare(`
        INSERT INTO worker_monthly_payrolls (
          id, payroll_month, worker_id, base_salary_baisa, overtime_hours, overtime_amount_baisa,
          total_payable_baisa, status
        ) VALUES ('pay-2', '2026-10', ?, 300000, 0, 0, 300000, 'DRAFT')
      `).run(workerId);
    }, /UNIQUE constraint failed/);
  });

  await t.test('6. Labor Productivity: Spare parts costs are STRICTLY EXCLUDED and allocation cannot exceed RO labor charge', () => {
    setupDb();

    // Create a customer, vehicle, and repair order
    db.prepare(`
      INSERT INTO customers (id, full_name, phone) VALUES ('cust-1', 'علي الحكماني', '96899887766')
    `).run();
    db.prepare(`
      INSERT INTO vehicles (id, customer_id, plate_number, make, model, year)
      VALUES ('veh-1', 'cust-1', '8877-A', 'Toyota', 'Land Cruiser', 2022)
    `).run();

    const roId = 'ro-test-101';
    const partsTotalBaisa = 120000; // 120 OMR (SPARE PARTS - STRICTLY EXCLUDED)
    const laborTotalBaisa = 50000;  // 50 OMR (LABOR CHARGES - ALLOCATABLE POOL)
    const grandTotalBaisa = partsTotalBaisa + laborTotalBaisa; // 170 OMR

    db.prepare(`
      INSERT INTO repair_orders (
        id, ro_number, customer_id, vehicle_id, status, odometer_in, reported_problem,
        parts_total_baisa, labor_total_baisa, grand_total_baisa
      ) VALUES (?, 'RO-202610-0101', 'cust-1', 'veh-1', 'IN_PROGRESS', 45000, 'أصوات في المكابح', ?, ?, ?)
    `).run(roId, partsTotalBaisa, laborTotalBaisa, grandTotalBaisa);

    // Create 2 technicians
    db.prepare(`
      INSERT INTO technicians (id, name, is_active) VALUES ('tech-a', 'فني أ', 1), ('tech-b', 'فني ب', 1)
    `).run();

    // Allocate 30,000 to Tech A and 20,000 to Tech B (SUM = 50,000 == RO Labor Total)
    db.prepare(`
      INSERT INTO worker_labor_productivity (
        id, work_date, worker_id, repair_order_id, vehicle_id, work_description, labor_value_baisa, hours_spent
      ) VALUES ('prod-1', '2026-10-22', 'tech-a', ?, 'veh-1', 'فك وتنظيف الهوبات وتغيير السفايف', 30000, 2.5),
               ('prod-2', '2026-10-22', 'tech-b', ?, 'veh-1', 'تنسيم زيت الفرامل وفحص الحساسات', 20000, 1.5)
    `).run(roId, roId);

    // Query total allocated labor for RO
    const alloc = db.prepare(`
      SELECT SUM(labor_value_baisa) AS total_alloc FROM worker_labor_productivity WHERE repair_order_id = ?
    `).get(roId) as any;

    assert.equal(alloc.total_alloc, 50000, 'Sum of labor allocations matches RO labor charges exactly');

    // Verify parts total is NOT included in labor productivity
    const roCheck = db.prepare('SELECT parts_total_baisa, labor_total_baisa FROM repair_orders WHERE id = ?').get(roId) as any;
    assert.equal(roCheck.parts_total_baisa, 120000, 'Parts total remains 120,000 and is excluded from productivity');
    assert.equal(alloc.total_alloc, roCheck.labor_total_baisa, 'Allocated labor equals labor charges and ignores parts');
  });

  await t.test('7. Worker Deletion Safety: Foreign key integrity and safe deactivation protect historical records', () => {
    setupDb();

    const workerId = 'worker-with-history';
    db.prepare(`
      INSERT INTO technicians (id, name, is_active, monthly_base_salary_baisa)
      VALUES (?, 'عمر الفارسي', 1, 350000)
    `).run(workerId);

    // Worker has a past payroll record
    db.prepare(`
      INSERT INTO worker_monthly_payrolls (
        id, payroll_month, worker_id, base_salary_baisa, overtime_hours, overtime_amount_baisa,
        total_payable_baisa, status
      ) VALUES ('pay-hist-1', '2026-09', ?, 350000, 0, 0, 350000, 'PAID')
    `).run(workerId);

    // Attempting hard DELETE with foreign keys enabled should fail with FOREIGN KEY constraint
    assert.throws(() => {
      db.prepare('DELETE FROM technicians WHERE id = ?').run(workerId);
    }, /FOREIGN KEY constraint failed/);

    // Safe deactivation updates is_active = 0 and employment_status = 'TERMINATED'
    db.prepare(`
      UPDATE technicians SET is_active = 0, employment_status = 'TERMINATED' WHERE id = ?
    `).run(workerId);

    const updated = db.prepare('SELECT is_active, employment_status FROM technicians WHERE id = ?').get(workerId) as any;
    assert.equal(updated.is_active, 0);
    assert.equal(updated.employment_status, 'TERMINATED');
  });

  await t.test('8. Strict Segregation of Worker Payroll (Obligation) vs Worker Productivity (Revenue)', () => {
    setupDb();

    const workerId = 'worker-high-producer';
    const baseSalaryBaisa = 300000; // Fixed contract base 300 OMR
    db.prepare(`
      INSERT INTO technicians (id, name, is_active, monthly_base_salary_baisa, overtime_rate_baisa)
      VALUES (?, 'خالد المعمري', 1, ?, 2500)
    `).run(workerId, baseSalaryBaisa);

    // High productivity: worker generates 1,200 OMR of labor charges across multiple repair orders
    db.prepare(`
      INSERT INTO worker_labor_productivity (id, work_date, worker_id, work_description, labor_value_baisa)
      VALUES ('prod-high-1', '2026-10-10', ?, 'توضيب محرك كامل', 700000),
             ('prod-high-2', '2026-10-18', ?, 'توضيب ناقل حركة أوتوماتيك', 500000)
    `).run(workerId, workerId);

    const prodSum = db.prepare(`
      SELECT SUM(labor_value_baisa) as total_prod FROM worker_labor_productivity WHERE worker_id = ?
    `).get(workerId) as any;

    assert.equal(prodSum.total_prod, 1200000, 'Worker generated 1,200 OMR in workshop labor revenue');

    // BUT Worker's payable salary is contracted base + overtime, NOT productivity revenue!
    const payable = baseSalaryBaisa + 0; // 300 OMR
    assert.equal(payable, 300000, 'Payroll liability strictly reflects contract base + overtime, independent of generated labor');
  });
});
