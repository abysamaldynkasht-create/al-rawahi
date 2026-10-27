/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Customer Retention Workflow Test Suite
 * 
 * Verifies:
 * 1. A new visit can be recorded without immediately adding the customer to the permanent directory.
 * 2. The retention prompt is eligible ONLY after the required completion conditions are satisfied.
 * 3. Selecting "Yes, save customer" retains customer atomically (is_permanent = 1) and preserves all relationships.
 * 4. Selecting "Not now" preserves transaction, invoice, payment, and required visit history without breaking foreign keys.
 * 5. Reopening or reprinting an invoice does not repeatedly trigger the prompt.
 * 6. Temporary visit customer is excluded from the permanent customer directory query.
 * 7. Existing permanent customer is reused and never prompts for retention.
 * 8. Financial integrity: payments and invoices remain accurate whether customer is retained or not.
 * 9. Atomic promotion to permanent status.
 * 10. Database foreign-key constraints remain intact under both outcomes.
 * 11. Arabic and English text rendering for the retention dialog.
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
  InvoiceInputSchema,
  PaymentInputSchema,
} from '../electron/ipc/validation.ts';
import { browserMockAdapter } from '../src/services/browserMockAdapter.ts';
import { TRANSLATIONS } from '../src/i18n/translations.ts';

const TEST_DB_PATH = path.join(os.tmpdir(), `test_retention_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);

function cleanupDb() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  } catch {
    // ignore
  }
}

// Helper checking retention eligibility matching electron/ipc/handlers.ts logic
function checkEligibility(db: any, invoiceId: string): boolean {
  const inv = db.prepare(`
    SELECT 
      i.*,
      COALESCE(c.is_permanent, 1) as customer_is_permanent
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    WHERE i.id = ?
  `).get(invoiceId) as any;

  if (!inv) return false;

  const isPaid = inv.status === 'PAID' || (inv.paid_amount_baisa >= inv.grand_total_baisa && inv.balance_due_baisa <= 0);
  const isPrinted = Boolean(inv.printed_at);
  const isTemporary = Number(inv.customer_is_permanent) === 0;
  const notPrompted = Number(inv.retention_prompted) === 0;

  return Boolean(isPaid && isPrinted && isTemporary && notPrompted);
}

test('Customer Retention Workflow Suite', async (suite) => {
  cleanupDb();
  const db = new DatabaseSync(TEST_DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');

  suite.before(() => {
    runMigrations(db as any);
  });

  suite.after(() => {
    cleanupDb();
  });

  await suite.test('1. Migration 004 successfully adds is_permanent to customers and retention columns to invoices', () => {
    const custCols = db.prepare("PRAGMA table_info('customers')").all() as any[];
    const hasIsPermanent = custCols.some((c) => c.name === 'is_permanent');
    assert.strictEqual(hasIsPermanent, true, 'customers table must have is_permanent column');

    const invCols = db.prepare("PRAGMA table_info('invoices')").all() as any[];
    const hasPrompted = invCols.some((c) => c.name === 'retention_prompted');
    const hasPrinted = invCols.some((c) => c.name === 'printed_at');
    assert.strictEqual(hasPrompted, true, 'invoices table must have retention_prompted column');
    assert.strictEqual(hasPrinted, true, 'invoices table must have printed_at column');
  });

  await suite.test('2. Single repair visit can be recorded without immediately adding customer to permanent directory', () => {
    const customerId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();
    const customerName = 'سيف بن حمد الشبيبي';
    const customerPhone = '+968 91112233';

    // Operator registers as a single visit (temporary customer: is_permanent = 0)
    db.prepare(`
      INSERT INTO customers (id, full_name, phone, is_active, is_permanent, created_at, updated_at)
      VALUES (?, ?, ?, 1, 0, datetime('now'), datetime('now'))
    `).run(customerId, customerName, customerPhone);

    db.prepare(`
      INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer, is_active, created_at, updated_at)
      VALUES (?, ?, '77661 A', 'Toyota', 'Camry', 2020, 55000, 1, datetime('now'), datetime('now'))
    `).run(vehicleId, customerId);

    // Verify customer exists in customers table
    const custRow = db.prepare('SELECT id, full_name, is_permanent FROM customers WHERE id = ?').get(customerId) as any;
    assert.ok(custRow, 'Customer record must exist');
    assert.strictEqual(custRow.is_permanent, 0, 'Customer must have is_permanent = 0');

    // Verify that the permanent directory query EXCLUDES this temporary customer
    const permanentCustomers = db.prepare(`
      SELECT id FROM customers WHERE COALESCE(is_active, 1) = 1 AND COALESCE(is_permanent, 1) = 1
    `).all() as any[];
    const foundInPermanent = permanentCustomers.some((c) => c.id === customerId);
    assert.strictEqual(foundInPermanent, false, 'Temporary visit customer must NOT appear in permanent directory query');
  });

  await suite.test('3. Retention prompt is NOT eligible before invoice exists or before payment is recorded', () => {
    const customerId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO customers (id, full_name, phone, is_active, is_permanent)
      VALUES (?, 'هلال بن سعيد المعمري', '+968 92223344', 1, 0)
    `).run(customerId);

    const invoiceId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, customer_id, invoice_date, status,
        subtotal_parts_baisa, subtotal_labor_baisa, grand_total_baisa,
        paid_amount_baisa, balance_due_baisa, retention_prompted
      ) VALUES (
        ?, 'INV-20261024-001', ?, date('now'), 'ISSUED',
        10000, 15000, 26250,
        0, 26250, 0
      )
    `).run(invoiceId, customerId);

    // Invoice is unpaid and unprinted
    assert.strictEqual(checkEligibility(db, invoiceId), false, 'Prompt must not be eligible when invoice is unpaid');

    // Even if printed, still unpaid -> not eligible
    db.prepare("UPDATE invoices SET printed_at = datetime('now') WHERE id = ?").run(invoiceId);
    assert.strictEqual(checkEligibility(db, invoiceId), false, 'Prompt must not be eligible when printed but balance is unpaid');
  });

  await suite.test('4. Retention prompt is NOT eligible if payment is recorded but invoice has NOT been printed', () => {
    const customerId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO customers (id, full_name, phone, is_active, is_permanent)
      VALUES (?, 'ناصر بن راشد البلوشي', '+968 93334455', 1, 0)
    `).run(customerId);

    const invoiceId = crypto.randomUUID();
    // Paid in full, but printed_at is NULL
    db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, customer_id, invoice_date, status,
        subtotal_parts_baisa, subtotal_labor_baisa, grand_total_baisa,
        paid_amount_baisa, balance_due_baisa, printed_at, retention_prompted
      ) VALUES (
        ?, 'INV-20261024-002', ?, date('now'), 'PAID',
        20000, 10000, 31500,
        31500, 0, NULL, 0
      )
    `).run(invoiceId, customerId);

    assert.strictEqual(checkEligibility(db, invoiceId), false, 'Prompt must not appear before invoice printing workflow completes');
  });

  await suite.test('5. Retention prompt IS eligible when payment is complete, invoice is printed, customer is temporary, and not prompted yet', () => {
    const customerId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO customers (id, full_name, phone, is_active, is_permanent)
      VALUES (?, 'ماجد بن خلفان الحوسني', '+968 94445566', 1, 0)
    `).run(customerId);

    const invoiceId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, customer_id, invoice_date, status,
        subtotal_parts_baisa, subtotal_labor_baisa, grand_total_baisa,
        paid_amount_baisa, balance_due_baisa, printed_at, retention_prompted
      ) VALUES (
        ?, 'INV-20261024-003', ?, date('now'), 'PAID',
        15000, 10000, 26250,
        26250, 0, datetime('now'), 0
      )
    `).run(invoiceId, customerId);

    assert.strictEqual(checkEligibility(db, invoiceId), true, 'Prompt must be eligible when paid, printed, temporary, and unprompted');
  });

  await suite.test('6. Selecting "Yes, save customer" retains customer atomically (is_permanent = 1) and preserves all relationships', () => {
    const customerId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();
    const invoiceId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();

    // 1. Create temporary customer and linked entities
    db.prepare(`
      INSERT INTO customers (id, full_name, phone, is_active, is_permanent)
      VALUES (?, 'علي بن منصور العامري', '+968 95556677', 1, 0)
    `).run(customerId);

    db.prepare(`
      INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer, is_active)
      VALUES (?, ?, '43219 B', 'Nissan', 'Patrol', 2021, 45000, 1)
    `).run(vehicleId, customerId);

    db.prepare(`
      INSERT INTO invoices (id, invoice_number, customer_id, vehicle_id, status, grand_total_baisa, paid_amount_baisa, balance_due_baisa, printed_at, retention_prompted)
      VALUES (?, 'INV-20261024-004', ?, ?, 'PAID', 50000, 50000, 0, datetime('now'), 0)
    `).run(invoiceId, customerId, vehicleId);

    db.prepare(`
      INSERT INTO payments (id, payment_number, invoice_id, amount_baisa, payment_method, created_by)
      VALUES (?, 'PAY-20261024-004', ?, 50000, 'CASH', 'Operator')
    `).run(paymentId, invoiceId);

    // Operator clicks "نعم، حفظ العميل"
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare("UPDATE customers SET is_permanent = 1, updated_at = datetime('now') WHERE id = ?").run(customerId);
      db.prepare('UPDATE invoices SET retention_prompted = 1 WHERE id = ?').run(invoiceId);
      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }

    // Check customer is now permanent
    const updatedCustomer = db.prepare('SELECT is_permanent FROM customers WHERE id = ?').get(customerId) as any;
    assert.strictEqual(updatedCustomer.is_permanent, 1, 'Customer must be promoted to is_permanent = 1');

    // Check customer appears in permanent directory
    const permDir = db.prepare('SELECT id FROM customers WHERE COALESCE(is_permanent, 1) = 1 AND id = ?').get(customerId) as any;
    assert.ok(permDir, 'Customer must now appear in permanent directory query');

    // Check all relationships are fully intact
    const linkedVehicle = db.prepare('SELECT customer_id FROM vehicles WHERE id = ?').get(vehicleId) as any;
    assert.strictEqual(linkedVehicle.customer_id, customerId, 'Vehicle link must be preserved');

    const linkedInvoice = db.prepare('SELECT customer_id, vehicle_id, status, paid_amount_baisa FROM invoices WHERE id = ?').get(invoiceId) as any;
    assert.strictEqual(linkedInvoice.customer_id, customerId, 'Invoice customer link must be preserved');
    assert.strictEqual(linkedInvoice.vehicle_id, vehicleId, 'Invoice vehicle link must be preserved');
    assert.strictEqual(linkedInvoice.paid_amount_baisa, 50000, 'Financial paid amount must be preserved');

    const linkedPayment = db.prepare('SELECT invoice_id, amount_baisa FROM payments WHERE id = ?').get(paymentId) as any;
    assert.strictEqual(linkedPayment.invoice_id, invoiceId, 'Payment link must be preserved');

    // Re-check eligibility: must NOT be prompted again
    assert.strictEqual(checkEligibility(db, invoiceId), false, 'Already prompted invoice must not prompt again');
  });

  await suite.test('7. Selecting "Not now" preserves visit, invoice, payment, vehicle history without breaking foreign keys', () => {
    const customerId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();
    const invoiceId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();

    // 1. Create temporary customer and visit
    db.prepare(`
      INSERT INTO customers (id, full_name, phone, is_active, is_permanent)
      VALUES (?, 'أحمد بن زاهر الكندي', '+968 96667788', 1, 0)
    `).run(customerId);

    db.prepare(`
      INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, odometer, is_active)
      VALUES (?, ?, '88123 D', 'Mitsubishi', 'Pajero', 2019, 90000, 1)
    `).run(vehicleId, customerId);

    db.prepare(`
      INSERT INTO invoices (id, invoice_number, customer_id, vehicle_id, status, grand_total_baisa, paid_amount_baisa, balance_due_baisa, printed_at, retention_prompted)
      VALUES (?, 'INV-20261024-005', ?, ?, 'PAID', 30000, 30000, 0, datetime('now'), 0)
    `).run(invoiceId, customerId, vehicleId);

    db.prepare(`
      INSERT INTO payments (id, payment_number, invoice_id, amount_baisa, payment_method, created_by)
      VALUES (?, 'PAY-20261024-005', ?, 30000, 'CARD_RECORDED', 'Operator')
    `).run(paymentId, invoiceId);

    // Operator clicks "ليس الآن"
    db.prepare('UPDATE invoices SET retention_prompted = 1 WHERE id = ?').run(invoiceId);

    // Check customer remains temporary (is_permanent = 0)
    const custRow = db.prepare('SELECT is_permanent FROM customers WHERE id = ?').get(customerId) as any;
    assert.strictEqual(custRow.is_permanent, 0, 'Customer must remain is_permanent = 0');

    // Check customer is NOT in permanent directory
    const permDir = db.prepare('SELECT id FROM customers WHERE COALESCE(is_permanent, 1) = 1 AND id = ?').get(customerId);
    assert.strictEqual(permDir, undefined, 'Temporary customer must NOT appear in permanent directory query');

    // CRITICAL REQUIREMENT: Transaction, invoice, payment, and vehicle records MUST be preserved
    const invCheck = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
    assert.ok(invCheck, 'Invoice record must NOT be deleted');
    assert.strictEqual(invCheck.grand_total_baisa, 30000);
    assert.strictEqual(invCheck.paid_amount_baisa, 30000);
    assert.strictEqual(invCheck.retention_prompted, 1);

    const payCheck = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as any;
    assert.ok(payCheck, 'Payment record must NOT be deleted');
    assert.strictEqual(payCheck.amount_baisa, 30000);

    const vehCheck = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId) as any;
    assert.ok(vehCheck, 'Vehicle record must NOT be deleted');

    // Verify foreign key integrity
    const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(fkCheck.length, 0, 'Foreign key constraints must have zero violations');
  });

  await suite.test('8. Reopening or reprinting an invoice does NOT repeatedly trigger prompt', () => {
    const customerId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO customers (id, full_name, is_permanent)
      VALUES (?, 'سلطان بن سعيد الوهيبي', 0)
    `).run(customerId);

    const invoiceId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO invoices (id, invoice_number, customer_id, status, grand_total_baisa, paid_amount_baisa, balance_due_baisa, printed_at, retention_prompted)
      VALUES (?, 'INV-20261024-006', ?, 'PAID', 40000, 40000, 0, datetime('now'), 1)
    `).run(invoiceId, customerId);

    // Operator reprints invoice
    db.prepare("UPDATE invoices SET printed_at = datetime('now') WHERE id = ?").run(invoiceId);

    // Check eligibility: retention_prompted is 1, so eligibility MUST be false
    assert.strictEqual(checkEligibility(db, invoiceId), false, 'Reprinting must NOT re-trigger prompt when retention_prompted is 1');
  });

  await suite.test('9. Existing permanent customer is reused and NEVER prompts for retention', () => {
    const customerId = crypto.randomUUID();
    // Customer is already permanent
    db.prepare(`
      INSERT INTO customers (id, full_name, phone, is_permanent)
      VALUES (?, 'سالم بن حمد الرواحي (عميل دائم)', '+968 91234567', 1)
    `).run(customerId);

    const invoiceId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO invoices (id, invoice_number, customer_id, status, grand_total_baisa, paid_amount_baisa, balance_due_baisa, printed_at, retention_prompted)
      VALUES (?, 'INV-20261024-007', ?, 'PAID', 60000, 60000, 0, datetime('now'), 0)
    `).run(invoiceId, customerId);

    // Customer is permanent (is_permanent = 1) -> prompt MUST be false
    assert.strictEqual(checkEligibility(db, invoiceId), false, 'Permanent customer must never be prompted for retention');
  });

  await suite.test('10. Browser Mock Adapter implements exact customer retention and visit workflow', async () => {
    // 1. Create a temporary customer in mock
    const custRes = await browserMockAdapter.createCustomer({
      fullName: 'قاسم بن خلفان الهنائي',
      phone: '+968 97778899',
      isPermanent: false,
    });
    assert.strictEqual(custRes.success, true);
    assert.strictEqual(custRes.data?.isPermanent, false);

    // 2. Query default permanent directory: temporary customer must NOT appear
    const permList = await browserMockAdapter.getCustomers(undefined, false, false);
    assert.strictEqual(permList.success, true);
    assert.strictEqual(permList.data?.some((c) => c.id === custRes.data?.id), false);

    // 3. Query with includeTemporary: true: customer DOES appear
    const allList = await browserMockAdapter.getCustomers(undefined, false, true);
    assert.strictEqual(allList.success, true);
    assert.strictEqual(allList.data?.some((c) => c.id === custRes.data?.id), true);

    // 4. Create an invoice for this customer
    const invRes = await browserMockAdapter.createInvoice({
      customerId: custRes.data!.id,
      subtotalPartsBaisa: 10000,
      subtotalLaborBaisa: 10000,
    });
    assert.strictEqual(invRes.success, true);
    const invoiceId = invRes.data!.id;

    // 5. Check eligibility before payment: false
    let elig = await browserMockAdapter.checkRetentionEligibility(invoiceId);
    assert.strictEqual(elig.data?.eligible, false);

    // 6. Record payment in full
    const payRes = await browserMockAdapter.recordPayment({
      invoiceId,
      amountBaisa: invRes.data!.grandTotalBaisa,
      paymentMethod: 'CASH',
    });
    assert.strictEqual(payRes.success, true);

    // 7. Print invoice
    const printRes = await browserMockAdapter.printInvoice(invoiceId, 'ar');
    assert.strictEqual(printRes.success, true);
    assert.strictEqual(printRes.data?.promptEligible, true);

    // 8. Promote customer to permanent
    const promoRes = await browserMockAdapter.promoteCustomer(custRes.data!.id);
    assert.strictEqual(promoRes.success, true);
    assert.strictEqual(promoRes.data?.isPermanent, true);

    // 9. Mark invoice prompted
    await browserMockAdapter.markInvoiceRetentionPrompted(invoiceId);

    // 10. Re-check eligibility: false
    elig = await browserMockAdapter.checkRetentionEligibility(invoiceId);
    assert.strictEqual(elig.data?.eligible, false);
  });

  await suite.test('11. Exact bilingual dialog text rendering matches specifications', () => {
    // Exact requested Arabic dialog strings
    assert.strictEqual(
      TRANSLATIONS.ar.retentionDialogTitle,
      'هل ترغب في حفظ بيانات العميل؟',
      'Arabic dialog title must match specification'
    );
    assert.strictEqual(
      TRANSLATIONS.ar.retentionDialogMessage,
      'يمكنك حفظ بيانات العميل للزيارات القادمة والوصول بسهولة إلى بياناته ومركباته وسجل الصيانة والفواتير السابقة.',
      'Arabic dialog message must match specification'
    );
    assert.strictEqual(
      TRANSLATIONS.ar.retentionActionYes,
      'نعم، حفظ العميل',
      'Action 1 must be "نعم، حفظ العميل"'
    );
    assert.strictEqual(
      TRANSLATIONS.ar.retentionActionNotNow,
      'ليس الآن',
      'Action 2 must be "ليس الآن"'
    );

    // English equivalents
    assert.ok(TRANSLATIONS.en.retentionDialogTitle.includes("customer's details"));
    assert.ok(TRANSLATIONS.en.retentionDialogMessage.includes('future visits'));
    assert.strictEqual(TRANSLATIONS.en.retentionActionYes, 'Yes, save customer');
    assert.strictEqual(TRANSLATIONS.en.retentionActionNotNow, 'Not now');
  });
});
