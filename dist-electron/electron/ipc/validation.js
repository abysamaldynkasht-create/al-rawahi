"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchQuerySchema = exports.IdParamSchema = exports.SettingInputSchema = exports.InventoryItemInputSchema = exports.StatusChangeInputSchema = exports.RepairOrderInputSchema = exports.VehicleInputSchema = exports.CustomerUpdateSchema = exports.CustomerInputSchema = void 0;
const zod_1 = require("zod");
exports.CustomerInputSchema = zod_1.z.object({
    fullName: zod_1.z.string().trim().min(2).max(150),
    phone: zod_1.z.string().trim().min(7).max(20),
    email: zod_1.z.string().trim().email().max(100).optional().or(zod_1.z.literal('')),
    address: zod_1.z.string().trim().max(300).optional().or(zod_1.z.literal('')),
    notes: zod_1.z.string().trim().max(1000).optional().or(zod_1.z.literal('')),
});
exports.CustomerUpdateSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    input: exports.CustomerInputSchema.partial(),
});
exports.VehicleInputSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1),
    plateNumber: zod_1.z.string().trim().min(2).max(20),
    make: zod_1.z.string().trim().min(1).max(50),
    model: zod_1.z.string().trim().min(1).max(50),
    year: zod_1.z.number().int().min(1950).max(2100),
    vin: zod_1.z.string().trim().max(30).optional().or(zod_1.z.literal('')),
    odometer: zod_1.z.number().int().nonnegative(),
    color: zod_1.z.string().trim().max(30).optional().or(zod_1.z.literal('')),
    notes: zod_1.z.string().trim().max(1000).optional().or(zod_1.z.literal('')),
});
exports.RepairOrderInputSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1),
    vehicleId: zod_1.z.string().min(1),
    odometerIn: zod_1.z.number().int().nonnegative(),
    reportedProblem: zod_1.z.string().trim().min(2).max(1000),
    inspectionNotes: zod_1.z.string().trim().max(2000).optional().or(zod_1.z.literal('')),
    requestedWork: zod_1.z.string().trim().max(2000).optional().or(zod_1.z.literal('')),
    estimatedCostBaisa: zod_1.z.number().int().nonnegative().optional().default(0),
    expectedAt: zod_1.z.string().datetime().optional().or(zod_1.z.literal('')),
});
exports.StatusChangeInputSchema = zod_1.z.object({
    repairOrderId: zod_1.z.string().min(1),
    newStatus: zod_1.z.enum([
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
    remarks: zod_1.z.string().trim().max(500).optional().or(zod_1.z.literal('')),
    changedBy: zod_1.z.string().trim().min(1).max(50).default('Admin'),
});
exports.InventoryItemInputSchema = zod_1.z.object({
    partCode: zod_1.z.string().trim().min(1).max(50),
    name: zod_1.z.string().trim().min(2).max(150),
    category: zod_1.z.string().trim().min(1).max(50),
    description: zod_1.z.string().trim().max(500).optional().or(zod_1.z.literal('')),
    quantityInStock: zod_1.z.number().min(0),
    purchaseCostBaisa: zod_1.z.number().int().nonnegative(),
    sellingPriceBaisa: zod_1.z.number().int().nonnegative(),
    minStockLevel: zod_1.z.number().min(0).default(1),
    supplierId: zod_1.z.string().optional().or(zod_1.z.literal('')),
    location: zod_1.z.string().trim().max(50).optional().or(zod_1.z.literal('')),
    isActive: zod_1.z.boolean().default(true),
});
exports.SettingInputSchema = zod_1.z.object({
    key: zod_1.z.string().trim().min(1).max(100),
    value: zod_1.z.string().max(10000),
});
exports.IdParamSchema = zod_1.z.string().trim().min(1).max(100);
exports.SearchQuerySchema = zod_1.z.string().max(200).optional();
