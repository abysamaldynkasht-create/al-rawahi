/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 *
 * Database Migration Runner
 */
import { INITIAL_SCHEMA_SQL } from './schema.ts';
export const MIGRATIONS = [
    {
        version: 1,
        name: 'initial_schema',
        sql: INITIAL_SCHEMA_SQL,
    },
];
export function runMigrations(db) {
    // 1. Ensure migrations table exists
    db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
    // 2. Query applied migrations
    const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all();
    const appliedSet = new Set(appliedRows.map((r) => r.version));
    let currentVersion = appliedRows.length > 0 ? appliedRows[appliedRows.length - 1].version : 0;
    // 3. Apply pending migrations inside a transaction
    for (const migration of MIGRATIONS) {
        if (!appliedSet.has(migration.version)) {
            console.log(`[Database Migrator] Applying migration ${migration.version}: ${migration.name}`);
            const applyTx = db.transaction(() => {
                db.exec(migration.sql);
                db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(migration.version, migration.name);
            });
            applyTx();
            currentVersion = migration.version;
        }
    }
    // 4. Seed default settings if empty
    const countRow = db.prepare('SELECT count(*) as count FROM settings').get();
    if (countRow.count === 0) {
        console.log('[Database Migrator] Seeding initial garage settings...');
        const seedTx = db.transaction(() => {
            const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
            stmt.run('garage_name', 'AL RAWAHI GARAGE');
            stmt.run('developer', 'AKASHA AI');
            stmt.run('currency_code', 'OMR');
            stmt.run('currency_symbol_ar', 'ر.ع.');
            stmt.run('default_tax_rate_percent', '5.0');
            stmt.run('default_language', 'ar');
            stmt.run('invoice_language_default', 'ar');
            stmt.run('phone_number', '+968 00000000');
            stmt.run('address', 'Sultanate of Oman');
        });
        seedTx();
    }
    return currentVersion;
}
