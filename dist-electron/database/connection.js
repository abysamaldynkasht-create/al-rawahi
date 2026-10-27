/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 *
 * SQLite Database Connection Manager
 *
 * Storage Location:
 * Windows: %APPDATA%\AlRawahiGarage\garage.db
 *
 * Features:
 * - WAL (Write-Ahead Logging) mode for high-concurrency desktop performance
 * - Foreign key constraint enforcement (PRAGMA foreign_keys = ON)
 * - Automatic migration application on startup
 */
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { runMigrations } from './migrator.ts';
let dbInstance = null;
export function getDatabasePath() {
    const userDataDir = app.getPath('userData');
    const appDataDir = path.join(userDataDir, 'AlRawahiGarage');
    if (!fs.existsSync(appDataDir)) {
        fs.mkdirSync(appDataDir, { recursive: true });
    }
    return path.join(appDataDir, 'garage.db');
}
export function initializeDatabase() {
    if (dbInstance) {
        return dbInstance;
    }
    const dbPath = getDatabasePath();
    console.log(`[Database Connection] Initializing SQLite database at: ${dbPath}`);
    try {
        // Dynamic import/require of better-sqlite3 for desktop runtime
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const BetterSqlite3 = require('better-sqlite3');
        const db = new BetterSqlite3(dbPath, {
            verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
        });
        // Enforce WAL mode and foreign key constraints
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        db.pragma('synchronous = NORMAL');
        // Run pending migrations
        const currentVersion = runMigrations(db);
        console.log(`[Database Connection] Database ready. Schema version: ${currentVersion}`);
        dbInstance = db;
        return db;
    }
    catch (error) {
        console.error('[Database Connection] Failed to initialize SQLite database:', error);
        throw error;
    }
}
export function getDatabase() {
    if (!dbInstance) {
        return initializeDatabase();
    }
    return dbInstance;
}
export function closeDatabase() {
    if (dbInstance) {
        try {
            dbInstance.close();
            console.log('[Database Connection] SQLite connection closed safely.');
        }
        catch (err) {
            console.error('[Database Connection] Error closing SQLite database:', err);
        }
        finally {
            dbInstance = null;
        }
    }
}
