/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Database Migration Runner
 */

import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { INITIAL_SCHEMA_SQL } from './schema.ts';
import { hashPassword } from '../auth/passwords.ts';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: INITIAL_SCHEMA_SQL,
  },
  {
    version: 2,
    name: 'customer_vehicle_enhancements',
    sql: `
      ALTER TABLE customers ADD COLUMN alt_phone TEXT;
      ALTER TABLE customers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE vehicles ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
      ALTER TABLE vehicles ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
      CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);
      CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
      CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(is_active);
    `,
  },
  {
    version: 3,
    name: 'phase3_workflow_corrections_and_serials',
    sql: `
      CREATE TABLE IF NOT EXISTS customers_dg_tmp (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        notes TEXT,
        alt_phone TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO customers_dg_tmp (id, full_name, phone, email, address, notes, alt_phone, is_active, created_at, updated_at)
      SELECT id, full_name, phone, email, address, notes, alt_phone, is_active, created_at, updated_at FROM customers;
      DROP TABLE customers;
      ALTER TABLE customers_dg_tmp RENAME TO customers;
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(full_name);
      CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);

      -- Serial tracking minimal schema preparation for Phase 5
      ALTER TABLE inventory_items ADD COLUMN is_serialized INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE inventory_movements ADD COLUMN serial_number TEXT;

      CREATE TABLE IF NOT EXISTS inventory_serials (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        serial_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK(status IN ('IN_STOCK', 'ISSUED', 'RETURNED', 'DAMAGED')),
        repair_order_id TEXT,
        invoice_id TEXT,
        notes TEXT,
        received_at TEXT NOT NULL DEFAULT (datetime('now')),
        issued_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_serial 
        ON inventory_serials(serial_number) 
        WHERE status = 'IN_STOCK';
      CREATE INDEX IF NOT EXISTS idx_serials_number ON inventory_serials(serial_number);
      CREATE INDEX IF NOT EXISTS idx_serials_item ON inventory_serials(item_id);
    `,
  },
  {
    version: 4,
    name: 'customer_retention_workflow',
    sql: `
      -- 1. Add is_permanent column to customers (default 1 for all existing customers)
      ALTER TABLE customers ADD COLUMN is_permanent INTEGER NOT NULL DEFAULT 1;
      CREATE INDEX IF NOT EXISTS idx_customers_permanent ON customers(is_permanent);

      -- 2. Add retention tracking columns to invoices
      ALTER TABLE invoices ADD COLUMN retention_prompted INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN printed_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_invoices_retention ON invoices(retention_prompted);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    `,
  },
  {
    version: 5,
    name: 'repair_orders_and_inventory_integration',
    sql: `
      -- 1. Create repair_order_parts table for integrated inventory consumption
      CREATE TABLE IF NOT EXISTS repair_order_parts (
        id TEXT PRIMARY KEY,
        repair_order_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        part_code TEXT NOT NULL,
        part_name TEXT NOT NULL,
        serial_number TEXT,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price_baisa INTEGER NOT NULL,
        unit_cost_baisa INTEGER NOT NULL DEFAULT 0,
        total_price_baisa INTEGER NOT NULL,
        is_approved INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'ISSUED' CHECK(status IN ('ISSUED', 'RETURNED')),
        issued_at TEXT NOT NULL DEFAULT (datetime('now')),
        returned_at TEXT,
        return_reason TEXT,
        FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id) ON DELETE RESTRICT,
        FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_ro_parts_ro ON repair_order_parts(repair_order_id);
      CREATE INDEX IF NOT EXISTS idx_ro_parts_item ON repair_order_parts(item_id);
      CREATE INDEX IF NOT EXISTS idx_ro_parts_serial ON repair_order_parts(serial_number);

      -- 2. Enhance labor_tasks table with technician name, hours, and explicit customer approval
      ALTER TABLE labor_tasks ADD COLUMN is_approved INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE labor_tasks ADD COLUMN hours REAL DEFAULT 1.0;
      ALTER TABLE labor_tasks ADD COLUMN hourly_rate_baisa INTEGER DEFAULT 0;
      ALTER TABLE labor_tasks ADD COLUMN technician_name TEXT;

      -- 3. Upgrade repair_orders schema to support 10 canonical statuses and financial breakdowns
      CREATE TABLE IF NOT EXISTS repair_orders_new (
        id TEXT PRIMARY KEY,
        ro_number TEXT NOT NULL UNIQUE,
        customer_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN (
          'RECEIVED', 'UNDER_INSPECTION', 'AWAITING_APPROVAL', 'APPROVED',
          'IN_PROGRESS', 'UNDER_REPAIR', 'WAITING_FOR_PARTS', 'AWAITING_PARTS',
          'QUALITY_CHECK', 'READY_FOR_DELIVERY', 'READY_FOR_COLLECTION',
          'COMPLETED', 'DELIVERED', 'CANCELLED'
        )),
        odometer_in INTEGER NOT NULL,
        reported_problem TEXT NOT NULL,
        inspection_notes TEXT,
        requested_work TEXT,
        estimated_cost_baisa INTEGER NOT NULL DEFAULT 0,
        parts_total_baisa INTEGER NOT NULL DEFAULT 0,
        labor_total_baisa INTEGER NOT NULL DEFAULT 0,
        tax_amount_baisa INTEGER NOT NULL DEFAULT 0,
        grand_total_baisa INTEGER NOT NULL DEFAULT 0,
        customer_approved INTEGER NOT NULL DEFAULT 0,
        approval_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
        approved_at TEXT,
        approval_notes TEXT,
        assigned_technician_id TEXT,
        assigned_technician_name TEXT,
        warranty_period_months INTEGER DEFAULT 0,
        warranty_terms TEXT,
        received_at TEXT NOT NULL DEFAULT (datetime('now')),
        expected_at TEXT,
        completed_at TEXT,
        delivered_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT
      );

      INSERT INTO repair_orders_new (
        id, ro_number, customer_id, vehicle_id, status, odometer_in,
        reported_problem, inspection_notes, requested_work, estimated_cost_baisa,
        customer_approved, warranty_period_months, warranty_terms,
        received_at, expected_at, completed_at, delivered_at, created_at
      )
      SELECT 
        id, ro_number, customer_id, vehicle_id, 
        CASE 
          WHEN status = 'UNDER_REPAIR' THEN 'IN_PROGRESS'
          WHEN status = 'AWAITING_PARTS' THEN 'WAITING_FOR_PARTS'
          WHEN status = 'READY_FOR_COLLECTION' THEN 'READY_FOR_DELIVERY'
          ELSE status 
        END,
        odometer_in, reported_problem, inspection_notes, requested_work, estimated_cost_baisa,
        customer_approved, warranty_period_months, warranty_terms,
        received_at, expected_at, completed_at, delivered_at, created_at
      FROM repair_orders;

      DROP TABLE repair_orders;
      ALTER TABLE repair_orders_new RENAME TO repair_orders;

      CREATE INDEX IF NOT EXISTS idx_ro_status ON repair_orders(status);
      CREATE INDEX IF NOT EXISTS idx_ro_vehicle ON repair_orders(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_ro_customer ON repair_orders(customer_id);

      -- 4. Enhance inventory_items with manufacturer column
      ALTER TABLE inventory_items ADD COLUMN manufacturer TEXT;

      -- 5. Seed default technicians if table is empty
      INSERT OR IGNORE INTO technicians (id, name, phone, specialty, is_active, notes, created_at)
      VALUES 
        ('tech-1', 'أحمد البلوشي (Ahmed Al Balushi)', '+968 92345678', 'ميكانيكا عامة ومحركات (Engine & Transmission)', 1, 'كبير الفنيين خبرة 12 سنة', datetime('now')),
        ('tech-2', 'راجيش كومار (Rajesh Kumar)', '+968 93456789', 'كهرباء وفحص كمبيوتر (Auto Electrician & Diagnostic)', 1, 'أجهزة الفحص المتطورة وبرمجة الحساسات', datetime('now')),
        ('tech-3', 'سيف المعمري (Saif Al Maamari)', '+968 94567890', 'فرامل وميزانية ونظام تعليق (Brakes & Suspension)', 1, 'متخصص أنظمة الهيدروليك والفرامل', datetime('now'));
    `,
  },
  {
    version: 6,
    name: 'final_integration_integrity_and_idempotency',
    sql: `
      -- 1. Add idempotency_key column to repair_order_parts and partial unique index
      ALTER TABLE repair_order_parts ADD COLUMN idempotency_key TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ro_parts_idempotency 
        ON repair_order_parts(idempotency_key) 
        WHERE idempotency_key IS NOT NULL;

      -- 2. Prevent issuing the same serial number to multiple repair orders simultaneously
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ro_parts_active_serial 
        ON repair_order_parts(serial_number) 
        WHERE status = 'ISSUED' AND serial_number IS NOT NULL;

      -- 3. Prevent duplicate active invoices for the same repair order
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_ro_unique 
        ON invoices(repair_order_id) 
        WHERE repair_order_id IS NOT NULL AND status != 'CANCELLED';
    `,
  },
  {
    version: 7,
    name: 'technicians_hourly_rate_and_service_enhancements',
    sql: `
      ALTER TABLE technicians ADD COLUMN hourly_rate_baisa INTEGER NOT NULL DEFAULT 7000;
    `,
  },
  {
    version: 8,
    name: 'admin_authentication_and_printer_settings',
    sql: `
      -- 1. Single Administrator Table
      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- 2. Ensure only 1 administrator account can exist
      CREATE TRIGGER IF NOT EXISTS trg_single_admin_account
      BEFORE INSERT ON admin_users
      WHEN (SELECT COUNT(*) FROM admin_users) >= 1
      BEGIN
        SELECT RAISE(FAIL, 'Only one administrator account is permitted in AL RAWAHI GARAGE MANAGEMENT SYSTEM.');
      END;
    `,
  },
  {
    version: 9,
    name: 'worker_management_payroll_and_productivity',
    sql: `
      -- 1. Enhance technicians table with worker management & compensation fields
      ALTER TABLE technicians ADD COLUMN monthly_base_salary_baisa INTEGER NOT NULL DEFAULT 350000;
      ALTER TABLE technicians ADD COLUMN overtime_rate_baisa INTEGER NOT NULL DEFAULT 2500;
      ALTER TABLE technicians ADD COLUMN national_id TEXT;
      ALTER TABLE technicians ADD COLUMN hire_date TEXT;
      ALTER TABLE technicians ADD COLUMN employment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(employment_status IN ('ACTIVE', 'ON_LEAVE', 'TERMINATED'));

      -- 2. Worker Overtime Entries
      CREATE TABLE IF NOT EXISTS worker_overtime_entries (
        id TEXT PRIMARY KEY,
        worker_id TEXT NOT NULL,
        work_date TEXT NOT NULL,
        hours REAL NOT NULL CHECK(hours > 0 AND hours <= 24),
        hourly_rate_baisa INTEGER NOT NULL CHECK(hourly_rate_baisa >= 0),
        total_amount_baisa INTEGER NOT NULL CHECK(total_amount_baisa >= 0),
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
        approved_by TEXT,
        approved_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (worker_id) REFERENCES technicians(id) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_overtime_worker_date ON worker_overtime_entries(worker_id, work_date);
      CREATE INDEX IF NOT EXISTS idx_overtime_status ON worker_overtime_entries(status);

      -- 3. Monthly Payroll Records
      CREATE TABLE IF NOT EXISTS worker_monthly_payrolls (
        id TEXT PRIMARY KEY,
        payroll_month TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        base_salary_baisa INTEGER NOT NULL CHECK(base_salary_baisa >= 0),
        overtime_hours REAL NOT NULL DEFAULT 0.0 CHECK(overtime_hours >= 0),
        overtime_amount_baisa INTEGER NOT NULL DEFAULT 0 CHECK(overtime_amount_baisa >= 0),
        total_payable_baisa INTEGER NOT NULL CHECK(total_payable_baisa >= 0),
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'FINALIZED', 'PAID')),
        paid_at TEXT,
        payment_method TEXT CHECK(payment_method IN ('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER')),
        payment_reference TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (worker_id) REFERENCES technicians(id) ON DELETE RESTRICT,
        UNIQUE(worker_id, payroll_month)
      );
      CREATE INDEX IF NOT EXISTS idx_payroll_month ON worker_monthly_payrolls(payroll_month);
      CREATE INDEX IF NOT EXISTS idx_payroll_worker ON worker_monthly_payrolls(worker_id);

      -- 4. Daily Labor Productivity Tracking
      CREATE TABLE IF NOT EXISTS worker_labor_productivity (
        id TEXT PRIMARY KEY,
        work_date TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        repair_order_id TEXT,
        invoice_id TEXT,
        labor_task_id TEXT,
        vehicle_id TEXT,
        work_description TEXT NOT NULL,
        labor_value_baisa INTEGER NOT NULL CHECK(labor_value_baisa >= 0),
        hours_spent REAL DEFAULT 1.0 CHECK(hours_spent >= 0),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (worker_id) REFERENCES technicians(id) ON DELETE RESTRICT,
        FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id) ON DELETE SET NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
        FOREIGN KEY (labor_task_id) REFERENCES labor_tasks(id) ON DELETE SET NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_productivity_worker_date ON worker_labor_productivity(worker_id, work_date);
      CREATE INDEX IF NOT EXISTS idx_productivity_ro ON worker_labor_productivity(repair_order_id);
      CREATE INDEX IF NOT EXISTS idx_productivity_invoice ON worker_labor_productivity(invoice_id);
    `,
  },
  {
    version: 10,
    name: 'detailed_invoice_items_and_units_and_temporary_vehicles',
    sql: `
      -- 1. Support temporary vehicles in vehicles table
      ALTER TABLE vehicles ADD COLUMN is_permanent INTEGER NOT NULL DEFAULT 1;

      -- 2. Add units to inventory items (e.g. piece, liter, can, set)
      ALTER TABLE inventory_items ADD COLUMN unit TEXT DEFAULT 'قطعة';

      -- 3. Add units to repair order issued parts
      ALTER TABLE repair_order_parts ADD COLUMN unit TEXT DEFAULT 'قطعة';

      -- 4. Add units to invoice items
      ALTER TABLE invoice_items ADD COLUMN unit TEXT DEFAULT 'قطعة';
    `,
  },
];

function executeTransaction(db: any, fn: () => void) {
  if (typeof db.transaction === 'function') {
    db.transaction(fn)();
  } else {
    db.exec('BEGIN TRANSACTION;');
    try {
      fn();
      db.exec('COMMIT;');
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }
}

export function runMigrations(db: Database.Database): number {
  // 1. Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 2. Query applied migrations
  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as Array<{ version: number }>;
  const appliedSet = new Set(appliedRows.map((r) => r.version));

  let currentVersion = appliedRows.length > 0 ? appliedRows[appliedRows.length - 1].version : 0;

  // 3. Apply pending migrations inside a transaction
  for (const migration of MIGRATIONS) {
    if (!appliedSet.has(migration.version)) {
      console.log(`[Database Migrator] Applying migration ${migration.version}: ${migration.name}`);
      try {
        db.exec('PRAGMA foreign_keys = OFF;');
      } catch {}
      executeTransaction(db, () => {
        db.exec(migration.sql);
        db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
          migration.version,
          migration.name
        );
      });
      try {
        db.exec('PRAGMA foreign_keys = ON;');
      } catch {}
      currentVersion = migration.version;
    }
  }

  // 4. Seed default settings if empty
  const countRow = db.prepare('SELECT count(*) as count FROM settings').get() as { count: number };
  if (countRow.count === 0) {
    console.log('[Database Migrator] Seeding initial garage settings...');
    executeTransaction(db, () => {
      const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
      stmt.run('garage_name', 'الرواحي للعناية بالسيارات');
      stmt.run('garage_name_en', 'AL RAWAHI GARAGE');
      stmt.run('developer', 'AKASHA AI');
      stmt.run('currency_code', 'OMR');
      stmt.run('currency_symbol_ar', 'ر.ع.');
      stmt.run('default_tax_rate_percent', '5.0');
      stmt.run('default_language', 'ar');
      stmt.run('invoice_language_default', 'ar');
      stmt.run('phone_number', '+968 00000000');
      stmt.run('address', 'سلطنة عُمان');
      stmt.run('cr_number', '');
      stmt.run('vat_number', '');
      stmt.run('printer_paper_size', 'A4');
      stmt.run('printer_auto_print', '0');
      stmt.run('printer_preview_enabled', '1');
    });
  }

  // 5. Seed default administrator account if empty
  try {
    const adminCountRow = db.prepare('SELECT count(*) as count FROM admin_users').get() as { count: number };
    if (adminCountRow.count === 0) {
      console.log('[Database Migrator] Initializing default Administrator account (admin9988)...');
      const { hash, salt } = hashPassword('1122334455');
      executeTransaction(db, () => {
        db.prepare(`
          INSERT INTO admin_users (id, username, password_hash, salt, created_at, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(crypto.randomUUID(), 'admin9988', hash, salt);
      });
      console.log('[Database Migrator] Administrator account successfully initialized.');
    }
  } catch (err) {
    console.warn('[Database Migrator] Admin users check deferred or pending migration:', err);
  }

  return currentVersion;
}
