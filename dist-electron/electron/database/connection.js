"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabasePath = getDatabasePath;
exports.initializeDatabase = initializeDatabase;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
const migrator_ts_1 = require("./migrator.js");
let dbInstance = null;
function getDatabasePath() {
    const userDataDir = electron_1.app.getPath('userData');
    const appDataDir = path_1.default.join(userDataDir, 'AlRawahiGarage');
    if (!fs_1.default.existsSync(appDataDir)) {
        fs_1.default.mkdirSync(appDataDir, { recursive: true });
    }
    return path_1.default.join(appDataDir, 'garage.db');
}
function initializeDatabase() {
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
        const journalMode = db.pragma('journal_mode = WAL', { simple: true });
        db.pragma('foreign_keys = ON');
        const fkActive = db.pragma('foreign_keys', { simple: true });
        db.pragma('synchronous = NORMAL');
        console.log(`[Database Connection] Pragmas verified: journal_mode=${journalMode}, foreign_keys=${fkActive}`);
        // Run pending migrations
        const currentVersion = (0, migrator_ts_1.runMigrations)(db);
        console.log(`[Database Connection] Database ready. Schema version: ${currentVersion}`);
        dbInstance = db;
        return db;
    }
    catch (error) {
        console.error('[Database Connection] Failed to initialize SQLite database:', error);
        throw error;
    }
}
function getDatabase() {
    if (!dbInstance) {
        return initializeDatabase();
    }
    return dbInstance;
}
function closeDatabase() {
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
