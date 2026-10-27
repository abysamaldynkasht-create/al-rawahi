/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Unified Garage API Client Dispatcher
 * 
 * Behavior:
 * - If running inside Electron desktop runtime (window.garageApi exists):
 *   Dispatches calls to the secure IPC preload bridge backed by SQLite.
 * - If running in Google AI Studio / Browser Preview (window.garageApi is undefined):
 *   Transparently falls back to browserMockAdapter (in-memory / WebStorage).
 * - Never claims browser preview is running the native SQLite database.
 */

import type { GarageApi } from '../types/ipc.ts';
import { browserMockAdapter } from './browserMockAdapter.ts';

export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.garageApi);
}

export function getGarageApi(): GarageApi {
  if (isDesktopRuntime()) {
    return window.garageApi!;
  }
  return browserMockAdapter;
}

export const garageApi: GarageApi = new Proxy({} as GarageApi, {
  get(_target, prop: string) {
    const api = getGarageApi();
    const value = api[prop as keyof GarageApi];
    if (typeof value === 'function') {
      return value.bind(api);
    }
    return value;
  },
});
