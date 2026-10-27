/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Initial SQLite Database Schema (Migration 001)
 * 
 * Principles:
 * - Foreign key enforcement: Enabled
 * - All monetary amounts: Stored as INTEGER Baisa
 * - Auditability: All tables have timestamps
 * - Data Integrity: Unique constraints on plate numbers, part codes, RO numbers, invoice numbers
 */

export const INITIAL_SCHEMA_SQL = `
-- Enforce Foreign Keys
PRAGMA foreign_keys = ON;

-- 1. Schema Migration History
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. System Settings (Key-Value)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(full_name);

-- 4. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  plate_number TEXT NOT NULL UNIQUE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  vin TEXT,
  odometer INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);

-- 5. Technicians
CREATE TABLE IF NOT EXISTS technicians (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  specialty TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Repair Orders
CREATE TABLE IF NOT EXISTS repair_orders (
  id TEXT PRIMARY KEY,
  ro_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN (
    'RECEIVED', 'UNDER_INSPECTION', 'AWAITING_APPROVAL', 'AWAITING_PARTS',
    'UNDER_REPAIR', 'QUALITY_CHECK', 'COMPLETED', 'READY_FOR_COLLECTION',
    'DELIVERED', 'CANCELLED'
  )),
  odometer_in INTEGER NOT NULL,
  reported_problem TEXT NOT NULL,
  inspection_notes TEXT,
  requested_work TEXT,
  estimated_cost_baisa INTEGER NOT NULL DEFAULT 0,
  customer_approved INTEGER NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS idx_ro_status ON repair_orders(status);
CREATE INDEX IF NOT EXISTS idx_ro_vehicle ON repair_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_ro_customer ON repair_orders(customer_id);

-- 7. Repair Order Status History (Audit Trail)
CREATE TABLE IF NOT EXISTS repair_order_status_history (
  id TEXT PRIMARY KEY,
  repair_order_id TEXT NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  remarks TEXT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ro_history_ro ON repair_order_status_history(repair_order_id);

-- 8. Labor Tasks
CREATE TABLE IF NOT EXISTS labor_tasks (
  id TEXT PRIMARY KEY,
  repair_order_id TEXT NOT NULL,
  technician_id TEXT,
  description TEXT NOT NULL,
  labor_charge_baisa INTEGER NOT NULL,
  internal_cost_baisa INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  work_date TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE SET NULL
);

-- 9. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  part_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  quantity_in_stock REAL NOT NULL DEFAULT 0,
  purchase_cost_baisa INTEGER NOT NULL DEFAULT 0,
  selling_price_baisa INTEGER NOT NULL DEFAULT 0,
  min_stock_level REAL NOT NULL DEFAULT 1,
  supplier_id TEXT,
  location TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_code ON inventory_items(part_code);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);

-- 11. Inventory Movements Ledger
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK(movement_type IN ('PURCHASE_RECEIPT', 'RO_ISSUE', 'RETURN_TO_STOCK', 'MANUAL_ADJUSTMENT')),
  quantity_delta REAL NOT NULL,
  unit_cost_baisa INTEGER NOT NULL,
  reference_type TEXT CHECK(reference_type IN ('PURCHASE', 'REPAIR_ORDER', 'ADJUSTMENT')),
  reference_id TEXT,
  reason TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_movements_item ON inventory_movements(item_id);

-- 12. Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  repair_order_id TEXT,
  customer_id TEXT NOT NULL,
  vehicle_id TEXT,
  invoice_date TEXT NOT NULL DEFAULT (date('now')),
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK(status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
  subtotal_parts_baisa INTEGER NOT NULL DEFAULT 0,
  subtotal_labor_baisa INTEGER NOT NULL DEFAULT 0,
  discount_baisa INTEGER NOT NULL DEFAULT 0,
  tax_rate_percent REAL NOT NULL DEFAULT 5.0,
  tax_amount_baisa INTEGER NOT NULL DEFAULT 0,
  grand_total_baisa INTEGER NOT NULL DEFAULT 0,
  paid_amount_baisa INTEGER NOT NULL DEFAULT 0,
  balance_due_baisa INTEGER NOT NULL DEFAULT 0,
  invoice_language TEXT NOT NULL DEFAULT 'ar' CHECK(invoice_language IN ('ar', 'en')),
  tax_rules_snapshot TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);

-- 13. Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('PART', 'LABOR')),
  source_id TEXT,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price_baisa INTEGER NOT NULL,
  cost_price_baisa INTEGER NOT NULL DEFAULT 0,
  line_total_baisa INTEGER NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- 14. Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  payment_number TEXT NOT NULL UNIQUE,
  invoice_id TEXT NOT NULL,
  payment_date TEXT NOT NULL DEFAULT (date('now')),
  amount_baisa INTEGER NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'BANK_TRANSFER', 'CARD_RECORDED')),
  reference_number TEXT,
  receipt_notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT
);

-- 15. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  expense_date TEXT NOT NULL DEFAULT (date('now')),
  category TEXT NOT NULL CHECK(category IN ('RENT', 'ELECTRICITY_WATER', 'SALARIES', 'TOOLS_EQUIPMENT', 'GARAGE_MAINTENANCE', 'SUPPLIES', 'OTHER')),
  amount_baisa INTEGER NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'BANK_TRANSFER', 'CARD_RECORDED')),
  payee TEXT NOT NULL,
  description TEXT,
  receipt_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 16. Cash Transactions (Cash Register)
CREATE TABLE IF NOT EXISTS cash_transactions (
  id TEXT PRIMARY KEY,
  transaction_date TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL CHECK(type IN ('CASH_IN', 'CASH_OUT')),
  amount_baisa INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('INVOICE_PAYMENT', 'EXPENSE', 'MANUAL_DEPOSIT', 'MANUAL_WITHDRAWAL')),
  reference_id TEXT,
  description TEXT,
  balance_after_baisa INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 17. Immutable Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_state_json TEXT,
  new_state_json TEXT,
  performed_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
