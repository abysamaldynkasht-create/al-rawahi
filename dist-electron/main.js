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
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { initializeDatabase, closeDatabase } from './database/connection.ts';
import { registerIpcHandlers } from './ipc/handlers.ts';
let mainWindow = null;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'AL RAWAHI GARAGE MANAGEMENT SYSTEM',
        backgroundColor: '#0f172a', // Dark charcoal baseline
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
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
    // In development, load the Vite dev server URL. In production, load the built index.html
    const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
    if (isDev) {
        const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
        mainWindow.loadURL(devUrl);
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// Single Instance Lock: Prevent multiple garage instances accessing the same SQLite database
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.warn('[Process Warning] Another instance is already running. Quitting.');
    app.quit();
}
else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
    app.whenReady().then(() => {
        console.log('[Main Process] Starting AL RAWAHI GARAGE Desktop System...');
        try {
            // 1. Initialize SQLite Database & Migrations
            initializeDatabase();
            // 2. Register Secure IPC Handlers
            registerIpcHandlers();
            // 3. Create Main Window
            createWindow();
        }
        catch (err) {
            console.error('[Main Process Fatal] Failed during startup:', err);
        }
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            closeDatabase();
            app.quit();
        }
    });
    app.on('before-quit', () => {
        closeDatabase();
    });
}
