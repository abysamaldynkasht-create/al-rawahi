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
import { contextBridge, ipcRenderer } from 'electron';
const garageApi = {
    // System Diagnostics
    getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),
    // Settings
    getSetting: (key) => ipcRenderer.invoke('settings:get', key),
    setSetting: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
    getAllSettings: () => ipcRenderer.invoke('settings:getAll'),
    // Customers
    getCustomers: (searchQuery) => ipcRenderer.invoke('customers:get', searchQuery),
    getCustomerById: (id) => ipcRenderer.invoke('customers:getById', id),
    createCustomer: (input) => ipcRenderer.invoke('customers:create', input),
    updateCustomer: (id, input) => ipcRenderer.invoke('customers:update', { id, input }),
    // Vehicles
    getVehicles: (customerId) => ipcRenderer.invoke('vehicles:get', customerId),
    getVehicleById: (id) => ipcRenderer.invoke('vehicles:getById', id),
    searchVehiclesByPlate: (plateNumber) => ipcRenderer.invoke('vehicles:searchPlate', plateNumber),
    createVehicle: (input) => ipcRenderer.invoke('vehicles:create', input),
    // Repair Orders
    getRepairOrders: (statusFilter) => ipcRenderer.invoke('repairOrders:get', statusFilter),
    getRepairOrderById: (id) => ipcRenderer.invoke('repairOrders:getById', id),
    createRepairOrder: (input) => ipcRenderer.invoke('repairOrders:create', input),
    updateRepairOrderStatus: (input) => ipcRenderer.invoke('repairOrders:updateStatus', input),
    // Inventory
    getInventory: (searchQuery) => ipcRenderer.invoke('inventory:get', searchQuery),
    createInventoryItem: (input) => ipcRenderer.invoke('inventory:create', input),
    // Backup Management
    listBackups: () => ipcRenderer.invoke('backup:list'),
    triggerBackup: () => ipcRenderer.invoke('backup:trigger'),
    // Printing & PDF Generation
    printInvoice: (invoiceId, language) => ipcRenderer.invoke('print:invoice', invoiceId, language),
};
contextBridge.exposeInMainWorld('garageApi', garageApi);
