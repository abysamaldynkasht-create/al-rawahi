"use strict";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 *
 * Secure Preload Script
 *
 * Security Guardrails:
 * - contextIsolation: true (enforced in main.ts)
 * - nodeIntegration: false (enforced in main.ts)
 * - Exposes ONLY typed wrapper methods on window.garageApi
 * - Never exposes ipcRenderer directly
 * - Never exposes Node.js require or filesystem internals
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const garageApi = {
    // System Diagnostics
    getSystemInfo: () => electron_1.ipcRenderer.invoke('system:getInfo'),
    // Settings
    getSetting: (key) => electron_1.ipcRenderer.invoke('settings:get', key),
    setSetting: (key, value) => electron_1.ipcRenderer.invoke('settings:set', { key, value }),
    getAllSettings: () => electron_1.ipcRenderer.invoke('settings:getAll'),
    // Customers
    getCustomers: (searchQuery) => electron_1.ipcRenderer.invoke('customers:get', searchQuery),
    getCustomerById: (id) => electron_1.ipcRenderer.invoke('customers:getById', id),
    createCustomer: (input) => electron_1.ipcRenderer.invoke('customers:create', input),
    updateCustomer: (id, input) => electron_1.ipcRenderer.invoke('customers:update', { id, input }),
    // Vehicles
    getVehicles: (customerId) => electron_1.ipcRenderer.invoke('vehicles:get', customerId),
    getVehicleById: (id) => electron_1.ipcRenderer.invoke('vehicles:getById', id),
    searchVehiclesByPlate: (plateNumber) => electron_1.ipcRenderer.invoke('vehicles:searchPlate', plateNumber),
    createVehicle: (input) => electron_1.ipcRenderer.invoke('vehicles:create', input),
    // Repair Orders
    getRepairOrders: (statusFilter) => electron_1.ipcRenderer.invoke('repairOrders:get', statusFilter),
    getRepairOrderById: (id) => electron_1.ipcRenderer.invoke('repairOrders:getById', id),
    createRepairOrder: (input) => electron_1.ipcRenderer.invoke('repairOrders:create', input),
    updateRepairOrderStatus: (input) => electron_1.ipcRenderer.invoke('repairOrders:updateStatus', input),
    // Inventory
    getInventory: (searchQuery) => electron_1.ipcRenderer.invoke('inventory:get', searchQuery),
    createInventoryItem: (input) => electron_1.ipcRenderer.invoke('inventory:create', input),
    // Backup Management
    listBackups: () => electron_1.ipcRenderer.invoke('backup:list'),
    triggerBackup: () => electron_1.ipcRenderer.invoke('backup:trigger'),
    // Printing & PDF Generation
    printInvoice: (invoiceId, language) => electron_1.ipcRenderer.invoke('print:invoice', invoiceId, language),
};
electron_1.contextBridge.exposeInMainWorld('garageApi', garageApi);
