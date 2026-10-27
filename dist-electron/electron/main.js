"use strict";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 *
 * Electron Main Process Entry Point
 *
 * Security Guardrails:
 * - contextIsolation: true
 * - nodeIntegration: false
 * - sandbox: true
 * - Navigation restricted to local app origin
 * - Safe SQLite lifecycle shutdown
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const connection_ts_1 = require("./database/connection.js");
const handlers_ts_1 = require("./ipc/handlers.js");
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'AL RAWAHI GARAGE MANAGEMENT SYSTEM',
        backgroundColor: '#0f172a', // Dark charcoal baseline
        autoHideMenuBar: true,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    // Security: Prevent navigation outside of the application origin
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.origin !== 'http://localhost:3000' && !navigationUrl.startsWith('file://')) {
            console.warn(`[Security Alert] Blocked navigation attempt to: ${navigationUrl}`);
            event.preventDefault();
        }
    });
    // Security: Block all unapproved new window creation (window.open, target="_blank")
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        console.warn(`[Security Alert] Blocked attempt to open new window for: ${url}`);
        return { action: 'deny' };
    });
    // In development, load the Vite dev server URL. In production, load the built index.html
    const isDev = !electron_1.app.isPackaged && process.env.NODE_ENV !== 'production';
    if (isDev) {
        const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
        mainWindow.loadURL(devUrl);
    }
    else {
        // Resolve index.html relative to app root directory
        const productionHtmlPath = path_1.default.join(electron_1.app.getAppPath(), 'dist/index.html');
        mainWindow.loadFile(productionHtmlPath);
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// Single Instance Lock: Prevent multiple garage instances accessing the same SQLite database
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.warn('[Process Warning] Another instance is already running. Quitting.');
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
    electron_1.app.whenReady().then(() => {
        console.log('[Main Process] Starting AL RAWAHI GARAGE Desktop System...');
        try {
            // 1. Initialize SQLite Database & Migrations
            (0, connection_ts_1.initializeDatabase)();
            // 2. Register Secure IPC Handlers
            (0, handlers_ts_1.registerIpcHandlers)();
            // 3. Create Main Window
            createWindow();
        }
        catch (err) {
            console.error('[Main Process Fatal] Failed during startup:', err);
        }
        electron_1.app.on('activate', () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });
    electron_1.app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            (0, connection_ts_1.closeDatabase)();
            electron_1.app.quit();
        }
    });
    electron_1.app.on('before-quit', () => {
        (0, connection_ts_1.closeDatabase)();
    });
}
