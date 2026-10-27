// electron/preload.ts
var import_electron = require("electron");
var garageApi = {
  // Authentication & Security
  login: (input) => import_electron.ipcRenderer.invoke("auth:login", input),
  changeCredentials: (input) => import_electron.ipcRenderer.invoke("auth:changeCredentials", input),
  onSessionLocked: (callback) => {
    const handler = () => callback();
    import_electron.ipcRenderer.on("session:locked", handler);
    return () => {
      import_electron.ipcRenderer.removeListener("session:locked", handler);
    };
  },
  // Printers & PDF Generation
  getPrinters: () => import_electron.ipcRenderer.invoke("printers:get"),
  testPrint: (printerName) => import_electron.ipcRenderer.invoke("printers:testPrint", printerName),
  exportInvoicePdf: (invoiceId, language) => import_electron.ipcRenderer.invoke("print:exportPdf", invoiceId, language),
  // System Diagnostics
  getSystemInfo: () => import_electron.ipcRenderer.invoke("system:getInfo"),
  // Settings
  getSetting: (key) => import_electron.ipcRenderer.invoke("settings:get", key),
  setSetting: (key, value) => import_electron.ipcRenderer.invoke("settings:set", { key, value }),
  getAllSettings: () => import_electron.ipcRenderer.invoke("settings:getAll"),
  // Customers
  getCustomers: (searchQuery, includeArchived) => import_electron.ipcRenderer.invoke("customers:get", searchQuery, includeArchived),
  getCustomerById: (id) => import_electron.ipcRenderer.invoke("customers:getById", id),
  createCustomer: (input) => import_electron.ipcRenderer.invoke("customers:create", input),
  updateCustomer: (id, input) => import_electron.ipcRenderer.invoke("customers:update", { id, input }),
  archiveCustomer: (id) => import_electron.ipcRenderer.invoke("customers:archive", id),
  restoreCustomer: (id) => import_electron.ipcRenderer.invoke("customers:restore", id),
  deleteCustomer: (id) => import_electron.ipcRenderer.invoke("customers:delete", id),
  promoteCustomer: (id) => import_electron.ipcRenderer.invoke("customers:promote", id),
  // Vehicles
  getVehicles: (filter) => import_electron.ipcRenderer.invoke("vehicles:get", filter),
  getVehicleById: (id) => import_electron.ipcRenderer.invoke("vehicles:getById", id),
  searchVehiclesByPlate: (plateNumber) => import_electron.ipcRenderer.invoke("vehicles:searchPlate", plateNumber),
  checkVehicleDuplicates: (plateNumber, vin, excludeVehicleId) => import_electron.ipcRenderer.invoke("vehicles:checkDuplicates", { plateNumber, vin, excludeVehicleId }),
  createVehicle: (input) => import_electron.ipcRenderer.invoke("vehicles:create", input),
  updateVehicle: (id, input) => import_electron.ipcRenderer.invoke("vehicles:update", { id, input }),
  archiveVehicle: (id) => import_electron.ipcRenderer.invoke("vehicles:archive", id),
  restoreVehicle: (id) => import_electron.ipcRenderer.invoke("vehicles:restore", id),
  deleteVehicle: (id) => import_electron.ipcRenderer.invoke("vehicles:delete", id),
  // Repair Orders
  getRepairOrders: (statusFilter) => import_electron.ipcRenderer.invoke("repairOrders:get", statusFilter),
  getRepairOrderById: (id) => import_electron.ipcRenderer.invoke("repairOrders:getById", id),
  createRepairOrder: (input) => import_electron.ipcRenderer.invoke("repairOrders:create", input),
  updateRepairOrderStatus: (input) => import_electron.ipcRenderer.invoke("repairOrders:updateStatus", input),
  getLaborTasks: (repairOrderId) => import_electron.ipcRenderer.invoke("repairOrders:getLaborTasks", repairOrderId),
  addLaborTask: (input) => import_electron.ipcRenderer.invoke("repairOrders:addLaborTask", input),
  updateLaborTask: (id, input) => import_electron.ipcRenderer.invoke("repairOrders:updateLaborTask", { id, input }),
  deleteLaborTask: (id) => import_electron.ipcRenderer.invoke("repairOrders:deleteLaborTask", id),
  getRepairOrderParts: (repairOrderId) => import_electron.ipcRenderer.invoke("repairOrders:getParts", repairOrderId),
  issuePartToRO: (input) => import_electron.ipcRenderer.invoke("repairOrders:issuePart", input),
  returnPartFromRO: (input) => import_electron.ipcRenderer.invoke("repairOrders:returnPart", input),
  recordCustomerApproval: (input) => import_electron.ipcRenderer.invoke("repairOrders:recordApproval", input),
  getStatusHistory: (repairOrderId) => import_electron.ipcRenderer.invoke("repairOrders:getStatusHistory", repairOrderId),
  createInvoiceFromRepairOrder: (input) => import_electron.ipcRenderer.invoke("repairOrders:createInvoice", input),
  getTechnicians: () => import_electron.ipcRenderer.invoke("technicians:get"),
  createTechnician: (input) => import_electron.ipcRenderer.invoke("technicians:create", input),
  updateTechnician: (id, input) => import_electron.ipcRenderer.invoke("technicians:update", { id, input }),
  deleteTechnician: (id) => import_electron.ipcRenderer.invoke("technicians:delete", id),
  // Inventory & Serial Tracking
  getInventory: (searchQuery) => import_electron.ipcRenderer.invoke("inventory:get", searchQuery),
  createInventoryItem: (input) => import_electron.ipcRenderer.invoke("inventory:create", input),
  receiveInventorySerial: (input) => import_electron.ipcRenderer.invoke("inventory:receiveSerial", input),
  issueInventorySerial: (serialNumber, repairOrderId, invoiceId) => import_electron.ipcRenderer.invoke("inventory:issueSerial", serialNumber, repairOrderId, invoiceId),
  getInventorySerials: (itemId, status) => import_electron.ipcRenderer.invoke("inventory:getSerials", itemId, status),
  getInventoryMovements: (itemId, repairOrderId) => import_electron.ipcRenderer.invoke("inventory:getMovements", itemId, repairOrderId),
  adjustStock: (input) => import_electron.ipcRenderer.invoke("inventory:adjustStock", input),
  // Invoices & Payments & Customer Retention
  getInvoices: (customerId) => import_electron.ipcRenderer.invoke("invoices:get", customerId),
  getInvoiceById: (id) => import_electron.ipcRenderer.invoke("invoices:getById", id),
  createInvoice: (input) => import_electron.ipcRenderer.invoke("invoices:create", input),
  getPayments: (invoiceId) => import_electron.ipcRenderer.invoke("payments:get", invoiceId),
  getPaymentById: (id) => import_electron.ipcRenderer.invoke("payments:getById", id),
  recordPayment: (input) => import_electron.ipcRenderer.invoke("payments:record", input),
  markInvoiceRetentionPrompted: (invoiceId) => import_electron.ipcRenderer.invoke("invoices:markPrompted", invoiceId),
  checkRetentionEligibility: (invoiceId) => import_electron.ipcRenderer.invoke("invoices:checkRetention", invoiceId),
  // Suppliers
  getSuppliers: () => import_electron.ipcRenderer.invoke("suppliers:get"),
  createSupplier: (input) => import_electron.ipcRenderer.invoke("suppliers:create", input),
  updateSupplier: (id, input) => import_electron.ipcRenderer.invoke("suppliers:update", { id, input }),
  deleteSupplier: (id) => import_electron.ipcRenderer.invoke("suppliers:delete", id),
  // Expenses
  getExpenses: (startDate, endDate) => import_electron.ipcRenderer.invoke("expenses:get", startDate, endDate),
  createExpense: (input) => import_electron.ipcRenderer.invoke("expenses:create", input),
  deleteExpense: (id) => import_electron.ipcRenderer.invoke("expenses:delete", id),
  // Reports
  getFinancialReport: (startDate, endDate) => import_electron.ipcRenderer.invoke("reports:getFinancial", startDate, endDate),
  // Backup Management
  listBackups: () => import_electron.ipcRenderer.invoke("backup:list"),
  triggerBackup: () => import_electron.ipcRenderer.invoke("backup:trigger"),
  restoreBackup: (fileName) => import_electron.ipcRenderer.invoke("backup:restore", fileName),
  // Printing & PDF Generation
  printInvoice: (invoiceId, language) => import_electron.ipcRenderer.invoke("print:invoice", invoiceId, language)
};
import_electron.contextBridge.exposeInMainWorld("garageApi", garageApi);
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
