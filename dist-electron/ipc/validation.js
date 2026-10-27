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
export const CustomerInputSchema = z.object({
    fullName: z.string().trim().min(2).max(150),
    phone: z.string().trim().min(7).max(20),
    email: z.string().trim().email().max(100).optional().or(z.literal('')),
    address: z.string().trim().max(300).optional().or(z.literal('')),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
});
export const CustomerUpdateSchema = z.object({
    id: z.string().min(1),
    input: CustomerInputSchema.partial(),
});
export const VehicleInputSchema = z.object({
    customerId: z.string().min(1),
    plateNumber: z.string().trim().min(2).max(20),
    make: z.string().trim().min(1).max(50),
    model: z.string().trim().min(1).max(50),
    year: z.number().int().min(1950).max(2100),
    vin: z.string().trim().max(30).optional().or(z.literal('')),
    odometer: z.number().int().nonnegative(),
    color: z.string().trim().max(30).optional().or(z.literal('')),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
});
export const RepairOrderInputSchema = z.object({
    customerId: z.string().min(1),
    vehicleId: z.string().min(1),
    odometerIn: z.number().int().nonnegative(),
    reportedProblem: z.string().trim().min(2).max(1000),
    inspectionNotes: z.string().trim().max(2000).optional().or(z.literal('')),
    requestedWork: z.string().trim().max(2000).optional().or(z.literal('')),
    estimatedCostBaisa: z.number().int().nonnegative().optional().default(0),
    expectedAt: z.string().datetime().optional().or(z.literal('')),
});
export const StatusChangeInputSchema = z.object({
    repairOrderId: z.string().min(1),
    newStatus: z.enum([
        'RECEIVED',
        'UNDER_INSPECTION',
        'AWAITING_APPROVAL',
        'AWAITING_PARTS',
        'UNDER_REPAIR',
        'QUALITY_CHECK',
        'COMPLETED',
        'READY_FOR_COLLECTION',
        'DELIVERED',
        'CANCELLED',
    ]),
    remarks: z.string().trim().max(500).optional().or(z.literal('')),
    changedBy: z.string().trim().min(1).max(50).default('Admin'),
});
export const InventoryItemInputSchema = z.object({
    partCode: z.string().trim().min(1).max(50),
    name: z.string().trim().min(2).max(150),
    category: z.string().trim().min(1).max(50),
    description: z.string().trim().max(500).optional().or(z.literal('')),
    quantityInStock: z.number().min(0),
    purchaseCostBaisa: z.number().int().nonnegative(),
    sellingPriceBaisa: z.number().int().nonnegative(),
    minStockLevel: z.number().min(0).default(1),
    supplierId: z.string().optional().or(z.literal('')),
    location: z.string().trim().max(50).optional().or(z.literal('')),
    isActive: z.boolean().default(true),
});
export const SettingInputSchema = z.object({
    key: z.string().trim().min(1).max(100),
    value: z.string().max(10000),
});
