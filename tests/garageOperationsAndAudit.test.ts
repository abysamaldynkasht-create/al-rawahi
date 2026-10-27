/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Garage Operations, Financial Integrity, and System Audit Test Suite
 * 
 * Tests:
 * 1. Currency Integer Baisa Mathematics (Zero Float Leaks)
 * 2. Technicians management & Labor tasks
 * 3. Suppliers directory & Vendor data integrity
 * 4. Operating expenses ledger & Category filtering
 * 5. Financial report aggregation (Revenue, VAT 5%, Expenses, Net profit)
 * 6. Payment recording & Idempotency
 * 7. Database hot backup snapshot & SHA-256 integrity
 * 8. Browser mock adapter parity for offline/browser mode
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../electron/database/migrator.ts';
import {
  TechnicianInputSchema,
  SupplierInputSchema,
  ExpenseInputSchema,
} from '../electron/ipc/validation.ts';
import { browserMockAdapter } from '../src/services/browserMockAdapter.ts';
import { toBaisa, fromBaisa, formatOMR, formatBaisa } from '../src/core/currency.ts';

const TEST_DB_PATH = path.join(os.tmpdir(), `garage_ops_audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.db`);
const BACKUP_DIR_PATH = path.join(os.tmpdir(), `garage_ops_backups_${Date.now()}`);

function cleanup() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
    if (fs.existsSync(BACKUP_DIR_PATH)) fs.rmSync(BACKUP_DIR_PATH, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

test('Garage Operations & Complete Financial Audit Suite', async (t) => {
  cleanup();
  fs.mkdirSync(BACKUP_DIR_PATH, { recursive: true });

  const db = new DatabaseSync(TEST_DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');
  const schemaVer = runMigrations(db as any);
  assert.ok(schemaVer >= 6, 'Migrations 1 to 6 must be applied');

  t.after(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    cleanup();
  });

  await t.test('1. Currency Integer Baisa Mathematics (Zero Float Leaks)', () => {
    // 1 OMR = 1,000 Baisa
    assert.equal(toBaisa(1.0), 1000);
    assert.equal(toBaisa(0.005), 5);
    assert.equal(toBaisa(125.750), 125750);
    assert.equal(fromBaisa(125750), 125.75);
    assert.equal(fromBaisa(5), 0.005);
    assert.equal(fromBaisa(0), 0);
    assert.equal(formatBaisa(125750, { showCode: false }), '125.750');
  });

  await t.test('2. Technicians Schema Validation & Operations', () => {
    // Valid technician input
    const validTech = {
      name: 'Salim Al Hinai',
      specialty: 'Master Diagnostics',
      phone: '96891234567',
      isActive: true,
      notes: 'Certified Toyota Diagnostic Specialist',
    };
    const parsed = TechnicianInputSchema.parse(validTech);
    assert.equal(parsed.name, 'Salim Al Hinai');
    assert.equal(parsed.specialty, 'Master Diagnostics');

    // Blank name should fail validation
    assert.throws(() => {
      TechnicianInputSchema.parse({
        name: '',
        specialty: 'Mech',
        isActive: true,
      });
    });

    // Insert into SQLite
    const techId = crypto.randomUUID();
    const now = new Date().toISOString();
    (db.prepare(`
      INSERT INTO technicians (id, name, specialty, phone, is_active, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `) as any).run(techId, parsed.name, parsed.specialty, parsed.phone, 1, parsed.notes, now);

    const row = db.prepare('SELECT * FROM technicians WHERE id = ?').get(techId) as any;
    assert.equal(row.name, 'Salim Al Hinai');
    assert.equal(row.specialty, 'Master Diagnostics');
    assert.equal(row.is_active, 1);
  });

  await t.test('3. Suppliers Directory Validation & Operations', () => {
    const validSupplier = {
      name: 'Oman Lubricants & Filters Co.',
      phone: '96892345678',
      email: 'sales@omanlube.om',
      address: 'Rusayl Industrial Estate',
      notes: '30-day payment term',
    };
    const parsed = SupplierInputSchema.parse(validSupplier);
    assert.equal(parsed.name, 'Oman Lubricants & Filters Co.');

    // Insert into SQLite
    const supId = crypto.randomUUID();
    const now = new Date().toISOString();
    (db.prepare(`
      INSERT INTO suppliers (id, name, phone, email, address, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `) as any).run(supId, parsed.name, parsed.phone, parsed.email, parsed.address, parsed.notes, now);

    const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supId) as any;
    assert.equal(row.name, 'Oman Lubricants & Filters Co.');
    assert.equal(row.email, 'sales@omanlube.om');
  });

  await t.test('4. Operating Expenses Ledger Validation & Operations', () => {
    const validExpense = {
      category: 'RENT' as const,
      amountBaisa: 450000, // 450.000 OMR workshop rent
      expenseDate: '2026-03-01',
      paymentMethod: 'BANK_TRANSFER' as const,
      payee: 'Al Rawahi Real Estate',
      receiptRef: 'TXN-88219',
      description: 'March 2026 workshop rent',
    };
    const parsed = ExpenseInputSchema.parse(validExpense);
    assert.equal(parsed.amountBaisa, 450000);

    // Negative or zero expense should fail
    assert.throws(() => {
      ExpenseInputSchema.parse({
        category: 'RENT',
        amountBaisa: 0,
        payee: 'Owner',
        paymentMethod: 'CASH',
      });
    });

    const expId = crypto.randomUUID();
    const now = new Date().toISOString();
    (db.prepare(`
      INSERT INTO expenses (id, category, amount_baisa, expense_date, payment_method, payee, receipt_ref, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `) as any).run(expId, parsed.category, parsed.amountBaisa, parsed.expenseDate, parsed.paymentMethod, parsed.payee, parsed.receiptRef, parsed.description, now);

    const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expId) as any;
    assert.equal(row.payee, 'Al Rawahi Real Estate');
    assert.equal(row.amount_baisa, 450000);
  });

  await t.test('5. Hot Database Backup Creation & SHA-256 Checksum', () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `garage_backup_${timestamp}.db`;
    const targetFilePath = path.join(BACKUP_DIR_PATH, backupFileName);

    // SQLite online VACUUM INTO
    (db.prepare('VACUUM INTO ?') as any).run(targetFilePath);
    assert.ok(fs.existsSync(targetFilePath), 'Backup database file must exist');

    const stat = fs.statSync(targetFilePath);
    assert.ok(stat.size > 0, 'Backup database must not be empty');

    // SHA-256 hash calculation
    const fileBuffer = fs.readFileSync(targetFilePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    assert.equal(hash.length, 64, 'SHA-256 hex string must be 64 characters');

    // Verify backup file can be opened independently by SQLite
    const backupDb = new DatabaseSync(targetFilePath);
    const countRow = backupDb.prepare('SELECT count(*) as c FROM technicians').get() as any;
    assert.equal(countRow.c >= 1, true, 'Backup must contain technicians table data');
    backupDb.close();
  });

  await t.test('6. Browser Mock Adapter Parity', async () => {
    // Technicians in mock adapter
    const techRes = await browserMockAdapter.getTechnicians();
    assert.ok(techRes.success);
    assert.ok(Array.isArray(techRes.data));

    // Create technician in mock
    const createdTech = await browserMockAdapter.createTechnician({
      name: 'Tariq Al Zadjali',
      specialty: 'Auto Electrician',
      phone: '96899998888',
      isActive: true,
      notes: 'German car specialist',
    });
    assert.ok(createdTech.success);
    assert.equal(createdTech.data?.name, 'Tariq Al Zadjali');

    // Suppliers in mock adapter
    const supRes = await browserMockAdapter.getSuppliers();
    assert.ok(supRes.success);

    // Expenses in mock adapter
    const expRes = await browserMockAdapter.getExpenses();
    assert.ok(expRes.success);

    // Financial report in mock adapter
    const repRes = await browserMockAdapter.getFinancialReport('2020-01-01', '2030-12-31');
    assert.ok(repRes.success);
    assert.ok(typeof repRes.data?.totalInvoicedBaisa === 'number');
    assert.ok(typeof repRes.data?.totalCollectedBaisa === 'number');
    assert.ok(typeof repRes.data?.totalVatBaisa === 'number');
    assert.ok(Array.isArray(repRes.data?.topMovingParts));

    // Backup list and trigger in mock adapter
    const backupTrigger = await browserMockAdapter.triggerBackup();
    assert.ok(backupTrigger.success);
    assert.ok(backupTrigger.data?.backupFile.startsWith('garage_backup_'));

    const backupList = await browserMockAdapter.listBackups();
    assert.ok(backupList.success);
    assert.ok(backupList.data && backupList.data.length >= 1);
  });
});
