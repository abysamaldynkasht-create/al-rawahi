/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Strict Zod Validation Schemas for IPC Handlers
 * 
 * Security Guardrails:
 * - All incoming IPC payloads from the renderer are parsed and sanitized here.
 * - String lengths, formats, phone numbers, and numbers are strictly bounded.
 * - Prevents injection, malformed data, and unexpected types.
 */

import { z } from 'zod';

export function normalizePlateNumber(plate: string): string {
  return plate
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export const CustomerInputSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(150),
  phone: z.string().trim().max(20).optional().or(z.literal('')).default(''),
  altPhone: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email address').max(100).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  isPermanent: z.boolean().default(true),
});

export const CustomerUpdateSchema = z.object({
  id: z.string().min(1),
  input: CustomerInputSchema.partial(),
});

export const VehicleInputSchema = z.object({
  customerId: z.string().trim().optional().or(z.literal('')),
  customerName: z.string().trim().max(150).optional().or(z.literal('')),
  customerPhone: z.string().trim().max(20).optional().or(z.literal('')),
  isPermanentCustomer: z.boolean().optional(),
  plateNumber: z.string().trim().min(1, 'Plate number is required').max(30).transform((val) => normalizePlateNumber(val)),
  make: z.string().trim().min(1, 'Make is required').max(50),
  model: z.string().trim().min(1, 'Model is required').max(50),
  year: z.number().int().min(1950, 'Year must be 1950 or later').max(new Date().getFullYear() + 2, 'Year cannot be in the far future'),
  vin: z.string().trim().max(35).optional().or(z.literal('')),
  odometer: z.number().int().nonnegative('Mileage cannot be negative'),
  color: z.string().trim().max(30).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  isPermanent: z.boolean().optional().default(true),
  isActive: z.boolean().default(true),
}).refine((data) => {
  const hasCustomerId = Boolean(data.customerId && data.customerId.trim().length > 0);
  const hasCustomerName = Boolean(data.customerName && data.customerName.trim().length >= 2);
  return hasCustomerId || hasCustomerName;
}, {
  message: 'Customer name or existing customer must be specified (at least 2 characters)',
  path: ['customerName'],
});

export const VehicleUpdateSchema = z.object({
  id: z.string().min(1),
  input: z.object({
    customerId: z.string().trim().optional().or(z.literal('')),
    plateNumber: z.string().trim().min(1).max(30).transform((val) => normalizePlateNumber(val)).optional(),
    make: z.string().trim().min(1).max(50).optional(),
    model: z.string().trim().min(1).max(50).optional(),
    year: z.number().int().min(1950).max(new Date().getFullYear() + 2).optional(),
    vin: z.string().trim().max(35).optional().or(z.literal('')),
    odometer: z.number().int().nonnegative().optional(),
    color: z.string().trim().max(30).optional().or(z.literal('')),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
    isActive: z.boolean().optional(),
  }),
});

export const VehicleDuplicateCheckSchema = z.object({
  plateNumber: z.string().trim().min(1),
  vin: z.string().trim().optional().or(z.literal('')),
  excludeVehicleId: z.string().optional(),
});

export const InventorySerialInputSchema = z.object({
  itemId: z.string().trim().min(1, 'Item ID is required'),
  serialNumber: z.string().trim().min(1, 'Serial number is required').max(100),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const RepairOrderInputSchema = z.object({
  customerId: z.string().min(1),
  vehicleId: z.string().min(1),
  odometerIn: z.number().int().nonnegative(),
  reportedProblem: z.string().trim().min(2).max(1000),
  inspectionNotes: z.string().trim().max(2000).optional().or(z.literal('')),
  requestedWork: z.string().trim().max(2000).optional().or(z.literal('')),
  estimatedCostBaisa: z.number().int().nonnegative().optional().default(0),
  assignedTechnicianId: z.string().optional().or(z.literal('')),
  assignedTechnicianName: z.string().optional().or(z.literal('')),
  expectedAt: z.string().optional().or(z.literal('')),
});

export const StatusChangeInputSchema = z.object({
  repairOrderId: z.string().min(1),
  newStatus: z.enum([
    'RECEIVED',
    'UNDER_INSPECTION',
    'AWAITING_APPROVAL',
    'APPROVED',
    'IN_PROGRESS',
    'WAITING_FOR_PARTS',
    'QUALITY_CHECK',
    'READY_FOR_DELIVERY',
    'COMPLETED',
    'CANCELLED',
    // Aliases
    'UNDER_REPAIR',
    'AWAITING_PARTS',
    'READY_FOR_COLLECTION',
    'DELIVERED',
  ]),
  remarks: z.string().trim().max(500).optional().or(z.literal('')),
  changedBy: z.string().trim().min(1).max(50).default('Admin'),
});

export const InventoryItemInputSchema = z.object({
  partCode: z.string().trim().min(1).max(50),
  name: z.string().trim().min(2).max(150),
  category: z.string().trim().min(1).max(50),
  manufacturer: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  quantityInStock: z.number().min(0),
  unit: z.string().trim().max(20).optional().default('قطعة'),
  purchaseCostBaisa: z.number().int().nonnegative(),
  sellingPriceBaisa: z.number().int().nonnegative(),
  minStockLevel: z.number().min(0).default(1),
  supplierId: z.string().optional().or(z.literal('')),
  location: z.string().trim().max(50).optional().or(z.literal('')),
  isSerialized: z.boolean().optional().default(false),
  isActive: z.boolean().default(true),
});

export const SettingInputSchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.string().max(10000),
});

export const IdParamSchema = z.string().trim().min(1).max(100);

export const SearchQuerySchema = z.string().max(200).optional();

export const InvoiceItemInputSchema = z.object({
  itemType: z.enum(['PART', 'LABOR']),
  sourceId: z.string().trim().optional().or(z.literal('')),
  description: z.string().trim().min(1, 'Item description is required').max(500),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unit: z.string().trim().max(30).optional().default('قطعة'),
  unitPriceBaisa: z.number().int().nonnegative('Unit price must be non-negative'),
  costPriceBaisa: z.number().int().nonnegative().optional().default(0),
  lineTotalBaisa: z.number().int().nonnegative('Line total must be non-negative'),
});

export const InvoiceInputSchema = z.object({
  customerId: z.string().trim().min(1, 'Customer ID is required'),
  vehicleId: z.string().trim().optional().or(z.literal('')),
  repairOrderId: z.string().trim().optional().or(z.literal('')),
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']).optional().default('ISSUED'),
  subtotalPartsBaisa: z.number().int().nonnegative().optional().default(0),
  subtotalLaborBaisa: z.number().int().nonnegative().optional().default(0),
  discountBaisa: z.number().int().nonnegative().optional().default(0),
  taxRatePercent: z.number().nonnegative().optional().default(5.0),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  invoiceLanguage: z.enum(['ar', 'en']).optional().default('ar'),
  items: z.array(InvoiceItemInputSchema).optional(),
});

export const InvoiceUpdateSchema = z.object({
  id: z.string().trim().min(1, 'Invoice ID is required'),
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']).optional(),
  discountBaisa: z.number().int().nonnegative().optional(),
  taxRatePercent: z.number().nonnegative().optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  invoiceLanguage: z.enum(['ar', 'en']).optional(),
  items: z.array(InvoiceItemInputSchema).optional(),
});

export const PaymentInputSchema = z.object({
  invoiceId: z.string().trim().min(1, 'Invoice ID is required'),
  amountBaisa: z.number().int().positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD_RECORDED']),
  referenceNumber: z.string().trim().max(100).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const LaborTaskInputSchema = z.object({
  repairOrderId: z.string().trim().min(1, 'Repair order ID is required'),
  technicianId: z.string().trim().optional().or(z.literal('')),
  technicianName: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().trim().min(2, 'Description must be at least 2 characters').max(500),
  hours: z.number().positive().max(100).optional().default(1.0),
  hourlyRateBaisa: z.number().int().nonnegative().optional().default(0),
  laborChargeBaisa: z.number().int().nonnegative(),
  internalCostBaisa: z.number().int().nonnegative().optional().default(0),
  isApproved: z.boolean().optional().default(true),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional().default('PENDING'),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const IssuePartInputSchema = z.object({
  repairOrderId: z.string().trim().min(1, 'Repair order ID is required'),
  itemId: z.string().trim().min(1, 'Item ID is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unit: z.string().trim().max(20).optional().default('قطعة'),
  serialNumber: z.string().trim().max(100).optional().or(z.literal('')),
  unitPriceBaisa: z.number().int().nonnegative().optional(),
  isApproved: z.boolean().optional().default(true),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  idempotencyKey: z.string().trim().max(100).optional().or(z.literal('')),
});

export const ReturnPartInputSchema = z.object({
  repairOrderId: z.string().trim().min(1, 'Repair order ID is required'),
  roPartId: z.string().trim().min(1, 'RO Part ID is required'),
  reason: z.string().trim().max(500).optional().or(z.literal('Returned to stock')),
  isDefective: z.boolean().optional().default(false),
});

export const CustomerApprovalSchema = z.object({
  repairOrderId: z.string().trim().min(1, 'Repair order ID is required'),
  approved: z.boolean(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  approvedBy: z.string().trim().max(100).optional().or(z.literal('Customer')),
});

export const CreateInvoiceFromROSchema = z.object({
  repairOrderId: z.string().trim().min(1, 'Repair order ID is required'),
  discountBaisa: z.number().int().nonnegative().optional().default(0),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  invoiceLanguage: z.enum(['ar', 'en']).optional().default('ar'),
});

export const InventoryAdjustmentSchema = z.object({
  itemId: z.string().trim().min(1, 'Item ID is required'),
  quantityDelta: z.number().refine((val) => val !== 0, 'Adjustment delta must be non-zero'),
  reason: z.string().trim().min(2, 'Reason is required').max(500),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const TechnicianInputSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().trim().max(25).optional().or(z.literal('')),
  specialty: z.string().trim().max(100).optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  hourlyRateBaisa: z.number().int().nonnegative().optional().default(7000),
  monthlyBaseSalaryBaisa: z.number().int().nonnegative().optional().default(350000),
  overtimeRateBaisa: z.number().int().nonnegative().optional().default(2500),
  nationalId: z.string().trim().max(50).optional().or(z.literal('')),
  hireDate: z.string().trim().max(20).optional(),
  employmentStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED']).optional().default('ACTIVE'),
});

export const WorkerOvertimeInputSchema = z.object({
  workerId: z.string().trim().min(1, 'Worker ID is required'),
  workDate: z.string().trim().min(8, 'Valid work date is required'),
  hours: z.number().positive('Hours must be greater than 0').max(24, 'Cannot exceed 24 hours in a single entry'),
  hourlyRateBaisa: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const WorkerOvertimeUpdateSchema = z.object({
  id: z.string().trim().min(1, 'ID is required'),
  input: z.object({
    workDate: z.string().trim().min(8).optional(),
    hours: z.number().positive().max(24).optional(),
    hourlyRateBaisa: z.number().int().nonnegative().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    notes: z.string().trim().max(500).optional().or(z.literal('')),
    approvedBy: z.string().trim().max(100).optional(),
  }),
});

export const GeneratePayrollInputSchema = z.object({
  payrollMonth: z.string().trim().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM'),
  workerId: z.string().trim().optional(),
});

export const FinalizePayrollInputSchema = z.object({
  payrollId: z.string().trim().min(1, 'Payroll ID is required'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER']).optional(),
  paymentReference: z.string().trim().max(100).optional().or(z.literal('')),
  markAsPaid: z.boolean().optional().default(false),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const LaborAllocationInputSchema = z.object({
  repairOrderId: z.string().trim().optional(),
  invoiceId: z.string().trim().optional(),
  vehicleId: z.string().trim().optional(),
  workDate: z.string().trim().min(8, 'Work date is required'),
  workDescription: z.string().trim().min(2, 'Description must be at least 2 characters').max(500),
  allocations: z.array(z.object({
    workerId: z.string().trim().min(1, 'Worker ID is required'),
    laborValueBaisa: z.number().int().nonnegative('Labor value cannot be negative'),
    hoursSpent: z.number().nonnegative().optional().default(1.0),
  })).min(1, 'At least one worker allocation must be specified'),
});

export const SupplierInputSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(150),
  phone: z.string().trim().max(25).optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email address').max(100).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const ExpenseInputSchema = z.object({
  expenseDate: z.string().trim().max(20).optional(),
  category: z.enum(['RENT', 'ELECTRICITY_WATER', 'SALARIES', 'TOOLS_EQUIPMENT', 'GARAGE_MAINTENANCE', 'SUPPLIES', 'OTHER']),
  amountBaisa: z.number().int().positive('Amount must be positive'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD_RECORDED']),
  payee: z.string().trim().min(2, 'Payee must be at least 2 characters').max(150),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  receiptRef: z.string().trim().max(100).optional().or(z.literal('')),
});

export const DateRangeSchema = z.object({
  startDate: z.string().trim().optional().or(z.literal('')),
  endDate: z.string().trim().optional().or(z.literal('')),
});

export const LoginInputSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(150),
});

export const ChangeCredentialsSchema = z.object({
  devCode: z.string().trim().min(1, 'Developer authorization code is required'),
  newUsername: z.string().trim().min(3, 'Username must be at least 3 characters').max(50),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(150),
});




