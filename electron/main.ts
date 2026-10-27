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

import { app, BrowserWindow, powerMonitor } from 'electron';
import path from 'path';
import fs from 'fs';
import { initializeDatabase, closeDatabase } from './database/connection.ts';
import { registerIpcHandlers } from './ipc/handlers.ts';

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow(): void {
  const preloadPath = fs.existsSync(path.join(__dirname, 'preload.cjs'))
    ? path.join(__dirname, 'preload.cjs')
    : path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'AL RAWAHI GARAGE MANAGEMENT SYSTEM',
    backgroundColor: '#0f172a', // Dark charcoal baseline
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
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
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
    mainWindow.loadURL(devUrl);
  } else {
    // Resolve index.html relative to app root directory
    const productionHtmlPath = path.join(app.getAppPath(), 'dist/index.html');
    mainWindow.loadFile(productionHtmlPath);
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
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
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

      // 4. PowerMonitor: Lock session when OS workstation locks
      try {
        powerMonitor.on('lock-screen', () => {
          console.log('[Security] Operating system workstation locked. Locking app session.');
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('session:locked');
          }
        });
      } catch (pmErr) {
        console.warn('[Security] powerMonitor lock listener skipped:', pmErr);
      }
    } catch (err) {
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
