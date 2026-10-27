/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Typed IPC Contracts & Data Transfer Objects (DTOs)
 * 
 * Security Guardrails:
 * - No raw SQL execution strings are permitted in this contract.
 * - No arbitrary filesystem path parameters are exposed.
 * - All monetary values are transferred with integer Baisa amounts for precision.
 */

// ============================================================================
// SYSTEM & HEALTH TYPES
// ============================================================================

export interface SystemInfo {
  platform: 'electron' | 'browser-mock';
  appName: string;
  version: string;
  databasePath?: string;
  databaseStatus: 'connected' | 'uninitialized' | 'error' | 'mock-active';
  activeSchemaVersion: number;
  lastBackupAt?: string;
  totalCustomers: number;
  totalVehicles: number;
  openRepairOrders: number;
}

export interface IpcResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

// ============================================================================
// CUSTOMERS & VEHICLES DTOs
// ============================================================================

export interface CustomerDTO {
  id: string;
  fullName: string;
  phone?: string;
  altPhone?: string;
  email?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  isPermanent: boolean;
  createdAt: string;
  updatedAt: string;
  vehicleCount?: number;
}

export interface CustomerInput {
  fullName: string;
  phone?: string;
  altPhone?: string;
  email?: string;
  address?: string;
  notes?: string;
  isActive?: boolean;
  isPermanent?: boolean;
}

export interface VehicleDTO {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
  odometer: number;
  color?: string;
  notes?: string;
  isActive: boolean;
  isPermanent?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface VehicleInput {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  isPermanentCustomer?: boolean;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
  odometer: number;
  color?: string;
  notes?: string;
  isActive?: boolean;
  isPermanent?: boolean;
}

export interface VehicleFilter {
  customerId?: string;
  searchQuery?: string;
  includeArchived?: boolean;
}

// ============================================================================
// REPAIR ORDERS & WORKFLOW DTOs
// ============================================================================
// REPAIR ORDERS & WORKFLOW DTOs
// ============================================================================

export type RepairOrderStatus =
  | 'RECEIVED'
  | 'UNDER_INSPECTION'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_PARTS'
  | 'QUALITY_CHECK'
  | 'READY_FOR_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED'
  // Database / Legacy aliases
  | 'UNDER_REPAIR'
  | 'AWAITING_PARTS'
  | 'READY_FOR_COLLECTION'
  | 'DELIVERED';

export interface RepairOrderDTO {
  id: string;
  roNumber: string; // RO-YYYYMM-XXXX
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  vehicleId: string;
  vehiclePlate?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  status: RepairOrderStatus;
  odometerIn: number;
  reportedProblem: string;
  inspectionNotes?: string;
  requestedWork?: string;
  estimatedCostBaisa: number;
  partsTotalBaisa: number;
  laborTotalBaisa: number;
  taxAmountBaisa: number;
  grandTotalBaisa: number;
  customerApproved: boolean;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedAt?: string;
  approvalNotes?: string;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  warrantyPeriodMonths?: number;
  warrantyTerms?: string;
  receivedAt: string;
  expectedAt?: string;
  completedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface RepairOrderInput {
  customerId: string;
  vehicleId: string;
  odometerIn: number;
  reportedProblem: string;
  inspectionNotes?: string;
  requestedWork?: string;
  estimatedCostBaisa?: number;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  expectedAt?: string;
}

export interface StatusChangeInput {
  repairOrderId: string;
  newStatus: RepairOrderStatus;
  remarks?: string;
  changedBy: string;
}

export interface RepairOrderStatusHistoryDTO {
  id: string;
  repairOrderId: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  remarks?: string;
  changedAt: string;
}

export interface RepairOrderCustomerApprovalInput {
  repairOrderId: string;
  approved: boolean;
  notes?: string;
  approvedBy?: string;
}

// ----------------------------------------------------------------------------
// LABOR TASKS
// ----------------------------------------------------------------------------

export interface LaborTaskDTO {
  id: string;
  repairOrderId: string;
  technicianId?: string;
  technicianName?: string;
  description: string;
  laborChargeBaisa: number;
  internalCostBaisa: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  isApproved: boolean;
  hours: number;
  hourlyRateBaisa: number;
  workDate: string;
  notes?: string;
}

export interface LaborTaskInput {
  repairOrderId: string;
  technicianId?: string;
  technicianName?: string;
  description: string;
  hours?: number;
  hourlyRateBaisa?: number;
  laborChargeBaisa: number;
  internalCostBaisa?: number;
  isApproved?: boolean;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  notes?: string;
}

// ----------------------------------------------------------------------------
// REPAIR ORDER PARTS (INVENTORY CONSUMPTION)
// ----------------------------------------------------------------------------

export interface RepairOrderPartDTO {
  id: string;
  repairOrderId: string;
  itemId: string;
  partCode: string;
  partName: string;
  serialNumber?: string;
  quantity: number;
  unit?: string;
  unitPriceBaisa: number;
  unitCostBaisa: number;
  totalPriceBaisa: number;
  isApproved: boolean;
  status: 'ISSUED' | 'RETURNED';
  issuedAt: string;
  returnedAt?: string;
  returnReason?: string;
  idempotencyKey?: string;
}

export interface IssuePartInput {
  repairOrderId: string;
  itemId: string;
  quantity: number;
  unit?: string;
  serialNumber?: string;
  unitPriceBaisa?: number;
  isApproved?: boolean;
  notes?: string;
  idempotencyKey?: string;
}

export interface ReturnPartInput {
  repairOrderId: string;
  roPartId: string;
  reason?: string;
  isDefective?: boolean;
}

// ----------------------------------------------------------------------------
// TECHNICIANS
// ----------------------------------------------------------------------------

export interface TechnicianDTO {
  id: string;
  name: string;
  phone?: string;
  specialty?: string;
  isActive: boolean;
  notes?: string;
  hourlyRateBaisa?: number;
  monthlyBaseSalaryBaisa?: number;
  overtimeRateBaisa?: number;
  nationalId?: string;
  hireDate?: string;
  employmentStatus?: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  createdAt: string;
}

export type WorkerDTO = TechnicianDTO;

export interface WorkerOvertimeEntryDTO {
  id: string;
  workerId: string;
  workerName?: string;
  workerSpecialty?: string;
  workDate: string;
  hours: number;
  hourlyRateBaisa: number;
  totalAmountBaisa: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkerOvertimeInput {
  workerId: string;
  workDate: string;
  hours: number;
  hourlyRateBaisa?: number;
  notes?: string;
}

export interface WorkerOvertimeUpdateInput {
  workDate?: string;
  hours?: number;
  hourlyRateBaisa?: number;
  notes?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface WorkerMonthlyPayrollDTO {
  id: string;
  payrollMonth: string; // YYYY-MM
  workerId: string;
  workerName?: string;
  workerSpecialty?: string;
  workerPhone?: string;
  baseSalaryBaisa: number;
  overtimeHours: number;
  overtimeAmountBaisa: number;
  totalPayableBaisa: number;
  status: 'DRAFT' | 'FINALIZED' | 'PAID';
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GeneratePayrollInput {
  payrollMonth: string; // YYYY-MM
  workerId?: string; // If omitted, generates for all active workers
}

export interface FinalizePayrollInput {
  payrollId: string;
  paymentMethod?: string;
  paymentReference?: string;
  markAsPaid?: boolean;
  notes?: string;
}

export interface WorkerLaborProductivityDTO {
  id: string;
  workDate: string;
  workerId: string;
  workerName?: string;
  workerSpecialty?: string;
  repairOrderId?: string;
  roNumber?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  laborTaskId?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  workDescription: string;
  laborValueBaisa: number;
  hoursSpent: number;
  createdAt: string;
  updatedAt?: string;
}

export interface LaborAllocationInput {
  repairOrderId?: string;
  invoiceId?: string;
  vehicleId?: string;
  workDate: string;
  workDescription: string;
  allocations: Array<{
    workerId: string;
    laborValueBaisa: number;
    hoursSpent?: number;
  }>;
}

// ============================================================================
// INVENTORY DTOs
// ============================================================================

export interface InventoryItemDTO {
  id: string;
  partCode: string; // SKU / Part Number
  name: string;
  category: string;
  manufacturer?: string;
  description?: string;
  quantityInStock: number;
  unit?: string;
  purchaseCostBaisa: number;
  sellingPriceBaisa: number;
  minStockLevel: number;
  supplierId?: string;
  location?: string;
  isSerialized?: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface InventoryItemInput {
  partCode: string;
  name: string;
  category: string;
  manufacturer?: string;
  description?: string;
  quantityInStock: number;
  unit?: string;
  purchaseCostBaisa: number;
  sellingPriceBaisa: number;
  minStockLevel: number;
  supplierId?: string;
  location?: string;
  isSerialized?: boolean;
  isActive?: boolean;
}

export interface InventorySerialDTO {
  id: string;
  itemId: string;
  serialNumber: string;
  status: 'IN_STOCK' | 'ISSUED' | 'RETURNED' | 'DAMAGED';
  repairOrderId?: string;
  invoiceId?: string;
  notes?: string;
  receivedAt: string;
  issuedAt?: string;
  createdAt: string;
  updatedAt?: string;
  itemName?: string;
  partCode?: string;
}

export interface InventorySerialInput {
  itemId: string;
  serialNumber: string;
  notes?: string;
}

export interface InventoryMovementDTO {
  id: string;
  itemId: string;
  itemName?: string;
  partCode?: string;
  movementType: 'PURCHASE_RECEIPT' | 'RO_ISSUE' | 'RETURN_TO_STOCK' | 'MANUAL_ADJUSTMENT';
  quantityDelta: number;
  unitCostBaisa: number;
  serialNumber?: string;
  referenceType?: 'PURCHASE' | 'REPAIR_ORDER' | 'ADJUSTMENT';
  referenceId?: string;
  reason?: string;
  createdBy: string;
  createdAt: string;
}

export interface InventoryAdjustmentInput {
  itemId: string;
  quantityDelta: number;
  reason: string;
  notes?: string;
}

export interface CreateInvoiceFromROInput {
  repairOrderId: string;
  discountBaisa?: number;
  notes?: string;
  invoiceLanguage?: 'ar' | 'en';
}

// ============================================================================
// INVOICES & PAYMENTS DTOs
// ============================================================================

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD_RECORDED';

export interface InvoiceItemDTO {
  id: string;
  invoiceId: string;
  itemType: 'PART' | 'LABOR';
  sourceId?: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPriceBaisa: number;
  costPriceBaisa?: number;
  lineTotalBaisa: number;
}

export interface InvoiceDTO {
  id: string;
  invoiceNumber: string;
  repairOrderId?: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  isCustomerPermanent?: boolean;
  vehicleId?: string;
  vehiclePlate?: string;
  invoiceDate: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  subtotalPartsBaisa: number;
  subtotalLaborBaisa: number;
  discountBaisa: number;
  taxRatePercent: number;
  taxAmountBaisa: number;
  grandTotalBaisa: number;
  paidAmountBaisa: number;
  balanceDueBaisa: number;
  invoiceLanguage: 'ar' | 'en';
  retentionPrompted: boolean;
  printedAt?: string;
  notes?: string;
  items?: InvoiceItemDTO[];
  createdAt: string;
}

export interface InvoiceInput {
  customerId: string;
  vehicleId?: string;
  repairOrderId?: string;
  subtotalPartsBaisa?: number;
  subtotalLaborBaisa?: number;
  discountBaisa?: number;
  taxRatePercent?: number;
  notes?: string;
  invoiceLanguage?: 'ar' | 'en';
}

export interface PaymentInput {
  invoiceId: string;
  amountBaisa: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
}

export interface PaymentResult {
  invoice: InvoiceDTO;
  promptEligible: boolean;
  customer?: CustomerDTO;
}

export interface PaymentDTO {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  invoiceNumber?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  vehiclePlate?: string;
  paymentDate: string;
  amountBaisa: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  receiptNotes?: string;
  createdBy: string;
  createdAt: string;
}

export interface TechnicianInput {
  name: string;
  phone?: string;
  specialty?: string;
  isActive?: boolean;
  notes?: string;
  hourlyRateBaisa?: number;
  monthlyBaseSalaryBaisa?: number;
  overtimeRateBaisa?: number;
  nationalId?: string;
  hireDate?: string;
  employmentStatus?: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
}

export type WorkerInput = TechnicianInput;

export interface SupplierDTO {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface SupplierInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export type ExpenseCategory =
  | 'RENT'
  | 'ELECTRICITY_WATER'
  | 'SALARIES'
  | 'TOOLS_EQUIPMENT'
  | 'GARAGE_MAINTENANCE'
  | 'SUPPLIES'
  | 'OTHER';

export interface ExpenseDTO {
  id: string;
  expenseDate: string;
  category: ExpenseCategory;
  amountBaisa: number;
  paymentMethod: PaymentMethod;
  payee: string;
  description?: string;
  receiptRef?: string;
  createdAt: string;
}

export interface ExpenseInput {
  expenseDate?: string;
  category: ExpenseCategory;
  amountBaisa: number;
  paymentMethod: PaymentMethod;
  payee: string;
  description?: string;
  receiptRef?: string;
}

export interface FinancialReportDTO {
  startDate: string;
  endDate: string;
  totalInvoicedBaisa: number;
  totalCollectedBaisa: number;
  totalOutstandingBaisa: number;
  totalVatBaisa: number;
  totalLaborBaisa: number;
  totalPartsBaisa: number;
  totalExpensesBaisa: number;
  netIncomeBaisa: number;
  invoicesCount: number;
  paymentsCount: number;
  repairOrdersCount: number;
  completedOrdersCount: number;
  topMovingParts: Array<{
    partCode: string;
    partName: string;
    quantity: number;
    totalRevenueBaisa: number;
  }>;
}

export interface PrintResult {
  printed: boolean;
  promptEligible: boolean;
  customer?: CustomerDTO;
}

// ============================================================================
// BACKUP & AUDIT DTOs
// ============================================================================

export interface BackupRecord {
  fileName: string;
  fileSizeBytes: number;
  checksumSha256: string;
  createdAt: string;
  isValid: boolean;
}

export interface BackupResult {
  success: boolean;
  backupFile: string;
  checksumSha256: string;
  createdAt: string;
}

export interface AuditLogEntryDTO {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  previousStateJson?: string;
  newStateJson?: string;
  performedBy: string;
  createdAt: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface ChangeCredentialsInput {
  devCode: string;
  newUsername: string;
  newPassword: string;
}

export interface AuthSessionDTO {
  username: string;
  loginTime: string;
}

export interface PrinterInfoDTO {
  name: string;
  displayName?: string;
  description?: string;
  isDefault: boolean;
  status?: number;
}

export interface GarageApi {
  // Authentication & Security
  login(input: LoginInput): Promise<IpcResult<AuthSessionDTO>>;
  changeCredentials(input: ChangeCredentialsInput): Promise<IpcResult<void>>;
  onSessionLocked?(callback: () => void): () => void;

  // Printers & Hardware
  getPrinters(): Promise<IpcResult<PrinterInfoDTO[]>>;
  testPrint(printerName?: string): Promise<IpcResult<void>>;
  exportInvoicePdf(invoiceId: string, language: 'ar' | 'en'): Promise<IpcResult<{ filePath: string }>>;

  // System Diagnostics
  getSystemInfo(): Promise<IpcResult<SystemInfo>>;
  
  // Settings
  getSetting(key: string): Promise<IpcResult<string | null>>;
  setSetting(key: string, value: string): Promise<IpcResult<void>>;
  getAllSettings(): Promise<IpcResult<Record<string, string>>>;
  
  // Customers
  getCustomers(searchQuery?: string, includeArchived?: boolean, includeTemporary?: boolean): Promise<IpcResult<CustomerDTO[]>>;
  getCustomerById(id: string): Promise<IpcResult<CustomerDTO | null>>;
  createCustomer(input: CustomerInput): Promise<IpcResult<CustomerDTO>>;
  updateCustomer(id: string, input: Partial<CustomerInput>): Promise<IpcResult<CustomerDTO>>;
  archiveCustomer(id: string): Promise<IpcResult<void>>;
  restoreCustomer(id: string): Promise<IpcResult<void>>;
  deleteCustomer(id: string): Promise<IpcResult<void>>;
  promoteCustomer(id: string): Promise<IpcResult<CustomerDTO>>;

  // Vehicles
  getVehicles(filter?: VehicleFilter | string): Promise<IpcResult<VehicleDTO[]>>;
  getVehicleById(id: string): Promise<IpcResult<VehicleDTO | null>>;
  searchVehiclesByPlate(plateNumber: string): Promise<IpcResult<VehicleDTO[]>>;
  checkVehicleDuplicates(plateNumber: string, vin?: string, excludeVehicleId?: string): Promise<IpcResult<{ plateExists: boolean; vinExists: boolean }>>;
  createVehicle(input: VehicleInput): Promise<IpcResult<VehicleDTO>>;
  updateVehicle(id: string, input: Partial<VehicleInput>): Promise<IpcResult<VehicleDTO>>;
  archiveVehicle(id: string): Promise<IpcResult<void>>;
  restoreVehicle(id: string): Promise<IpcResult<void>>;
  deleteVehicle(id: string): Promise<IpcResult<void>>;

  // Repair Orders
  getRepairOrders(statusFilter?: RepairOrderStatus): Promise<IpcResult<RepairOrderDTO[]>>;
  getRepairOrderById(id: string): Promise<IpcResult<RepairOrderDTO | null>>;
  createRepairOrder(input: RepairOrderInput): Promise<IpcResult<RepairOrderDTO>>;
  updateRepairOrderStatus(input: StatusChangeInput): Promise<IpcResult<void>>;
  getLaborTasks(repairOrderId: string): Promise<IpcResult<LaborTaskDTO[]>>;
  addLaborTask(input: LaborTaskInput): Promise<IpcResult<LaborTaskDTO>>;
  updateLaborTask(id: string, input: Partial<LaborTaskInput>): Promise<IpcResult<LaborTaskDTO>>;
  deleteLaborTask(id: string): Promise<IpcResult<void>>;
  getRepairOrderParts(repairOrderId: string): Promise<IpcResult<RepairOrderPartDTO[]>>;
  issuePartToRO(input: IssuePartInput): Promise<IpcResult<RepairOrderPartDTO>>;
  returnPartFromRO(input: ReturnPartInput): Promise<IpcResult<void>>;
  recordCustomerApproval(input: RepairOrderCustomerApprovalInput): Promise<IpcResult<RepairOrderDTO>>;
  getStatusHistory(repairOrderId: string): Promise<IpcResult<RepairOrderStatusHistoryDTO[]>>;
  createInvoiceFromRepairOrder(input: CreateInvoiceFromROInput): Promise<IpcResult<InvoiceDTO>>;
  getTechnicians(): Promise<IpcResult<TechnicianDTO[]>>;
  createTechnician(input: TechnicianInput): Promise<IpcResult<TechnicianDTO>>;
  updateTechnician(id: string, input: Partial<TechnicianInput>): Promise<IpcResult<TechnicianDTO>>;
  deleteTechnician(id: string): Promise<IpcResult<void>>;

  // Worker Overtime, Payroll & Labor Productivity
  getWorkerOvertime(workerId?: string, month?: string): Promise<IpcResult<WorkerOvertimeEntryDTO[]>>;
  addWorkerOvertime(input: WorkerOvertimeInput): Promise<IpcResult<WorkerOvertimeEntryDTO>>;
  updateWorkerOvertime(id: string, input: WorkerOvertimeUpdateInput): Promise<IpcResult<WorkerOvertimeEntryDTO>>;
  updateWorkerOvertimeStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED', approvedBy?: string): Promise<IpcResult<void>>;
  deleteWorkerOvertime(id: string): Promise<IpcResult<void>>;
  getWorkerPayrolls(month?: string, workerId?: string): Promise<IpcResult<WorkerMonthlyPayrollDTO[]>>;
  generateWorkerPayroll(input: GeneratePayrollInput): Promise<IpcResult<WorkerMonthlyPayrollDTO[]>>;
  finalizeWorkerPayroll(input: FinalizePayrollInput): Promise<IpcResult<void>>;
  getWorkerProductivity(workerId?: string, startDate?: string, endDate?: string, repairOrderId?: string): Promise<IpcResult<WorkerLaborProductivityDTO[]>>;
  allocateLaborProductivity(input: LaborAllocationInput): Promise<IpcResult<WorkerLaborProductivityDTO[]>>;
  deleteWorkerProductivity(id: string): Promise<IpcResult<void>>;

  // Inventory & Serial Tracking
  getInventory(searchQuery?: string): Promise<IpcResult<InventoryItemDTO[]>>;
  createInventoryItem(input: InventoryItemInput): Promise<IpcResult<InventoryItemDTO>>;
  receiveInventorySerial(input: InventorySerialInput): Promise<IpcResult<InventorySerialDTO>>;
  issueInventorySerial(serialNumber: string, repairOrderId?: string, invoiceId?: string): Promise<IpcResult<void>>;
  getInventorySerials(itemId?: string, status?: string): Promise<IpcResult<InventorySerialDTO[]>>;
  getInventoryMovements(itemId?: string, repairOrderId?: string): Promise<IpcResult<InventoryMovementDTO[]>>;
  adjustStock(input: InventoryAdjustmentInput): Promise<IpcResult<void>>;
  
  // Invoices & Payments & Customer Retention Workflow
  getInvoices(customerId?: string): Promise<IpcResult<InvoiceDTO[]>>;
  getInvoiceById(id: string): Promise<IpcResult<InvoiceDTO | null>>;
  createInvoice(input: InvoiceInput): Promise<IpcResult<InvoiceDTO>>;
  getPayments(invoiceId?: string): Promise<IpcResult<PaymentDTO[]>>;
  getPaymentById(id: string): Promise<IpcResult<PaymentDTO | null>>;
  recordPayment(input: PaymentInput): Promise<IpcResult<PaymentResult>>;
  markInvoiceRetentionPrompted(invoiceId: string): Promise<IpcResult<void>>;
  checkRetentionEligibility(invoiceId: string): Promise<IpcResult<{ eligible: boolean; customer?: CustomerDTO; invoice?: InvoiceDTO }>>;

  // Suppliers
  getSuppliers(): Promise<IpcResult<SupplierDTO[]>>;
  createSupplier(input: SupplierInput): Promise<IpcResult<SupplierDTO>>;
  updateSupplier(id: string, input: Partial<SupplierInput>): Promise<IpcResult<SupplierDTO>>;
  deleteSupplier(id: string): Promise<IpcResult<void>>;

  // Expenses
  getExpenses(startDate?: string, endDate?: string): Promise<IpcResult<ExpenseDTO[]>>;
  createExpense(input: ExpenseInput): Promise<IpcResult<ExpenseDTO>>;
  deleteExpense(id: string): Promise<IpcResult<void>>;

  // Reports
  getFinancialReport(startDate?: string, endDate?: string): Promise<IpcResult<FinancialReportDTO>>;

  // Backup Management
  listBackups(): Promise<IpcResult<BackupRecord[]>>;
  triggerBackup(): Promise<IpcResult<BackupResult>>;
  restoreBackup(fileName: string): Promise<IpcResult<void>>;
  
  // Printing & PDF Generation
  printInvoice(invoiceId: string, language: 'ar' | 'en'): Promise<IpcResult<PrintResult>>;
  exportInvoicePdf(invoiceId: string, language: 'ar' | 'en'): Promise<IpcResult<{ filePath: string }>>;
  onSessionLocked?(callback: () => void): () => void;
}

declare global {
  interface Window {
    garageApi?: GarageApi;
  }
}

