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
import type {
  GarageApi,
  IpcResult,
  SystemInfo,
  CustomerDTO,
  CustomerInput,
  VehicleDTO,
  VehicleInput,
  RepairOrderDTO,
  RepairOrderInput,
  RepairOrderStatus,
  StatusChangeInput,
  InventoryItemDTO,
  InventoryItemInput,
  BackupRecord,
  BackupResult,
} from '../src/types/ipc.ts';

const garageApi: GarageApi = {
  // Authentication & Security
  login: (input: any): Promise<IpcResult<any>> => ipcRenderer.invoke('auth:login', input),
  changeCredentials: (input: any): Promise<IpcResult<void>> => ipcRenderer.invoke('auth:changeCredentials', input),
  onSessionLocked: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('session:locked', handler);
    return () => {
      ipcRenderer.removeListener('session:locked', handler);
    };
  },

  // Printers & PDF Generation
  getPrinters: (): Promise<IpcResult<any[]>> => ipcRenderer.invoke('printers:get'),
  testPrint: (printerName?: string): Promise<IpcResult<void>> => ipcRenderer.invoke('printers:testPrint', printerName),
  exportInvoicePdf: (invoiceId: string, language: 'ar' | 'en'): Promise<IpcResult<{ filePath: string }>> =>
    ipcRenderer.invoke('print:exportPdf', invoiceId, language),

  // System Diagnostics
  getSystemInfo: (): Promise<IpcResult<SystemInfo>> => ipcRenderer.invoke('system:getInfo'),

  // Settings
  getSetting: (key: string): Promise<IpcResult<string | null>> => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string): Promise<IpcResult<void>> => ipcRenderer.invoke('settings:set', { key, value }),
  getAllSettings: (): Promise<IpcResult<Record<string, string>>> => ipcRenderer.invoke('settings:getAll'),

  // Customers
  getCustomers: (searchQuery?: string, includeArchived?: boolean, includeTemporary?: boolean): Promise<IpcResult<CustomerDTO[]>> =>
    ipcRenderer.invoke('customers:get', searchQuery, includeArchived, includeTemporary),
  getCustomerById: (id: string): Promise<IpcResult<CustomerDTO | null>> => ipcRenderer.invoke('customers:getById', id),
  createCustomer: (input: CustomerInput): Promise<IpcResult<CustomerDTO>> => ipcRenderer.invoke('customers:create', input),
  updateCustomer: (id: string, input: Partial<CustomerInput>): Promise<IpcResult<CustomerDTO>> =>
    ipcRenderer.invoke('customers:update', { id, input }),
  archiveCustomer: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke('customers:archive', id),
  restoreCustomer: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke('customers:restore', id),
  deleteCustomer: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke('customers:delete', id),
  promoteCustomer: (id: string): Promise<IpcResult<CustomerDTO>> => ipcRenderer.invoke('customers:promote', id),

  // Vehicles
  getVehicles: (filter?: unknown): Promise<IpcResult<VehicleDTO[]>> => ipcRenderer.invoke('vehicles:get', filter),
  getVehicleById: (id: string): Promise<IpcResult<VehicleDTO | null>> => ipcRenderer.invoke('vehicles:getById', id),
  searchVehiclesByPlate: (plateNumber: string): Promise<IpcResult<VehicleDTO[]>> =>
    ipcRenderer.invoke('vehicles:searchPlate', plateNumber),
  checkVehicleDuplicates: (plateNumber: string, vin?: string, excludeVehicleId?: string): Promise<IpcResult<{ plateExists: boolean; vinExists: boolean }>> =>
    ipcRenderer.invoke('vehicles:checkDuplicates', { plateNumber, vin, excludeVehicleId }),
  createVehicle: (input: VehicleInput): Promise<IpcResult<VehicleDTO>> => ipcRenderer.invoke('vehicles:create', input),
  updateVehicle: (id: string, input: Partial<VehicleInput>): Promise<IpcResult<VehicleDTO>> =>
    ipcRenderer.invoke('vehicles:update', { id, input }),
  archiveVehicle: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke('vehicles:archive', id),
  restoreVehicle: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke('vehicles:restore', id),
  deleteVehicle: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke('vehicles:delete', id),

  // Repair Orders
  getRepairOrders: (statusFilter?: RepairOrderStatus): Promise<IpcResult<RepairOrderDTO[]>> =>
    ipcRenderer.invoke('repairOrders:get', statusFilter),
  getRepairOrderById: (id: string): Promise<IpcResult<RepairOrderDTO | null>> =>
    ipcRenderer.invoke('repairOrders:getById', id),
  createRepairOrder: (input: RepairOrderInput): Promise<IpcResult<RepairOrderDTO>> =>
    ipcRenderer.invoke('repairOrders:create', input),
  updateRepairOrderStatus: (input: StatusChangeInput): Promise<IpcResult<void>> =>
    ipcRenderer.invoke('repairOrders:updateStatus', input),
  getLaborTasks: (repairOrderId: string): Promise<IpcResult<any[]>> =>
    ipcRenderer.invoke('repairOrders:getLaborTasks', repairOrderId),
  addLaborTask: (input: any): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('repairOrders:addLaborTask', input),
  updateLaborTask: (id: string, input: any): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('repairOrders:updateLaborTask', { id, input }),
  deleteLaborTask: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke('repairOrders:deleteLaborTask', id),
  getRepairOrderParts: (repairOrderId: string): Promise<IpcResult<any[]>> =>
    ipcRenderer.invoke('repairOrders:getParts', repairOrderId),
  issuePartToRO: (input: any): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('repairOrders:issuePart', input),
  returnPartFromRO: (input: any): Promise<IpcResult<void>> =>
    ipcRenderer.invoke('repairOrders:returnPart', input),
  recordCustomerApproval: (input: any): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('repairOrders:recordApproval', input),
  getStatusHistory: (repairOrderId: string): Promise<IpcResult<any[]>> =>
    ipcRenderer.invoke('repairOrders:getStatusHistory', repairOrderId),
  createInvoiceFromRepairOrder: (input: any): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('repairOrders:createInvoice', input),
  getTechnicians: (): Promise<IpcResult<any[]>> =>
    ipcRenderer.invoke('technicians:get'),
  createTechnician: (input: any): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('technicians:create', input),
  updateTechnician: (id: string, input: any): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('technicians:update', { id, input }),
  deleteTechnician: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke('technicians:delete', id),

  // Worker Overtime, Payroll & Labor Productivity
  getWorkerOvertime: (workerId?: string, month?: string): Promise<IpcResult<any[]>> =>
    ipcRenderer.invoke('workers:getOvertime', workerId, month),
  addWorkerOvertime: (input: any): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('workers:addOvertime', input),
  updateWorkerOvertime: (id: string, input: any): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('workers:updateOvertime', { id, input }),
  updateWorkerOvertimeStatus: (id: string, status: string, approvedBy?: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke('workers:updateOvertimeStatus', { id, status, approvedBy }),
  deleteWorkerOvertime: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke('workers:deleteOvertime', id),
  getWorkerPayrolls: (month?: string, workerId?: string): Promise<IpcResult<any[]>> =>
    ipcRenderer.invoke('workers:getPayrolls', month, workerId),
  generateWorkerPayroll: (input: any): Promise<IpcResult<any[]>> =>
    ipcRenderer.invoke('workers:generatePayroll', input),
  finalizeWorkerPayroll: (input: any): Promise<IpcResult<void>> =>
    ipcRenderer.invoke('workers:finalizePayroll', input),
  getWorkerProductivity: (workerId?: string, startDate?: string, endDate?: string, repairOrderId?: string): Promise<IpcResult<any[]>> =>
    ipcRenderer.invoke('workers:getProductivity', workerId, startDate, endDate, repairOrderId),
  allocateLaborProductivity: (input: any): Promise<IpcResult<any[]>> =>
    ipcRenderer.invoke('workers:allocateLabor', input),
  deleteWorkerProductivity: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke('workers:deleteProductivity', id),

  // Inventory & Serial Tracking
  getInventory: (searchQuery?: string): Promise<IpcResult<InventoryItemDTO[]>> => ipcRenderer.invoke('inventory:get', searchQuery),
  createInventoryItem: (input: InventoryItemInput): Promise<IpcResult<InventoryItemDTO>> =>
    ipcRenderer.invoke('inventory:create', input),
  receiveInventorySerial: (input: any): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('inventory:receiveSerial', input),
  issueInventorySerial: (serialNumber: string, repairOrderId?: string, invoiceId?: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke('inventory:issueSerial', serialNumber, repairOrderId, invoiceId),
  getInventorySerials: (itemId?: string, status?: string): Promise<IpcResult<any[]>> =>
    ipcRenderer.invoke('inventory:getSerials', itemId, status),
  getInventoryMovements: (itemId?: string, repairOrderId?: string): Promise<IpcResult<any[]>> =>
    ipcRenderer.invoke('inventory:getMovements', itemId, repairOrderId),
  adjustStock: (input: any): Promise<IpcResult<void>> =>
    ipcRenderer.invoke('inventory:adjustStock', input),

  // Invoices & Payments & Customer Retention
  getInvoices: (customerId?: string): Promise<IpcResult<any[]>> => ipcRenderer.invoke('invoices:get', customerId),
  getInvoiceById: (id: string): Promise<IpcResult<any>> => ipcRenderer.invoke('invoices:getById', id),
  createInvoice: (input: any): Promise<IpcResult<any>> => ipcRenderer.invoke('invoices:create', input),
  updateInvoice: (id: string, input: any): Promise<IpcResult<any>> => ipcRenderer.invoke('invoices:update', { id, ...input }),
  getPayments: (invoiceId?: string): Promise<IpcResult<any[]>> => ipcRenderer.invoke('payments:get', invoiceId),
  getPaymentById: (id: string): Promise<IpcResult<any>> => ipcRenderer.invoke('payments:getById', id),
  recordPayment: (input: any): Promise<IpcResult<any>> => ipcRenderer.invoke('payments:record', input),
  markInvoiceRetentionPrompted: (invoiceId: string): Promise<IpcResult<void>> => ipcRenderer.invoke('invoices:markPrompted', invoiceId),
  checkRetentionEligibility: (invoiceId: string): Promise<IpcResult<any>> => ipcRenderer.invoke('invoices:checkRetention', invoiceId),

  // Suppliers
  getSuppliers: (): Promise<IpcResult<any[]>> => ipcRenderer.invoke('suppliers:get'),
  createSupplier: (input: any): Promise<IpcResult<any>> => ipcRenderer.invoke('suppliers:create', input),
  updateSupplier: (id: string, input: any): Promise<IpcResult<any>> => ipcRenderer.invoke('suppliers:update', { id, input }),
  deleteSupplier: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke('suppliers:delete', id),

  // Expenses
  getExpenses: (startDate?: string, endDate?: string): Promise<IpcResult<any[]>> =>
    ipcRenderer.invoke('expenses:get', startDate, endDate),
  createExpense: (input: any): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('expenses:create', input),
  deleteExpense: (id: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke('expenses:delete', id),

  // Reports
  getFinancialReport: (startDate?: string, endDate?: string): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('reports:getFinancial', startDate, endDate),

  // Backup Management
  listBackups: (): Promise<IpcResult<BackupRecord[]>> => ipcRenderer.invoke('backup:list'),
  triggerBackup: (): Promise<IpcResult<BackupResult>> => ipcRenderer.invoke('backup:trigger'),
  restoreBackup: (fileName: string): Promise<IpcResult<void>> => ipcRenderer.invoke('backup:restore', fileName),

  // Printing & PDF Generation
  printInvoice: (invoiceId: string, language: 'ar' | 'en'): Promise<IpcResult<any>> =>
    ipcRenderer.invoke('print:invoice', invoiceId, language),
};

contextBridge.exposeInMainWorld('garageApi', garageApi);
