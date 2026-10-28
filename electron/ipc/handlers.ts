/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Secure Main-Process IPC Handlers
 * 
 * Security Guardrails:
 * - Every handler validates arguments with Zod schemas.
 * - Errors are caught and returned as structured IpcResult objects (never crashing main process).
 * - No arbitrary SQL or file paths are accepted from the renderer.
 */

import { ipcMain, BrowserWindow } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDatabase, getDatabasePath, getBackupsDir } from '../database/connection.ts';
import { verifyPassword, hashPassword, verifyDeveloperCode } from '../auth/passwords.ts';
import {
  CustomerInputSchema,
  CustomerUpdateSchema,
  VehicleInputSchema,
  VehicleUpdateSchema,
  VehicleDuplicateCheckSchema,
  RepairOrderInputSchema,
  StatusChangeInputSchema,
  LaborTaskInputSchema,
  IssuePartInputSchema,
  ReturnPartInputSchema,
  CustomerApprovalSchema,
  CreateInvoiceFromROSchema,
  InventoryAdjustmentSchema,
  InventoryItemInputSchema,
  InventorySerialInputSchema,
  SettingInputSchema,
  IdParamSchema,
  SearchQuerySchema,
  InvoiceInputSchema,
  InvoiceUpdateSchema,
  PaymentInputSchema,
  TechnicianInputSchema,
  WorkerOvertimeInputSchema,
  WorkerOvertimeUpdateSchema,
  GeneratePayrollInputSchema,
  FinalizePayrollInputSchema,
  LaborAllocationInputSchema,
  SupplierInputSchema,
  ExpenseInputSchema,
  DateRangeSchema,
  LoginInputSchema,
  ChangeCredentialsSchema,
  normalizePlateNumber,
} from './validation.ts';
import type {
  IpcResult,
  SystemInfo,
  CustomerDTO,
  CustomerInput,
  VehicleDTO,
  VehicleInput,
  VehicleFilter,
  RepairOrderDTO,
  RepairOrderStatusHistoryDTO,
  LaborTaskDTO,
  RepairOrderPartDTO,
  TechnicianDTO,
  WorkerOvertimeEntryDTO,
  WorkerMonthlyPayrollDTO,
  WorkerLaborProductivityDTO,
  InventoryItemDTO,
  InventorySerialDTO,
  InventorySerialInput,
  InventoryMovementDTO,
  InvoiceDTO,
  InvoiceItemDTO,
  InvoiceInput,
  PaymentInput,
  PaymentResult,
  PaymentDTO,
  SupplierDTO,
  ExpenseDTO,
  FinancialReportDTO,
  PrintResult,
  BackupRecord,
  BackupResult,
  AuthSessionDTO,
  PrinterInfoDTO,
} from '../../src/types/ipc.ts';

export function registerIpcHandlers(): void {
  // 1. System Info Handler
  ipcMain.handle('system:getInfo', async (): Promise<IpcResult<SystemInfo>> => {
    try {
      const db = getDatabase();
      const migrationRow = db.prepare('SELECT max(version) as version FROM schema_migrations').get() as { version: number };
      const customerCount = db.prepare('SELECT count(*) as count FROM customers').get() as { count: number };
      const vehicleCount = db.prepare('SELECT count(*) as count FROM vehicles').get() as { count: number };
      const roCount = db.prepare("SELECT count(*) as count FROM repair_orders WHERE status NOT IN ('DELIVERED', 'CANCELLED')").get() as { count: number };

      return {
        success: true,
        data: {
          platform: 'electron',
          appName: 'AL RAWAHI GARAGE MANAGEMENT SYSTEM',
          version: '1.0.0',
          databasePath: getDatabasePath(),
          databaseStatus: 'connected',
          activeSchemaVersion: migrationRow?.version || 1,
          totalCustomers: customerCount.count,
          totalVehicles: vehicleCount.count,
          openRepairOrders: roCount.count,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown database error' };
    }
  });

  // 2. Settings Handlers
  ipcMain.handle('settings:get', async (_event, key: string): Promise<IpcResult<string | null>> => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return { success: true, data: row ? row.value : null };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to retrieve setting' };
    }
  });

  ipcMain.handle('settings:set', async (_event, payload: unknown): Promise<IpcResult<void>> => {
    try {
      const validated = SettingInputSchema.parse(payload);
      const db = getDatabase();
      db.prepare(`
        INSERT INTO settings (key, value, updated_at) 
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `).run(validated.key, validated.value);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Validation or database error' };
    }
  });

  ipcMain.handle('settings:getAll', async (): Promise<IpcResult<Record<string, string>>> => {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;
      return { success: true, data: map };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to retrieve settings' };
    }
  });

  // 3. Customers Handlers
  ipcMain.handle('customers:get', async (_event, searchQuery?: string, includeArchived?: boolean, includeTemporary?: boolean): Promise<IpcResult<CustomerDTO[]>> => {
    try {
      const db = getDatabase();
      let query = `
        SELECT 
          c.id, c.full_name, c.phone, c.alt_phone, c.email, c.address, c.notes, 
          COALESCE(c.is_active, 1) as is_active, COALESCE(c.is_permanent, 1) as is_permanent,
          c.created_at, c.updated_at,
          (SELECT count(*) FROM vehicles v WHERE v.customer_id = c.id) as vehicle_count
        FROM customers c
      `;
      const whereClauses: string[] = [];
      const params: unknown[] = [];

      if (!includeArchived) {
        whereClauses.push('COALESCE(c.is_active, 1) = 1');
      }

      // Permanent directory filtering: if includeTemporary is false or not provided, show only permanent customers
      if (!includeTemporary) {
        whereClauses.push('COALESCE(c.is_permanent, 1) = 1');
      }

      if (searchQuery && searchQuery.trim()) {
        const clean = searchQuery.trim();
        const wild = `%${clean}%`;
        whereClauses.push('(c.full_name LIKE ? OR c.phone LIKE ? OR c.alt_phone LIKE ?)');
        params.push(wild, wild, wild);
      }

      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }
      query += ' ORDER BY c.created_at DESC';

      const rows = db.prepare(query).all(...params) as Array<{
        id: string;
        full_name: string;
        phone: string;
        alt_phone: string | null;
        email: string | null;
        address: string | null;
        notes: string | null;
        is_active: number;
        is_permanent: number;
        created_at: string;
        updated_at: string;
        vehicle_count: number;
      }>;

      const customers: CustomerDTO[] = rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        phone: r.phone,
        altPhone: r.alt_phone || undefined,
        email: r.email || undefined,
        address: r.address || undefined,
        notes: r.notes || undefined,
        isActive: r.is_active === 1,
        isPermanent: r.is_permanent === 1,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        vehicleCount: r.vehicle_count,
      }));

      return { success: true, data: customers };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to query customers' };
    }
  });

  ipcMain.handle('customers:getById', async (_event, idParam: unknown): Promise<IpcResult<CustomerDTO | null>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      const row = db.prepare(`
        SELECT 
          c.id, c.full_name, c.phone, c.alt_phone, c.email, c.address, c.notes, 
          COALESCE(c.is_active, 1) as is_active, COALESCE(c.is_permanent, 1) as is_permanent,
          c.created_at, c.updated_at,
          (SELECT count(*) FROM vehicles v WHERE v.customer_id = c.id) as vehicle_count
        FROM customers c 
        WHERE c.id = ?
      `).get(id) as {
        id: string;
        full_name: string;
        phone: string;
        alt_phone: string | null;
        email: string | null;
        address: string | null;
        notes: string | null;
        is_active: number;
        is_permanent: number;
        created_at: string;
        updated_at: string;
        vehicle_count: number;
      } | undefined;

      if (!row) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          id: row.id,
          fullName: row.full_name,
          phone: row.phone,
          altPhone: row.alt_phone || undefined,
          email: row.email || undefined,
          address: row.address || undefined,
          notes: row.notes || undefined,
          isActive: row.is_active === 1,
          isPermanent: row.is_permanent === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          vehicleCount: row.vehicle_count,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get customer by ID' };
    }
  });

  ipcMain.handle('customers:create', async (_event, payload: unknown): Promise<IpcResult<CustomerDTO>> => {
    try {
      const validated = CustomerInputSchema.parse(payload);
      const db = getDatabase();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const isPermanent = validated.isPermanent !== false ? 1 : 0;

      db.prepare(`
        INSERT INTO customers (id, full_name, phone, alt_phone, email, address, notes, is_active, is_permanent, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        id,
        validated.fullName,
        validated.phone,
        validated.altPhone || null,
        validated.email || null,
        validated.address || null,
        validated.notes || null,
        validated.isActive !== false ? 1 : 0,
        isPermanent
      );

      return {
        success: true,
        data: {
          id,
          fullName: validated.fullName,
          phone: validated.phone,
          altPhone: validated.altPhone || undefined,
          email: validated.email || undefined,
          address: validated.address || undefined,
          notes: validated.notes || undefined,
          isActive: validated.isActive !== false,
          isPermanent: isPermanent === 1,
          createdAt: now,
          updatedAt: now,
          vehicleCount: 0,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Validation or database error' };
    }
  });

  ipcMain.handle('customers:update', async (_event, payload: unknown): Promise<IpcResult<CustomerDTO>> => {
    try {
      const { id, input } = CustomerUpdateSchema.parse(payload);
      const db = getDatabase();
      
      const existing = db.prepare(`
        SELECT id, full_name, phone, alt_phone, email, address, notes, COALESCE(is_active, 1) as is_active, COALESCE(is_permanent, 1) as is_permanent, created_at,
          (SELECT count(*) FROM vehicles v WHERE v.customer_id = customers.id) as vehicle_count
        FROM customers WHERE id = ?
      `).get(id) as {
        id: string;
        full_name: string;
        phone: string;
        alt_phone: string | null;
        email: string | null;
        address: string | null;
        notes: string | null;
        is_active: number;
        is_permanent: number;
        created_at: string;
        vehicle_count: number;
      } | undefined;

      if (!existing) {
        return { success: false, error: 'Customer not found' };
      }

      const updatedName = input.fullName ?? existing.full_name;
      const updatedPhone = input.phone ?? existing.phone;
      const updatedAltPhone = input.altPhone !== undefined ? (input.altPhone || null) : existing.alt_phone;
      const updatedEmail = input.email !== undefined ? (input.email || null) : existing.email;
      const updatedAddress = input.address !== undefined ? (input.address || null) : existing.address;
      const updatedNotes = input.notes !== undefined ? (input.notes || null) : existing.notes;
      const updatedActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE customers SET
          full_name = ?,
          phone = ?,
          alt_phone = ?,
          email = ?,
          address = ?,
          notes = ?,
          is_active = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(updatedName, updatedPhone, updatedAltPhone, updatedEmail, updatedAddress, updatedNotes, updatedActive, id);

      return {
        success: true,
        data: {
          id,
          fullName: updatedName,
          phone: updatedPhone,
          altPhone: updatedAltPhone || undefined,
          email: updatedEmail || undefined,
          address: updatedAddress || undefined,
          notes: updatedNotes || undefined,
          isActive: updatedActive === 1,
          isPermanent: existing.is_permanent === 1,
          createdAt: existing.created_at,
          updatedAt: now,
          vehicleCount: existing.vehicle_count,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Customer update failed' };
    }
  });

  ipcMain.handle('customers:archive', async (_event, idParam: unknown): Promise<IpcResult<void>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      db.prepare("UPDATE customers SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to archive customer' };
    }
  });

  ipcMain.handle('customers:restore', async (_event, idParam: unknown): Promise<IpcResult<void>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      db.prepare("UPDATE customers SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to restore customer' };
    }
  });

  ipcMain.handle('customers:delete', async (_event, idParam: unknown): Promise<IpcResult<void>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      
      const vehicleCheck = db.prepare('SELECT count(*) as count FROM vehicles WHERE customer_id = ?').get(id) as { count: number };
      const roCheck = db.prepare('SELECT count(*) as count FROM repair_orders WHERE customer_id = ?').get(id) as { count: number };

      if (vehicleCheck.count > 0 || roCheck.count > 0) {
        return {
          success: false,
          error: 'Cannot delete customer with registered vehicles or repair orders. Please archive the customer instead to preserve history.',
          errorCode: 'CUSTOMER_HAS_LINKED_RECORDS',
        };
      }

      db.prepare('DELETE FROM customers WHERE id = ?').run(id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete customer' };
    }
  });

  ipcMain.handle('customers:promote', async (_event, idParam: unknown): Promise<IpcResult<CustomerDTO>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      const existing = db.prepare(`
        SELECT 
          c.id, c.full_name, c.phone, c.alt_phone, c.email, c.address, c.notes,
          COALESCE(c.is_active, 1) as is_active, COALESCE(c.is_permanent, 1) as is_permanent,
          c.created_at, c.updated_at,
          (SELECT count(*) FROM vehicles v WHERE v.customer_id = c.id) as vehicle_count
        FROM customers c
        WHERE c.id = ?
      `).get(id) as {
        id: string;
        full_name: string;
        phone: string;
        alt_phone: string | null;
        email: string | null;
        address: string | null;
        notes: string | null;
        is_active: number;
        is_permanent: number;
        created_at: string;
        updated_at: string;
        vehicle_count: number;
      } | undefined;

      if (!existing) {
        return { success: false, error: 'Customer not found' };
      }

      const now = new Date().toISOString();
      db.prepare("UPDATE customers SET is_permanent = 1, updated_at = datetime('now') WHERE id = ?").run(id);

      return {
        success: true,
        data: {
          id: existing.id,
          fullName: existing.full_name,
          phone: existing.phone,
          altPhone: existing.alt_phone || undefined,
          email: existing.email || undefined,
          address: existing.address || undefined,
          notes: existing.notes || undefined,
          isActive: existing.is_active === 1,
          isPermanent: true,
          createdAt: existing.created_at,
          updatedAt: now,
          vehicleCount: existing.vehicle_count,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Customer promotion failed' };
    }
  });

  // 4. Vehicles Handlers
  ipcMain.handle('vehicles:get', async (_event, filterParam?: unknown): Promise<IpcResult<VehicleDTO[]>> => {
    try {
      const db = getDatabase();
      let query = `
        SELECT 
          v.id, v.customer_id, v.plate_number, v.make, v.model, v.year, v.vin, 
          v.odometer, v.color, v.notes, COALESCE(v.is_active, 1) as is_active, 
          COALESCE(v.is_permanent, 1) as is_permanent,
          v.created_at, COALESCE(v.updated_at, v.created_at) as updated_at,
          c.full_name as customer_name, c.phone as customer_phone
        FROM vehicles v
        LEFT JOIN customers c ON c.id = v.customer_id
      `;
      const whereClauses: string[] = [];
      const params: unknown[] = [];

      let customerId: string | undefined;
      let searchQuery: string | undefined;
      let includeArchived = false;

      if (typeof filterParam === 'string' && filterParam.trim()) {
        customerId = filterParam.trim();
      } else if (filterParam && typeof filterParam === 'object') {
        const filter = filterParam as VehicleFilter;
        customerId = filter.customerId;
        searchQuery = filter.searchQuery;
        includeArchived = Boolean(filter.includeArchived);
      }

      if (!includeArchived) {
        whereClauses.push('COALESCE(v.is_active, 1) = 1');
      }

      if (customerId) {
        whereClauses.push('v.customer_id = ?');
        params.push(customerId);
      }

      if (searchQuery && searchQuery.trim()) {
        const clean = searchQuery.trim();
        const wild = `%${clean}%`;
        whereClauses.push('(v.plate_number LIKE ? OR v.vin LIKE ? OR v.make LIKE ? OR v.model LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ?)');
        params.push(wild, wild, wild, wild, wild, wild);
      }

      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }
      query += ' ORDER BY v.created_at DESC';

      const rows = db.prepare(query).all(...params) as Array<{
        id: string;
        customer_id: string;
        plate_number: string;
        make: string;
        model: string;
        year: number;
        vin: string | null;
        odometer: number;
        color: string | null;
        notes: string | null;
        is_active: number;
        is_permanent?: number;
        created_at: string;
        updated_at: string;
        customer_name: string | null;
        customer_phone: string | null;
      }>;

      const vehicles: VehicleDTO[] = rows.map((r) => ({
        id: r.id,
        customerId: r.customer_id,
        customerName: r.customer_name || undefined,
        customerPhone: r.customer_phone || undefined,
        plateNumber: r.plate_number,
        make: r.make,
        model: r.model,
        year: r.year,
        vin: r.vin || undefined,
        odometer: r.odometer,
        color: r.color || undefined,
        notes: r.notes || undefined,
        isActive: r.is_active === 1,
        isPermanent: r.is_permanent !== 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      return { success: true, data: vehicles };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to query vehicles' };
    }
  });

  ipcMain.handle('vehicles:getById', async (_event, idParam: unknown): Promise<IpcResult<VehicleDTO | null>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      const row = db.prepare(`
        SELECT 
          v.id, v.customer_id, v.plate_number, v.make, v.model, v.year, v.vin, 
          v.odometer, v.color, v.notes, COALESCE(v.is_active, 1) as is_active, 
          COALESCE(v.is_permanent, 1) as is_permanent,
          v.created_at, COALESCE(v.updated_at, v.created_at) as updated_at,
          c.full_name as customer_name, c.phone as customer_phone
        FROM vehicles v
        LEFT JOIN customers c ON c.id = v.customer_id
        WHERE v.id = ?
      `).get(id) as {
        id: string;
        customer_id: string;
        plate_number: string;
        make: string;
        model: string;
        year: number;
        vin: string | null;
        odometer: number;
        color: string | null;
        notes: string | null;
        is_active: number;
        is_permanent?: number;
        created_at: string;
        updated_at: string;
        customer_name: string | null;
        customer_phone: string | null;
      } | undefined;

      if (!row) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          id: row.id,
          customerId: row.customer_id,
          customerName: row.customer_name || undefined,
          customerPhone: row.customer_phone || undefined,
          plateNumber: row.plate_number,
          make: row.make,
          model: row.model,
          year: row.year,
          vin: row.vin || undefined,
          odometer: row.odometer,
          color: row.color || undefined,
          notes: row.notes || undefined,
          isActive: row.is_active === 1,
          isPermanent: row.is_permanent !== 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get vehicle by ID' };
    }
  });

  ipcMain.handle('vehicles:searchPlate', async (_event, plateParam: unknown): Promise<IpcResult<VehicleDTO[]>> => {
    try {
      const plate = IdParamSchema.parse(plateParam);
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT 
          v.id, v.customer_id, v.plate_number, v.make, v.model, v.year, v.vin, 
          v.odometer, v.color, v.notes, COALESCE(v.is_active, 1) as is_active, 
          COALESCE(v.is_permanent, 1) as is_permanent,
          v.created_at, COALESCE(v.updated_at, v.created_at) as updated_at,
          c.full_name as customer_name, c.phone as customer_phone
        FROM vehicles v
        LEFT JOIN customers c ON c.id = v.customer_id
        WHERE v.plate_number LIKE ?
      `).all(`%${plate}%`) as Array<{
        id: string;
        customer_id: string;
        plate_number: string;
        make: string;
        model: string;
        year: number;
        vin: string | null;
        odometer: number;
        color: string | null;
        notes: string | null;
        is_active: number;
        is_permanent?: number;
        created_at: string;
        updated_at: string;
        customer_name: string | null;
        customer_phone: string | null;
      }>;

      const vehicles: VehicleDTO[] = rows.map((r) => ({
        id: r.id,
        customerId: r.customer_id,
        customerName: r.customer_name || undefined,
        customerPhone: r.customer_phone || undefined,
        plateNumber: r.plate_number,
        make: r.make,
        model: r.model,
        year: r.year,
        vin: r.vin || undefined,
        odometer: r.odometer,
        color: r.color || undefined,
        notes: r.notes || undefined,
        isActive: r.is_active === 1,
        isPermanent: r.is_permanent !== 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      return { success: true, data: vehicles };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to search vehicles by plate' };
    }
  });

  ipcMain.handle('vehicles:checkDuplicates', async (_event, payload: unknown): Promise<IpcResult<{ plateExists: boolean; vinExists: boolean }>> => {
    try {
      const validated = VehicleDuplicateCheckSchema.parse(payload);
      const db = getDatabase();
      const normalizedPlate = normalizePlateNumber(validated.plateNumber);

      let plateRow: { count: number };
      if (validated.excludeVehicleId) {
        plateRow = db.prepare('SELECT count(*) as count FROM vehicles WHERE plate_number = ? AND id != ?').get(normalizedPlate, validated.excludeVehicleId) as { count: number };
      } else {
        plateRow = db.prepare('SELECT count(*) as count FROM vehicles WHERE plate_number = ?').get(normalizedPlate) as { count: number };
      }

      let vinExists = false;
      if (validated.vin && validated.vin.trim()) {
        const cleanVin = validated.vin.trim().toUpperCase();
        let vinRow: { count: number };
        if (validated.excludeVehicleId) {
          vinRow = db.prepare('SELECT count(*) as count FROM vehicles WHERE UPPER(vin) = ? AND id != ?').get(cleanVin, validated.excludeVehicleId) as { count: number };
        } else {
          vinRow = db.prepare('SELECT count(*) as count FROM vehicles WHERE UPPER(vin) = ?').get(cleanVin) as { count: number };
        }
        vinExists = vinRow.count > 0;
      }

      return {
        success: true,
        data: {
          plateExists: plateRow.count > 0,
          vinExists,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to check vehicle duplicates' };
    }
  });

  ipcMain.handle('vehicles:create', async (_event, payload: unknown): Promise<IpcResult<VehicleDTO>> => {
    try {
      const validated = VehicleInputSchema.parse(payload);
      const db = getDatabase();

      // Check plate duplicate FIRST
      const existingPlate = db.prepare('SELECT id FROM vehicles WHERE plate_number = ?').get(validated.plateNumber);
      if (existingPlate) {
        return { success: false, error: `A vehicle with plate number "${validated.plateNumber}" already exists.` };
      }

      // Check VIN duplicate if VIN is present
      if (validated.vin && validated.vin.trim()) {
        const existingVin = db.prepare('SELECT id FROM vehicles WHERE UPPER(vin) = ?').get(validated.vin.trim().toUpperCase());
        if (existingVin) {
          return { success: false, error: `A vehicle with VIN "${validated.vin}" already exists.` };
        }
      }

      let customerId = validated.customerId?.trim() || '';
      let customerName = validated.customerName?.trim() || '';
      let customerPhone = validated.customerPhone?.trim() || '';

      // If customerId was specified, verify it exists and do NOT duplicate
      if (customerId) {
        const customer = db.prepare('SELECT id, full_name, phone FROM customers WHERE id = ?').get(customerId) as {
          id: string;
          full_name: string;
          phone: string | null;
        } | undefined;

        if (!customer) {
          return { success: false, error: 'Selected customer was not found in database' };
        }
        customerName = customer.full_name;
        customerPhone = customer.phone || '';
      }

      const vehicleId = crypto.randomUUID();
      const now = new Date().toISOString();
      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      // Atomic execution: customer (if new) and vehicle created together
      executeTx(() => {
        if (!customerId) {
          customerId = crypto.randomUUID();
          const isPermanent = validated.isPermanentCustomer !== false ? 1 : 0;
          db.prepare(`
            INSERT INTO customers (id, full_name, phone, alt_phone, email, address, notes, is_active, is_permanent, created_at, updated_at)
            VALUES (?, ?, ?, NULL, NULL, NULL, NULL, 1, ?, datetime('now'), datetime('now'))
          `).run(
            customerId,
            customerName,
            customerPhone || null,
            isPermanent
          );
        }

        db.prepare(`
          INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, vin, odometer, color, notes, is_permanent, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(
          vehicleId,
          customerId,
          validated.plateNumber,
          validated.make,
          validated.model,
          validated.year,
          validated.vin || null,
          validated.odometer,
          validated.color || null,
          validated.notes || null,
          validated.isPermanent !== false ? 1 : 0,
          validated.isActive !== false ? 1 : 0
        );
      });

      return {
        success: true,
        data: {
          id: vehicleId,
          customerId,
          customerName,
          customerPhone: customerPhone || undefined,
          plateNumber: validated.plateNumber,
          make: validated.make,
          model: validated.model,
          year: validated.year,
          vin: validated.vin || undefined,
          odometer: validated.odometer,
          color: validated.color || undefined,
          notes: validated.notes || undefined,
          isActive: validated.isActive !== false,
          isPermanent: validated.isPermanent !== false,
          createdAt: now,
          updatedAt: now,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Vehicle creation failed' };
    }
  });

  ipcMain.handle('vehicles:update', async (_event, payload: unknown): Promise<IpcResult<VehicleDTO>> => {
    try {
      const { id, input } = VehicleUpdateSchema.parse(payload);
      const db = getDatabase();

      const existing = db.prepare(`
        SELECT v.*, c.full_name as customer_name, c.phone as customer_phone
        FROM vehicles v
        LEFT JOIN customers c ON c.id = v.customer_id
        WHERE v.id = ?
      `).get(id) as {
        id: string;
        customer_id: string;
        plate_number: string;
        make: string;
        model: string;
        year: number;
        vin: string | null;
        odometer: number;
        color: string | null;
        notes: string | null;
        is_active: number;
        created_at: string;
        updated_at: string;
        customer_name: string | null;
        customer_phone: string | null;
      } | undefined;

      if (!existing) {
        return { success: false, error: 'Vehicle not found' };
      }

      const updatedPlate = input.plateNumber ? normalizePlateNumber(input.plateNumber) : existing.plate_number;
      if (updatedPlate !== existing.plate_number) {
        const plateConflict = db.prepare('SELECT id FROM vehicles WHERE plate_number = ? AND id != ?').get(updatedPlate, id);
        if (plateConflict) {
          return { success: false, error: `A vehicle with plate number "${updatedPlate}" already exists.` };
        }
      }

      const updatedVin = input.vin !== undefined ? (input.vin?.trim() || null) : existing.vin;
      if (updatedVin && updatedVin.toUpperCase() !== (existing.vin?.toUpperCase() || '')) {
        const vinConflict = db.prepare('SELECT id FROM vehicles WHERE UPPER(vin) = ? AND id != ?').get(updatedVin.toUpperCase(), id);
        if (vinConflict) {
          return { success: false, error: `A vehicle with VIN "${updatedVin}" already exists.` };
        }
      }

      const updatedCustomerId = input.customerId ?? existing.customer_id;
      const updatedMake = input.make ?? existing.make;
      const updatedModel = input.model ?? existing.model;
      const updatedYear = input.year ?? existing.year;
      const updatedOdometer = input.odometer ?? existing.odometer;
      const updatedColor = input.color !== undefined ? (input.color || null) : existing.color;
      const updatedNotes = input.notes !== undefined ? (input.notes || null) : existing.notes;
      const updatedActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE vehicles SET
          customer_id = ?,
          plate_number = ?,
          make = ?,
          model = ?,
          year = ?,
          vin = ?,
          odometer = ?,
          color = ?,
          notes = ?,
          is_active = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        updatedCustomerId,
        updatedPlate,
        updatedMake,
        updatedModel,
        updatedYear,
        updatedVin,
        updatedOdometer,
        updatedColor,
        updatedNotes,
        updatedActive,
        id
      );

      // Fetch customer name for updated customer ID
      const customer = db.prepare('SELECT full_name, phone FROM customers WHERE id = ?').get(updatedCustomerId) as {
        full_name: string;
        phone: string;
      } | undefined;

      return {
        success: true,
        data: {
          id,
          customerId: updatedCustomerId,
          customerName: customer?.full_name || existing.customer_name || undefined,
          customerPhone: customer?.phone || existing.customer_phone || undefined,
          plateNumber: updatedPlate,
          make: updatedMake,
          model: updatedModel,
          year: updatedYear,
          vin: updatedVin || undefined,
          odometer: updatedOdometer,
          color: updatedColor || undefined,
          notes: updatedNotes || undefined,
          isActive: updatedActive === 1,
          createdAt: existing.created_at,
          updatedAt: now,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Vehicle update failed' };
    }
  });

  ipcMain.handle('vehicles:archive', async (_event, idParam: unknown): Promise<IpcResult<void>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      db.prepare("UPDATE vehicles SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to archive vehicle' };
    }
  });

  ipcMain.handle('vehicles:restore', async (_event, idParam: unknown): Promise<IpcResult<void>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      db.prepare("UPDATE vehicles SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to restore vehicle' };
    }
  });

  ipcMain.handle('vehicles:delete', async (_event, idParam: unknown): Promise<IpcResult<void>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      const roCheck = db.prepare('SELECT count(*) as count FROM repair_orders WHERE vehicle_id = ?').get(id) as { count: number };

      if (roCheck.count > 0) {
        return {
          success: false,
          error: 'Cannot delete vehicle with repair order history. Please archive the vehicle instead.',
          errorCode: 'VEHICLE_HAS_LINKED_RECORDS',
        };
      }

      db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete vehicle' };
    }
  });

  // Helper function to recalculate repair order financial totals atomically
  function recalculateROTotals(db: any, repairOrderId: string) {
    const partsRow = db.prepare(`
      SELECT COALESCE(SUM(total_price_baisa), 0) as parts_sum
      FROM repair_order_parts
      WHERE repair_order_id = ? AND status = 'ISSUED' AND is_approved = 1
    `).get(repairOrderId) as { parts_sum: number };

    const laborRow = db.prepare(`
      SELECT COALESCE(SUM(labor_charge_baisa), 0) as labor_sum
      FROM labor_tasks
      WHERE repair_order_id = ? AND is_approved = 1
    `).get(repairOrderId) as { labor_sum: number };

    const partsTotal = partsRow?.parts_sum || 0;
    const laborTotal = laborRow?.labor_sum || 0;
    const taxableBase = partsTotal + laborTotal;
    const taxAmount = Math.round((taxableBase * 5) / 100);
    const grandTotal = taxableBase + taxAmount;

    db.prepare(`
      UPDATE repair_orders SET
        parts_total_baisa = ?,
        labor_total_baisa = ?,
        tax_amount_baisa = ?,
        grand_total_baisa = ?,
        estimated_cost_baisa = ?
      WHERE id = ?
    `).run(partsTotal, laborTotal, taxAmount, grandTotal, grandTotal, repairOrderId);

    return { partsTotal, laborTotal, taxAmount, grandTotal };
  }

  // 5. Repair Orders Handlers
  ipcMain.handle('repairOrders:get', async (_event, statusFilter?: string): Promise<IpcResult<RepairOrderDTO[]>> => {
    try {
      const db = getDatabase();
      let query = `
        SELECT 
          ro.*,
          c.full_name as customer_name, c.phone as customer_phone,
          v.plate_number as vehicle_plate, v.make as vehicle_make, v.model as vehicle_model
        FROM repair_orders ro
        JOIN customers c ON c.id = ro.customer_id
        JOIN vehicles v ON v.id = ro.vehicle_id
      `;
      const params: unknown[] = [];
      if (statusFilter && statusFilter !== 'ALL') {
        query += ' WHERE ro.status = ?';
        params.push(statusFilter);
      }
      query += ' ORDER BY ro.created_at DESC';

      const rows = db.prepare(query).all(...params) as any[];

      const ros: RepairOrderDTO[] = rows.map((r) => ({
        id: r.id,
        roNumber: r.ro_number,
        customerId: r.customer_id,
        customerName: r.customer_name,
        customerPhone: r.customer_phone || undefined,
        vehicleId: r.vehicle_id,
        vehiclePlate: r.vehicle_plate,
        vehicleMake: r.vehicle_make,
        vehicleModel: r.vehicle_model,
        status: r.status,
        odometerIn: r.odometer_in,
        reportedProblem: r.reported_problem,
        inspectionNotes: r.inspection_notes || undefined,
        requestedWork: r.requested_work || undefined,
        estimatedCostBaisa: r.estimated_cost_baisa || 0,
        partsTotalBaisa: r.parts_total_baisa || 0,
        laborTotalBaisa: r.labor_total_baisa || 0,
        taxAmountBaisa: r.tax_amount_baisa || 0,
        grandTotalBaisa: r.grand_total_baisa || r.estimated_cost_baisa || 0,
        customerApproved: Boolean(r.customer_approved),
        approvalStatus: r.approval_status || (r.customer_approved ? 'APPROVED' : 'PENDING'),
        approvedAt: r.approved_at || undefined,
        approvalNotes: r.approval_notes || undefined,
        assignedTechnicianId: r.assigned_technician_id || undefined,
        assignedTechnicianName: r.assigned_technician_name || undefined,
        warrantyPeriodMonths: r.warranty_period_months || 0,
        warrantyTerms: r.warranty_terms || undefined,
        receivedAt: r.received_at,
        expectedAt: r.expected_at || undefined,
        completedAt: r.completed_at || undefined,
        deliveredAt: r.delivered_at || undefined,
        createdAt: r.created_at,
      }));

      return { success: true, data: ros };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to query repair orders' };
    }
  });

  ipcMain.handle('repairOrders:getById', async (_event, idParam: unknown): Promise<IpcResult<RepairOrderDTO | null>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      const r = db.prepare(`
        SELECT 
          ro.*,
          c.full_name as customer_name, c.phone as customer_phone,
          v.plate_number as vehicle_plate, v.make as vehicle_make, v.model as vehicle_model
        FROM repair_orders ro
        JOIN customers c ON c.id = ro.customer_id
        JOIN vehicles v ON v.id = ro.vehicle_id
        WHERE ro.id = ?
      `).get(id) as any;

      if (!r) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          id: r.id,
          roNumber: r.ro_number,
          customerId: r.customer_id,
          customerName: r.customer_name,
          customerPhone: r.customer_phone || undefined,
          vehicleId: r.vehicle_id,
          vehiclePlate: r.vehicle_plate,
          vehicleMake: r.vehicle_make,
          vehicleModel: r.vehicle_model,
          status: r.status,
          odometerIn: r.odometer_in,
          reportedProblem: r.reported_problem,
          inspectionNotes: r.inspection_notes || undefined,
          requestedWork: r.requested_work || undefined,
          estimatedCostBaisa: r.estimated_cost_baisa || 0,
          partsTotalBaisa: r.parts_total_baisa || 0,
          laborTotalBaisa: r.labor_total_baisa || 0,
          taxAmountBaisa: r.tax_amount_baisa || 0,
          grandTotalBaisa: r.grand_total_baisa || r.estimated_cost_baisa || 0,
          customerApproved: Boolean(r.customer_approved),
          approvalStatus: r.approval_status || (r.customer_approved ? 'APPROVED' : 'PENDING'),
          approvedAt: r.approved_at || undefined,
          approvalNotes: r.approval_notes || undefined,
          assignedTechnicianId: r.assigned_technician_id || undefined,
          assignedTechnicianName: r.assigned_technician_name || undefined,
          warrantyPeriodMonths: r.warranty_period_months || 0,
          warrantyTerms: r.warranty_terms || undefined,
          receivedAt: r.received_at,
          expectedAt: r.expected_at || undefined,
          completedAt: r.completed_at || undefined,
          deliveredAt: r.delivered_at || undefined,
          createdAt: r.created_at,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get repair order by ID' };
    }
  });

  ipcMain.handle('repairOrders:create', async (_event, payload: unknown): Promise<IpcResult<RepairOrderDTO>> => {
    try {
      const validated = RepairOrderInputSchema.parse(payload);
      const db = getDatabase();

      // Verify customer exists
      const customer = db.prepare('SELECT id, full_name, phone FROM customers WHERE id = ?').get(validated.customerId) as any;
      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      // Verify vehicle exists and belongs to customer
      const vehicle = db.prepare('SELECT id, customer_id, plate_number, make, model, odometer FROM vehicles WHERE id = ?').get(validated.vehicleId) as any;
      if (!vehicle) {
        return { success: false, error: 'Vehicle not found' };
      }
      if (vehicle.customer_id !== validated.customerId) {
        return { success: false, error: 'Vehicle does not belong to the selected customer' };
      }

      const id = crypto.randomUUID();
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const countRow = db.prepare("SELECT count(*) as count FROM repair_orders WHERE ro_number LIKE ?").get(`RO-${yearMonth}-%`) as { count: number };
      const roNumber = `RO-${yearMonth}-${String(countRow.count + 1).padStart(4, '0')}`;
      const nowIso = now.toISOString();

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        db.prepare(`
          INSERT INTO repair_orders (
            id, ro_number, customer_id, vehicle_id, status, odometer_in,
            reported_problem, inspection_notes, requested_work, estimated_cost_baisa,
            parts_total_baisa, labor_total_baisa, tax_amount_baisa, grand_total_baisa,
            customer_approved, approval_status, assigned_technician_id, assigned_technician_name,
            received_at, expected_at, created_at
          ) VALUES (?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, ?, 0, 0, 0, ?, 0, 'PENDING', ?, ?, datetime('now'), ?, datetime('now'))
        `).run(
          id,
          roNumber,
          validated.customerId,
          validated.vehicleId,
          validated.odometerIn,
          validated.reportedProblem,
          validated.inspectionNotes || null,
          validated.requestedWork || null,
          validated.estimatedCostBaisa || 0,
          validated.estimatedCostBaisa || 0,
          validated.assignedTechnicianId || null,
          validated.assignedTechnicianName || null,
          validated.expectedAt || null
        );

        // Update vehicle odometer if higher
        if (validated.odometerIn > vehicle.odometer) {
          db.prepare("UPDATE vehicles SET odometer = ?, updated_at = datetime('now') WHERE id = ?").run(validated.odometerIn, vehicle.id);
        }

        // Record initial status in history
        db.prepare(`
          INSERT INTO repair_order_status_history (id, repair_order_id, old_status, new_status, changed_by, remarks, changed_at)
          VALUES (?, ?, 'NONE', 'RECEIVED', 'Operator', 'Repair order intake registered', datetime('now'))
        `).run(crypto.randomUUID(), id);
      });

      return {
        success: true,
        data: {
          id,
          roNumber,
          customerId: validated.customerId,
          customerName: customer.full_name,
          customerPhone: customer.phone || undefined,
          vehicleId: validated.vehicleId,
          vehiclePlate: vehicle.plate_number,
          vehicleMake: vehicle.make,
          vehicleModel: vehicle.model,
          status: 'RECEIVED',
          odometerIn: validated.odometerIn,
          reportedProblem: validated.reportedProblem,
          inspectionNotes: validated.inspectionNotes,
          requestedWork: validated.requestedWork,
          estimatedCostBaisa: validated.estimatedCostBaisa || 0,
          partsTotalBaisa: 0,
          laborTotalBaisa: 0,
          taxAmountBaisa: 0,
          grandTotalBaisa: validated.estimatedCostBaisa || 0,
          customerApproved: false,
          approvalStatus: 'PENDING',
          assignedTechnicianId: validated.assignedTechnicianId,
          assignedTechnicianName: validated.assignedTechnicianName,
          receivedAt: nowIso,
          expectedAt: validated.expectedAt,
          createdAt: nowIso,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'RO creation failed' };
    }
  });

  ipcMain.handle('repairOrders:updateStatus', async (_event, payload: unknown): Promise<IpcResult<void>> => {
    try {
      const { repairOrderId, newStatus, remarks, changedBy } = StatusChangeInputSchema.parse(payload);
      const db = getDatabase();

      const current = db.prepare('SELECT id, status, customer_approved FROM repair_orders WHERE id = ?').get(repairOrderId) as { id: string; status: string; customer_approved: number } | undefined;
      if (!current) {
        return { success: false, error: 'Repair order not found' };
      }

      // Prevent redundant status updates
      if (current.status === newStatus) {
        return { success: true };
      }

      // Validate transitions
      if (current.status === 'COMPLETED' && newStatus !== 'COMPLETED') {
        return { success: false, error: 'Cannot modify the status of a completed and finalized repair order.' };
      }

      if (current.status === 'CANCELLED' && newStatus !== 'RECEIVED') {
        return { success: false, error: 'Cancelled repair orders cannot be transitioned without reopening to RECEIVED first.' };
      }

      // If cancelling, verify there are NO active unreturned issued parts
      if (newStatus === 'CANCELLED') {
        const activeParts = db.prepare("SELECT count(*) as count FROM repair_order_parts WHERE repair_order_id = ? AND status = 'ISSUED'").get(repairOrderId) as { count: number };
        if (activeParts.count > 0) {
          return {
            success: false,
            error: `Cannot cancel repair order with ${activeParts.count} active issued part(s). All issued parts must be returned or reversed to inventory before cancellation.`,
          };
        }
      }

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        let completionClause = '';
        if (newStatus === 'COMPLETED') completionClause = ", completed_at = datetime('now')";
        if (newStatus === 'READY_FOR_DELIVERY') completionClause = ", delivered_at = datetime('now')";

        db.prepare(`UPDATE repair_orders SET status = ? ${completionClause} WHERE id = ?`).run(newStatus, repairOrderId);

        db.prepare(`
          INSERT INTO repair_order_status_history (id, repair_order_id, old_status, new_status, changed_by, remarks, changed_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(crypto.randomUUID(), repairOrderId, current.status, newStatus, changedBy, remarks || null);
      });

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Status update failed' };
    }
  });

  // Labor Tasks Handlers
  ipcMain.handle('repairOrders:getLaborTasks', async (_event, roIdParam: unknown): Promise<IpcResult<LaborTaskDTO[]>> => {
    try {
      const roId = IdParamSchema.parse(roIdParam);
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT lt.*, t.name as tech_name
        FROM labor_tasks lt
        LEFT JOIN technicians t ON t.id = lt.technician_id
        WHERE lt.repair_order_id = ?
        ORDER BY lt.work_date ASC, lt.rowid ASC
      `).all(roId) as any[];

      const tasks: LaborTaskDTO[] = rows.map((r) => ({
        id: r.id,
        repairOrderId: r.repair_order_id,
        technicianId: r.technician_id || undefined,
        technicianName: r.technician_name || r.tech_name || undefined,
        description: r.description,
        laborChargeBaisa: r.labor_charge_baisa,
        internalCostBaisa: r.internal_cost_baisa || 0,
        status: r.status,
        isApproved: r.is_approved !== 0,
        hours: r.hours || 1,
        hourlyRateBaisa: r.hourly_rate_baisa || 0,
        workDate: r.work_date,
        notes: r.notes || undefined,
      }));

      return { success: true, data: tasks };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to query labor tasks' };
    }
  });

  ipcMain.handle('repairOrders:addLaborTask', async (_event, payload: unknown): Promise<IpcResult<LaborTaskDTO>> => {
    try {
      const validated = LaborTaskInputSchema.parse(payload);
      const db = getDatabase();

      const ro = db.prepare('SELECT id, status FROM repair_orders WHERE id = ?').get(validated.repairOrderId) as any;
      if (!ro) return { success: false, error: 'Repair order not found' };
      if (ro.status === 'COMPLETED' || ro.status === 'CANCELLED') {
        return { success: false, error: `Cannot add labor tasks to a ${ro.status.toLowerCase()} repair order.` };
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        db.prepare(`
          INSERT INTO labor_tasks (
            id, repair_order_id, technician_id, technician_name, description,
            hours, hourly_rate_baisa, labor_charge_baisa, internal_cost_baisa,
            is_approved, status, notes, work_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          id,
          validated.repairOrderId,
          validated.technicianId || null,
          validated.technicianName || null,
          validated.description,
          validated.hours || 1.0,
          validated.hourlyRateBaisa || 0,
          validated.laborChargeBaisa,
          validated.internalCostBaisa || 0,
          validated.isApproved !== false ? 1 : 0,
          validated.status || 'PENDING',
          validated.notes || null
        );

        recalculateROTotals(db, validated.repairOrderId);
      });

      return {
        success: true,
        data: {
          id,
          repairOrderId: validated.repairOrderId,
          technicianId: validated.technicianId,
          technicianName: validated.technicianName,
          description: validated.description,
          hours: validated.hours || 1.0,
          hourlyRateBaisa: validated.hourlyRateBaisa || 0,
          laborChargeBaisa: validated.laborChargeBaisa,
          internalCostBaisa: validated.internalCostBaisa || 0,
          isApproved: validated.isApproved !== false,
          status: validated.status || 'PENDING',
          workDate: now,
          notes: validated.notes,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to add labor task' };
    }
  });

  ipcMain.handle('repairOrders:updateLaborTask', async (_event, payload: unknown): Promise<IpcResult<LaborTaskDTO>> => {
    try {
      const { id, input } = payload as { id: string; input: any };
      const db = getDatabase();
      const existing = db.prepare('SELECT * FROM labor_tasks WHERE id = ?').get(id) as any;
      if (!existing) return { success: false, error: 'Labor task not found' };

      const updatedDesc = input.description ?? existing.description;
      const updatedHours = input.hours !== undefined ? input.hours : existing.hours;
      const updatedHourlyRate = input.hourlyRateBaisa !== undefined ? input.hourlyRateBaisa : existing.hourly_rate_baisa;
      const updatedCharge = input.laborChargeBaisa !== undefined ? input.laborChargeBaisa : existing.labor_charge_baisa;
      const updatedApproved = input.isApproved !== undefined ? (input.isApproved ? 1 : 0) : existing.is_approved;
      const updatedStatus = input.status ?? existing.status;
      const updatedTechId = input.technicianId !== undefined ? (input.technicianId || null) : existing.technician_id;
      const updatedTechName = input.technicianName !== undefined ? (input.technicianName || null) : existing.technician_name;
      const updatedNotes = input.notes !== undefined ? (input.notes || null) : existing.notes;

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        db.prepare(`
          UPDATE labor_tasks SET
            description = ?, hours = ?, hourly_rate_baisa = ?, labor_charge_baisa = ?,
            is_approved = ?, status = ?, technician_id = ?, technician_name = ?, notes = ?
          WHERE id = ?
        `).run(updatedDesc, updatedHours, updatedHourlyRate, updatedCharge, updatedApproved, updatedStatus, updatedTechId, updatedTechName, updatedNotes, id);

        recalculateROTotals(db, existing.repair_order_id);
      });

      return {
        success: true,
        data: {
          id,
          repairOrderId: existing.repair_order_id,
          technicianId: updatedTechId || undefined,
          technicianName: updatedTechName || undefined,
          description: updatedDesc,
          hours: updatedHours,
          hourlyRateBaisa: updatedHourlyRate,
          laborChargeBaisa: updatedCharge,
          internalCostBaisa: existing.internal_cost_baisa || 0,
          isApproved: updatedApproved === 1,
          status: updatedStatus,
          workDate: existing.work_date,
          notes: updatedNotes || undefined,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update labor task' };
    }
  });

  ipcMain.handle('repairOrders:deleteLaborTask', async (_event, idParam: unknown): Promise<IpcResult<void>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      const existing = db.prepare('SELECT repair_order_id FROM labor_tasks WHERE id = ?').get(id) as { repair_order_id: string } | undefined;
      if (!existing) return { success: false, error: 'Labor task not found' };

      const ro = db.prepare('SELECT status FROM repair_orders WHERE id = ?').get(existing.repair_order_id) as any;
      if (ro && (ro.status === 'COMPLETED' || ro.status === 'CANCELLED')) {
        return { success: false, error: `Cannot delete labor tasks from a ${ro.status.toLowerCase()} repair order.` };
      }

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        db.prepare('DELETE FROM labor_tasks WHERE id = ?').run(id);
        recalculateROTotals(db, existing.repair_order_id);
      });

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete labor task' };
    }
  });

  // Repair Order Parts (Integrated Inventory Consumption) Handlers
  ipcMain.handle('repairOrders:getParts', async (_event, roIdParam: unknown): Promise<IpcResult<RepairOrderPartDTO[]>> => {
    try {
      const roId = IdParamSchema.parse(roIdParam);
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT * FROM repair_order_parts
        WHERE repair_order_id = ?
        ORDER BY issued_at ASC
      `).all(roId) as any[];

      const parts: RepairOrderPartDTO[] = rows.map((r) => ({
        id: r.id,
        repairOrderId: r.repair_order_id,
        itemId: r.item_id,
        partCode: r.part_code,
        partName: r.part_name,
        serialNumber: r.serial_number || undefined,
        quantity: r.quantity,
        unit: r.unit || 'قطعة',
        unitPriceBaisa: r.unit_price_baisa,
        unitCostBaisa: r.unit_cost_baisa,
        totalPriceBaisa: r.total_price_baisa,
        isApproved: Boolean(r.is_approved),
        status: r.status,
        issuedAt: r.issued_at,
        returnedAt: r.returned_at || undefined,
        returnReason: r.return_reason || undefined,
      }));

      return { success: true, data: parts };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get RO parts' };
    }
  });

  ipcMain.handle('repairOrders:issuePart', async (_event, payload: unknown): Promise<IpcResult<RepairOrderPartDTO>> => {
    try {
      const input = IssuePartInputSchema.parse(payload);
      const db = getDatabase();

      const ro = db.prepare('SELECT id, status, customer_id, vehicle_id FROM repair_orders WHERE id = ?').get(input.repairOrderId) as any;
      if (!ro) return { success: false, error: 'Repair order not found' };
      if (ro.status === 'COMPLETED' || ro.status === 'CANCELLED') {
        return { success: false, error: `Cannot issue parts to a ${ro.status.toLowerCase()} repair order.` };
      }

      // Idempotency check: if an idempotency key was supplied and was already processed, return existing part without re-deducting
      if (input.idempotencyKey) {
        const existingPart = db.prepare('SELECT * FROM repair_order_parts WHERE idempotency_key = ?').get(input.idempotencyKey) as any;
        if (existingPart) {
          return {
            success: true,
            data: {
              id: existingPart.id,
              repairOrderId: existingPart.repair_order_id,
              itemId: existingPart.item_id,
              partCode: existingPart.part_code,
              partName: existingPart.part_name,
              serialNumber: existingPart.serial_number || undefined,
              quantity: existingPart.quantity,
              unit: existingPart.unit || 'قطعة',
              unitPriceBaisa: existingPart.unit_price_baisa,
              unitCostBaisa: existingPart.unit_cost_baisa,
              totalPriceBaisa: existingPart.total_price_baisa,
              isApproved: Boolean(existingPart.is_approved),
              status: existingPart.status,
              issuedAt: existingPart.issued_at,
              idempotencyKey: existingPart.idempotency_key || undefined,
            },
          };
        }
      }

      const item = db.prepare(`
        SELECT id, part_code, name, COALESCE(unit, 'قطعة') as unit, selling_price_baisa, purchase_cost_baisa, quantity_in_stock, is_serialized
        FROM inventory_items WHERE id = ?
      `).get(input.itemId) as any;

      if (!item) return { success: false, error: 'Inventory part item not found' };

      const unitPrice = input.unitPriceBaisa !== undefined ? input.unitPriceBaisa : item.selling_price_baisa;
      const unitCost = item.purchase_cost_baisa;
      const isSerialized = Boolean(item.is_serialized);
      const partId = crypto.randomUUID();
      const now = new Date().toISOString();

      let serialToIssue: string | null = null;

      if (isSerialized) {
        if (!input.serialNumber || !input.serialNumber.trim()) {
          return { success: false, error: 'Serial number is required for serialized part' };
        }
        serialToIssue = input.serialNumber.trim();

        const serialRow = db.prepare("SELECT id, status FROM inventory_serials WHERE serial_number = ? AND item_id = ?").get(serialToIssue, item.id) as any;
        if (!serialRow || serialRow.status !== 'IN_STOCK') {
          return { success: false, error: `Serial number "${serialToIssue}" is not available in stock.` };
        }

        // Check if serial is already issued to any active repair order
        const roSerialCheck = db.prepare("SELECT repair_order_id FROM repair_order_parts WHERE serial_number = ? AND status = 'ISSUED'").get(serialToIssue) as any;
        if (roSerialCheck) {
          return { success: false, error: `Serial number "${serialToIssue}" is already assigned to repair order.` };
        }
      } else {
        if (item.quantity_in_stock < input.quantity) {
          return {
            success: false,
            error: `Insufficient stock for "${item.name}". Available: ${item.quantity_in_stock}, requested: ${input.quantity}`,
          };
        }
      }

      const qty = isSerialized ? 1 : input.quantity;
      const totalPrice = Math.round(unitPrice * qty);

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        // 1. Deduct physical stock with atomic quantity check
        const stockUpdate = db.prepare('UPDATE inventory_items SET quantity_in_stock = quantity_in_stock - ? WHERE id = ? AND quantity_in_stock >= ?').run(qty, item.id, qty);
        if (stockUpdate.changes === 0) {
          throw new Error(`Insufficient stock for "${item.name}". Available quantity is less than ${qty}.`);
        }

        // 2. If serialized, mark serial as ISSUED atomically
        if (serialToIssue) {
          const serialUpdate = db.prepare("UPDATE inventory_serials SET status = 'ISSUED', repair_order_id = ?, issued_at = datetime('now'), updated_at = datetime('now') WHERE serial_number = ? AND item_id = ? AND status = 'IN_STOCK'").run(input.repairOrderId, serialToIssue, item.id);
          if (serialUpdate.changes === 0) {
            throw new Error(`Serial number "${serialToIssue}" is no longer available in stock.`);
          }
        }

        // 3. Insert into repair_order_parts with idempotency_key
        db.prepare(`
          INSERT INTO repair_order_parts (
            id, repair_order_id, item_id, part_code, part_name, serial_number,
            quantity, unit, unit_price_baisa, unit_cost_baisa, total_price_baisa,
            is_approved, status, issued_at, idempotency_key
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED', datetime('now'), ?)
        `).run(
          partId,
          input.repairOrderId,
          item.id,
          item.part_code,
          item.name,
          serialToIssue,
          qty,
          input.unit || item.unit || 'قطعة',
          unitPrice,
          unitCost,
          totalPrice,
          input.isApproved !== false ? 1 : 0,
          input.idempotencyKey || null
        );

        // 4. Record audit in inventory movement ledger
        db.prepare(`
          INSERT INTO inventory_movements (
            id, item_id, movement_type, quantity_delta, unit_cost_baisa,
            serial_number, reference_type, reference_id, reason, created_by, created_at
          ) VALUES (?, ?, 'RO_ISSUE', ?, ?, ?, 'REPAIR_ORDER', ?, ?, 'Operator', datetime('now'))
        `).run(
          crypto.randomUUID(),
          item.id,
          -qty,
          unitCost,
          serialToIssue,
          input.repairOrderId,
          input.notes || `Issued to RO ${ro.status}`
        );

        // 5. Atomically recalculate RO estimate
        recalculateROTotals(db, input.repairOrderId);
      });

      return {
        success: true,
        data: {
          id: partId,
          repairOrderId: input.repairOrderId,
          itemId: item.id,
          partCode: item.part_code,
          partName: item.name,
          serialNumber: serialToIssue || undefined,
          quantity: qty,
          unit: input.unit || item.unit || 'قطعة',
          unitPriceBaisa: unitPrice,
          unitCostBaisa: unitCost,
          totalPriceBaisa: totalPrice,
          isApproved: input.isApproved !== false,
          status: 'ISSUED',
          issuedAt: now,
          idempotencyKey: input.idempotencyKey || undefined,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to issue part to repair order' };
    }
  });

  ipcMain.handle('repairOrders:returnPart', async (_event, payload: unknown): Promise<IpcResult<void>> => {
    try {
      const input = ReturnPartInputSchema.parse(payload);
      const db = getDatabase();

      const ro = db.prepare('SELECT status FROM repair_orders WHERE id = ?').get(input.repairOrderId) as any;
      if (ro && (ro.status === 'COMPLETED' || ro.status === 'CANCELLED')) {
        return { success: false, error: `Cannot return parts from a ${ro.status.toLowerCase()} repair order.` };
      }

      const partRow = db.prepare('SELECT * FROM repair_order_parts WHERE id = ? AND repair_order_id = ?').get(input.roPartId, input.repairOrderId) as any;
      if (!partRow) return { success: false, error: 'RO part record not found' };
      if (partRow.status === 'RETURNED') return { success: false, error: 'Part has already been returned' };

      const isDefective = Boolean(input.isDefective) || Boolean(input.reason && /(defective|damaged|معيب|تالف|خربان|عطلان)/i.test(input.reason));

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        // 1. Mark part as RETURNED atomically ensuring it is only returned once
        const updatePartRes = db.prepare("UPDATE repair_order_parts SET status = 'RETURNED', returned_at = datetime('now'), return_reason = ? WHERE id = ? AND status = 'ISSUED'").run(input.reason || (isDefective ? 'Defective return' : 'Returned to stock'), input.roPartId);
        if (updatePartRes.changes === 0) {
          throw new Error('Part has already been returned or cannot be returned.');
        }

        if (isDefective) {
          // If defective, mark serial as DAMAGED so it CANNOT be silently reissued
          if (partRow.serial_number) {
            db.prepare("UPDATE inventory_serials SET status = 'DAMAGED', repair_order_id = NULL, notes = coalesce(notes || ' | ', '') || 'Returned as defective', updated_at = datetime('now') WHERE serial_number = ? AND item_id = ?").run(partRow.serial_number, partRow.item_id);
          }
          // Do not increment saleable quantity_in_stock for defective returns; record movement
          db.prepare(`
            INSERT INTO inventory_movements (
              id, item_id, movement_type, quantity_delta, unit_cost_baisa,
              serial_number, reference_type, reference_id, reason, created_by, created_at
            ) VALUES (?, ?, 'RETURN_TO_STOCK', 0, ?, ?, 'REPAIR_ORDER', ?, ?, 'Operator', datetime('now'))
          `).run(
            crypto.randomUUID(),
            partRow.item_id,
            partRow.unit_cost_baisa,
            partRow.serial_number,
            input.repairOrderId,
            input.reason || 'Defective part returned - excluded from saleable stock'
          );
        } else {
          // Normal restock: restore saleable stock
          db.prepare('UPDATE inventory_items SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?').run(partRow.quantity, partRow.item_id);

          // Restore serial to IN_STOCK
          if (partRow.serial_number) {
            db.prepare("UPDATE inventory_serials SET status = 'IN_STOCK', repair_order_id = NULL, updated_at = datetime('now') WHERE serial_number = ? AND item_id = ?").run(partRow.serial_number, partRow.item_id);
          }

          // Record RETURN_TO_STOCK in movement ledger
          db.prepare(`
            INSERT INTO inventory_movements (
              id, item_id, movement_type, quantity_delta, unit_cost_baisa,
              serial_number, reference_type, reference_id, reason, created_by, created_at
            ) VALUES (?, ?, 'RETURN_TO_STOCK', ?, ?, ?, 'REPAIR_ORDER', ?, ?, 'Operator', datetime('now'))
          `).run(
            crypto.randomUUID(),
            partRow.item_id,
            partRow.quantity,
            partRow.unit_cost_baisa,
            partRow.serial_number,
            input.repairOrderId,
            input.reason || 'Returned to stock'
          );
        }

        // Atomically recalculate RO estimate
        recalculateROTotals(db, input.repairOrderId);
      });

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to return part' };
    }
  });

  ipcMain.handle('repairOrders:recordApproval', async (_event, payload: unknown): Promise<IpcResult<RepairOrderDTO>> => {
    try {
      const input = CustomerApprovalSchema.parse(payload);
      const db = getDatabase();

      const ro = db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(input.repairOrderId) as any;
      if (!ro) return { success: false, error: 'Repair order not found' };

      const newApprovalStatus = input.approved ? 'APPROVED' : 'REJECTED';
      let nextRoStatus = ro.status;
      if (input.approved && ro.status === 'AWAITING_APPROVAL') {
        nextRoStatus = 'APPROVED';
      }

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        db.prepare(`
          UPDATE repair_orders SET
            customer_approved = ?,
            approval_status = ?,
            approved_at = datetime('now'),
            approval_notes = ?,
            status = ?
          WHERE id = ?
        `).run(input.approved ? 1 : 0, newApprovalStatus, input.notes || null, nextRoStatus, ro.id);

        if (nextRoStatus !== ro.status) {
          db.prepare(`
            INSERT INTO repair_order_status_history (id, repair_order_id, old_status, new_status, changed_by, remarks, changed_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(crypto.randomUUID(), ro.id, ro.status, nextRoStatus, input.approvedBy || 'Customer', `Estimate ${newApprovalStatus}: ${input.notes || ''}`);
        }
      });

      // Fetch updated
      const updated = db.prepare(`
        SELECT ro.*, c.full_name as customer_name, c.phone as customer_phone,
               v.plate_number as vehicle_plate, v.make as vehicle_make, v.model as vehicle_model
        FROM repair_orders ro
        JOIN customers c ON c.id = ro.customer_id
        JOIN vehicles v ON v.id = ro.vehicle_id
        WHERE ro.id = ?
      `).get(ro.id) as any;

      return {
        success: true,
        data: {
          id: updated.id,
          roNumber: updated.ro_number,
          customerId: updated.customer_id,
          customerName: updated.customer_name,
          customerPhone: updated.customer_phone || undefined,
          vehicleId: updated.vehicle_id,
          vehiclePlate: updated.vehicle_plate,
          vehicleMake: updated.vehicle_make,
          vehicleModel: updated.vehicle_model,
          status: updated.status,
          odometerIn: updated.odometer_in,
          reportedProblem: updated.reported_problem,
          inspectionNotes: updated.inspection_notes || undefined,
          requestedWork: updated.requested_work || undefined,
          estimatedCostBaisa: updated.estimated_cost_baisa || 0,
          partsTotalBaisa: updated.parts_total_baisa || 0,
          laborTotalBaisa: updated.labor_total_baisa || 0,
          taxAmountBaisa: updated.tax_amount_baisa || 0,
          grandTotalBaisa: updated.grand_total_baisa || 0,
          customerApproved: Boolean(updated.customer_approved),
          approvalStatus: updated.approval_status,
          approvedAt: updated.approved_at || undefined,
          approvalNotes: updated.approval_notes || undefined,
          assignedTechnicianId: updated.assigned_technician_id || undefined,
          assignedTechnicianName: updated.assigned_technician_name || undefined,
          receivedAt: updated.received_at,
          expectedAt: updated.expected_at || undefined,
          completedAt: updated.completed_at || undefined,
          deliveredAt: updated.delivered_at || undefined,
          createdAt: updated.created_at,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to record approval' };
    }
  });

  ipcMain.handle('repairOrders:getStatusHistory', async (_event, roIdParam: unknown): Promise<IpcResult<RepairOrderStatusHistoryDTO[]>> => {
    try {
      const roId = IdParamSchema.parse(roIdParam);
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT * FROM repair_order_status_history
        WHERE repair_order_id = ?
        ORDER BY changed_at ASC
      `).all(roId) as any[];

      const history: RepairOrderStatusHistoryDTO[] = rows.map((r) => ({
        id: r.id,
        repairOrderId: r.repair_order_id,
        oldStatus: r.old_status,
        newStatus: r.new_status,
        changedBy: r.changed_by,
        remarks: r.remarks || undefined,
        changedAt: r.changed_at,
      }));

      return { success: true, data: history };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get status history' };
    }
  });

  ipcMain.handle('repairOrders:createInvoice', async (_event, payload: unknown): Promise<IpcResult<InvoiceDTO>> => {
    try {
      const input = CreateInvoiceFromROSchema.parse(payload);
      const db = getDatabase();

      const ro = db.prepare(`
        SELECT ro.*, c.full_name as customer_name, c.phone as customer_phone, COALESCE(c.is_permanent, 1) as customer_is_permanent,
               v.plate_number as vehicle_plate
        FROM repair_orders ro
        JOIN customers c ON c.id = ro.customer_id
        LEFT JOIN vehicles v ON v.id = ro.vehicle_id
        WHERE ro.id = ?
      `).get(input.repairOrderId) as any;

      if (!ro) return { success: false, error: 'Repair order not found' };

      // Prevent duplicate invoices for the same repair order - return existing invoice if already created
      const existingInv = db.prepare('SELECT id FROM invoices WHERE repair_order_id = ?').get(ro.id) as any;
      if (existingInv) {
        const invRow = db.prepare(`
          SELECT 
            i.*,
            c.full_name as customer_name, c.phone as customer_phone, COALESCE(c.is_permanent, 1) as customer_is_permanent,
            v.plate_number as vehicle_plate
          FROM invoices i
          JOIN customers c ON c.id = i.customer_id
          LEFT JOIN vehicles v ON v.id = i.vehicle_id
          WHERE i.id = ?
        `).get(existingInv.id) as any;

        if (invRow) {
          const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invRow.id) as any[];
          return {
            success: true,
            data: {
              id: invRow.id,
              invoiceNumber: invRow.invoice_number,
              repairOrderId: invRow.repair_order_id || undefined,
              customerId: invRow.customer_id,
              customerName: invRow.customer_name,
              customerPhone: invRow.customer_phone || undefined,
              isCustomerPermanent: invRow.customer_is_permanent === 1,
              vehicleId: invRow.vehicle_id || undefined,
              vehiclePlate: invRow.vehicle_plate || undefined,
              invoiceDate: invRow.invoice_date,
              status: invRow.status,
              subtotalPartsBaisa: invRow.subtotal_parts_baisa,
              subtotalLaborBaisa: invRow.subtotal_labor_baisa,
              discountBaisa: invRow.discount_baisa,
              taxRatePercent: invRow.tax_rate_percent,
              taxAmountBaisa: invRow.tax_amount_baisa,
              grandTotalBaisa: invRow.grand_total_baisa,
              paidAmountBaisa: invRow.paid_amount_baisa,
              balanceDueBaisa: invRow.balance_due_baisa,
              invoiceLanguage: invRow.invoice_language,
              retentionPrompted: invRow.retention_prompted === 1,
              printedAt: invRow.printed_at || undefined,
              notes: invRow.notes || undefined,
              items: items.map((it) => ({
                id: it.id,
                invoiceId: it.invoice_id,
                itemType: it.item_type,
                sourceId: it.source_id,
                description: it.description,
                quantity: it.quantity,
                unit: it.unit || (it.item_type === 'LABOR' ? 'خدمة' : 'قطعة'),
                unitPriceBaisa: it.unit_price_baisa,
                costPriceBaisa: it.cost_price_baisa,
                lineTotalBaisa: it.line_total_baisa,
              })),
              createdAt: invRow.created_at,
            },
          };
        }
      }

      // Fetch approved issued parts and approved labor tasks
      const parts = db.prepare("SELECT * FROM repair_order_parts WHERE repair_order_id = ? AND status = 'ISSUED' AND is_approved = 1").all(ro.id) as any[];
      const tasks = db.prepare("SELECT * FROM labor_tasks WHERE repair_order_id = ? AND is_approved = 1").all(ro.id) as any[];

      const subtotalParts = parts.reduce((acc, p) => acc + (p.total_price_baisa || 0), 0);
      const subtotalLabor = tasks.reduce((acc, t) => acc + (t.labor_charge_baisa || 0), 0);
      const discount = input.discountBaisa || 0;
      const taxableBase = Math.max(0, subtotalParts + subtotalLabor - discount);
      const taxRate = 5.0;
      const taxAmount = Math.round((taxableBase * taxRate) / 100);
      const grandTotal = taxableBase + taxAmount;

      const invoiceId = crypto.randomUUID();
      const now = new Date();
      const invoiceDate = now.toISOString().slice(0, 10);
      const countRow = db.prepare("SELECT count(*) as count FROM invoices WHERE invoice_date = ?").get(invoiceDate) as { count: number };
      const invoiceNumber = `INV-${invoiceDate.replace(/-/g, '')}-${String(countRow.count + 1001).padStart(4, '0')}`;
      const nowIso = now.toISOString();

      const createdItems: InvoiceItemDTO[] = [];

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        // 1. Insert invoice
        db.prepare(`
          INSERT INTO invoices (
            id, invoice_number, repair_order_id, customer_id, vehicle_id,
            invoice_date, status, subtotal_parts_baisa, subtotal_labor_baisa,
            discount_baisa, tax_rate_percent, tax_amount_baisa, grand_total_baisa,
            paid_amount_baisa, balance_due_baisa, invoice_language, retention_prompted,
            notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'ISSUED', ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, datetime('now'))
        `).run(
          invoiceId,
          invoiceNumber,
          ro.id,
          ro.customer_id,
          ro.vehicle_id,
          invoiceDate,
          subtotalParts,
          subtotalLabor,
          discount,
          taxRate,
          taxAmount,
          grandTotal,
          grandTotal,
          input.invoiceLanguage || 'ar',
          input.notes || `Generated from ${ro.ro_number}`
        );

        // 2. Insert itemized invoice items to avoid double billing and maintain audit history
        for (const part of parts) {
          const itemId = crypto.randomUUID();
          const desc = part.serial_number ? `${part.part_name} (${part.serial_number})` : part.part_name;
          const unit = part.unit || 'قطعة';
          db.prepare(`
            INSERT INTO invoice_items (id, invoice_id, item_type, source_id, description, quantity, unit, unit_price_baisa, cost_price_baisa, line_total_baisa)
            VALUES (?, ?, 'PART', ?, ?, ?, ?, ?, ?, ?)
          `).run(
            itemId,
            invoiceId,
            part.id,
            desc,
            part.quantity,
            unit,
            part.unit_price_baisa,
            part.unit_cost_baisa,
            part.total_price_baisa
          );

          createdItems.push({
            id: itemId,
            invoiceId,
            itemType: 'PART',
            sourceId: part.id,
            description: desc,
            quantity: part.quantity,
            unit,
            unitPriceBaisa: part.unit_price_baisa,
            costPriceBaisa: part.unit_cost_baisa,
            lineTotalBaisa: part.total_price_baisa,
          });
        }

        for (const task of tasks) {
          const itemId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO invoice_items (id, invoice_id, item_type, source_id, description, quantity, unit, unit_price_baisa, cost_price_baisa, line_total_baisa)
            VALUES (?, ?, 'LABOR', ?, ?, ?, 'خدمة', ?, ?, ?)
          `).run(
            itemId,
            invoiceId,
            task.id,
            task.description,
            task.hours || 1,
            task.labor_charge_baisa,
            task.internal_cost_baisa || 0,
            task.labor_charge_baisa
          );

          createdItems.push({
            id: itemId,
            invoiceId,
            itemType: 'LABOR',
            sourceId: task.id,
            description: task.description,
            quantity: task.hours || 1,
            unit: 'خدمة',
            unitPriceBaisa: task.labor_charge_baisa,
            costPriceBaisa: task.internal_cost_baisa || 0,
            lineTotalBaisa: task.labor_charge_baisa,
          });
        }

        // 3. Update RO status to COMPLETED
        db.prepare("UPDATE repair_orders SET status = 'COMPLETED', completed_at = datetime('now') WHERE id = ?").run(ro.id);

        db.prepare(`
          INSERT INTO repair_order_status_history (id, repair_order_id, old_status, new_status, changed_by, remarks, changed_at)
          VALUES (?, ?, ?, 'COMPLETED', 'System', 'Invoice generated: ' || ?, datetime('now'))
        `).run(crypto.randomUUID(), ro.id, ro.status, invoiceNumber);
      });

      return {
        success: true,
        data: {
          id: invoiceId,
          invoiceNumber,
          repairOrderId: ro.id,
          customerId: ro.customer_id,
          customerName: ro.customer_name,
          customerPhone: ro.customer_phone,
          isCustomerPermanent: ro.customer_is_permanent === 1,
          vehicleId: ro.vehicle_id,
          vehiclePlate: ro.vehicle_plate,
          invoiceDate,
          status: 'ISSUED',
          subtotalPartsBaisa: subtotalParts,
          subtotalLaborBaisa: subtotalLabor,
          discountBaisa: discount,
          taxRatePercent: taxRate,
          taxAmountBaisa: taxAmount,
          grandTotalBaisa: grandTotal,
          paidAmountBaisa: 0,
          balanceDueBaisa: grandTotal,
          invoiceLanguage: input.invoiceLanguage || 'ar',
          retentionPrompted: false,
          notes: input.notes,
          items: createdItems,
          createdAt: nowIso,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Invoice generation failed' };
    }
  });

  ipcMain.handle('technicians:get', async (): Promise<IpcResult<TechnicianDTO[]>> => {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT * FROM technicians ORDER BY is_active DESC, name ASC').all() as any[];
      const techs: TechnicianDTO[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone || undefined,
        specialty: r.specialty || undefined,
        isActive: Boolean(r.is_active),
        notes: r.notes || undefined,
        hourlyRateBaisa: r.hourly_rate_baisa || 7000,
        monthlyBaseSalaryBaisa: r.monthly_base_salary_baisa || 350000,
        overtimeRateBaisa: r.overtime_rate_baisa || 2500,
        nationalId: r.national_id || undefined,
        hireDate: r.hire_date || undefined,
        employmentStatus: r.employment_status || 'ACTIVE',
        createdAt: r.created_at,
      }));
      return { success: true, data: techs };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get technicians' };
    }
  });

  ipcMain.handle('technicians:create', async (_event, payload: unknown): Promise<IpcResult<TechnicianDTO>> => {
    try {
      const validated = TechnicianInputSchema.parse(payload);
      const db = getDatabase();
      const id = `tech-${Date.now()}`;
      const now = new Date().toISOString();
      const isActive = validated.isActive !== false ? 1 : 0;
      const hourlyRate = validated.hourlyRateBaisa ?? 7000;
      const baseSalary = validated.monthlyBaseSalaryBaisa ?? 350000;
      const overtimeRate = validated.overtimeRateBaisa ?? 2500;
      const nationalId = validated.nationalId || null;
      const hireDate = validated.hireDate || new Date().toISOString().slice(0, 10);
      const employmentStatus = validated.employmentStatus || 'ACTIVE';

      db.prepare(`
        INSERT INTO technicians (
          id, name, phone, specialty, is_active, notes,
          hourly_rate_baisa, monthly_base_salary_baisa, overtime_rate_baisa,
          national_id, hire_date, employment_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        id, validated.name, validated.phone || null, validated.specialty || null,
        isActive, validated.notes || null, hourlyRate, baseSalary, overtimeRate,
        nationalId, hireDate, employmentStatus
      );

      return {
        success: true,
        data: {
          id,
          name: validated.name,
          phone: validated.phone || undefined,
          specialty: validated.specialty || undefined,
          isActive: isActive === 1,
          notes: validated.notes || undefined,
          hourlyRateBaisa: hourlyRate,
          monthlyBaseSalaryBaisa: baseSalary,
          overtimeRateBaisa: overtimeRate,
          nationalId: validated.nationalId || undefined,
          hireDate,
          employmentStatus,
          createdAt: now,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create technician' };
    }
  });

  ipcMain.handle('technicians:update', async (_event, { id, input }: { id: string; input: Partial<TechnicianDTO> }): Promise<IpcResult<TechnicianDTO>> => {
    try {
      const validatedId = IdParamSchema.parse(id);
      const db = getDatabase();
      const existing = db.prepare('SELECT * FROM technicians WHERE id = ?').get(validatedId) as any;
      if (!existing) return { success: false, error: 'Technician not found' };

      const name = input.name !== undefined ? input.name.trim() : existing.name;
      const phone = input.phone !== undefined ? input.phone.trim() : existing.phone;
      const specialty = input.specialty !== undefined ? input.specialty.trim() : existing.specialty;
      const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active;
      const notes = input.notes !== undefined ? input.notes.trim() : existing.notes;
      const hourlyRate = input.hourlyRateBaisa !== undefined ? input.hourlyRateBaisa : (existing.hourly_rate_baisa || 7000);
      const baseSalary = input.monthlyBaseSalaryBaisa !== undefined ? input.monthlyBaseSalaryBaisa : (existing.monthly_base_salary_baisa || 350000);
      const overtimeRate = input.overtimeRateBaisa !== undefined ? input.overtimeRateBaisa : (existing.overtime_rate_baisa || 2500);
      const nationalId = input.nationalId !== undefined ? input.nationalId.trim() : existing.national_id;
      const hireDate = input.hireDate !== undefined ? input.hireDate : existing.hire_date;
      const employmentStatus = input.employmentStatus !== undefined ? input.employmentStatus : (existing.employment_status || 'ACTIVE');

      db.prepare(`
        UPDATE technicians SET 
          name = ?, phone = ?, specialty = ?, is_active = ?, notes = ?,
          hourly_rate_baisa = ?, monthly_base_salary_baisa = ?, overtime_rate_baisa = ?,
          national_id = ?, hire_date = ?, employment_status = ?
        WHERE id = ?
      `).run(
        name, phone || null, specialty || null, isActive, notes || null,
        hourlyRate, baseSalary, overtimeRate, nationalId || null, hireDate, employmentStatus, validatedId
      );

      return {
        success: true,
        data: {
          id: validatedId,
          name,
          phone: phone || undefined,
          specialty: specialty || undefined,
          isActive: isActive === 1,
          notes: notes || undefined,
          hourlyRateBaisa: hourlyRate,
          monthlyBaseSalaryBaisa: baseSalary,
          overtimeRateBaisa: overtimeRate,
          nationalId: nationalId || undefined,
          hireDate,
          employmentStatus,
          createdAt: existing.created_at,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update technician' };
    }
  });

  ipcMain.handle('technicians:delete', async (_event, idParam: unknown): Promise<IpcResult<void>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      const taskCount = db.prepare('SELECT count(*) as count FROM labor_tasks WHERE technician_id = ?').get(id) as { count: number };
      const roCount = db.prepare('SELECT count(*) as count FROM repair_orders WHERE assigned_technician_id = ?').get(id) as { count: number };
      const otCount = db.prepare('SELECT count(*) as count FROM worker_overtime_entries WHERE worker_id = ?').get(id) as { count: number };
      const prCount = db.prepare('SELECT count(*) as count FROM worker_monthly_payrolls WHERE worker_id = ?').get(id) as { count: number };
      const prodCount = db.prepare('SELECT count(*) as count FROM worker_labor_productivity WHERE worker_id = ?').get(id) as { count: number };

      if (taskCount.count > 0 || roCount.count > 0 || otCount.count > 0 || prCount.count > 0 || prodCount.count > 0) {
        // Soft deactivate to preserve historical payroll and repair order integrity
        db.prepare("UPDATE technicians SET is_active = 0, employment_status = 'TERMINATED' WHERE id = ?").run(id);
        return { success: true };
      }
      db.prepare('DELETE FROM technicians WHERE id = ?').run(id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete technician' };
    }
  });

  // --- WORKER OVERTIME HANDLERS ---
  ipcMain.handle('workers:getOvertime', async (_event, workerId?: string, month?: string): Promise<IpcResult<WorkerOvertimeEntryDTO[]>> => {
    try {
      const db = getDatabase();
      let query = `
        SELECT o.*, t.name as worker_name, t.specialty as worker_specialty
        FROM worker_overtime_entries o
        JOIN technicians t ON t.id = o.worker_id
      `;
      const where: string[] = [];
      const params: unknown[] = [];
      if (workerId) {
        where.push('o.worker_id = ?');
        params.push(workerId);
      }
      if (month) {
        where.push("strftime('%Y-%m', o.work_date) = ?");
        params.push(month);
      }
      if (where.length > 0) {
        query += ' WHERE ' + where.join(' AND ');
      }
      query += ' ORDER BY o.work_date DESC, o.created_at DESC';

      const rows = db.prepare(query).all(...params) as any[];
      return {
        success: true,
        data: rows.map((r) => ({
          id: r.id,
          workerId: r.worker_id,
          workerName: r.worker_name,
          workerSpecialty: r.worker_specialty || undefined,
          workDate: r.work_date,
          hours: Number(r.hours),
          hourlyRateBaisa: Number(r.hourly_rate_baisa),
          totalAmountBaisa: Number(r.total_amount_baisa),
          status: r.status,
          approvedBy: r.approved_by || undefined,
          approvedAt: r.approved_at || undefined,
          notes: r.notes || undefined,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get overtime entries' };
    }
  });

  ipcMain.handle('workers:addOvertime', async (_event, payload: unknown): Promise<IpcResult<WorkerOvertimeEntryDTO>> => {
    try {
      const input = WorkerOvertimeInputSchema.parse(payload);
      const db = getDatabase();
      const worker = db.prepare('SELECT id, name, overtime_rate_baisa, is_active FROM technicians WHERE id = ?').get(input.workerId) as any;
      if (!worker) return { success: false, error: 'Worker not found' };

      const hourlyRate = input.hourlyRateBaisa !== undefined && input.hourlyRateBaisa >= 0 
        ? input.hourlyRateBaisa 
        : (worker.overtime_rate_baisa || 2500);

      const totalAmount = Math.round(input.hours * hourlyRate);
      const id = `ot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO worker_overtime_entries (
          id, worker_id, work_date, hours, hourly_rate_baisa, total_amount_baisa,
          status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, datetime('now'), datetime('now'))
      `).run(id, input.workerId, input.workDate, input.hours, hourlyRate, totalAmount, input.notes || null);

      return {
        success: true,
        data: {
          id,
          workerId: input.workerId,
          workerName: worker.name,
          workDate: input.workDate,
          hours: input.hours,
          hourlyRateBaisa: hourlyRate,
          totalAmountBaisa: totalAmount,
          status: 'PENDING',
          notes: input.notes,
          createdAt: now,
          updatedAt: now,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to add overtime entry' };
    }
  });

  ipcMain.handle('workers:updateOvertime', async (_event, payload: unknown): Promise<IpcResult<WorkerOvertimeEntryDTO>> => {
    try {
      const { id, input } = WorkerOvertimeUpdateSchema.parse(payload);
      const db = getDatabase();
      const existing = db.prepare(`
        SELECT o.*, t.name as worker_name 
        FROM worker_overtime_entries o
        JOIN technicians t ON t.id = o.worker_id
        WHERE o.id = ?
      `).get(id) as any;
      if (!existing) return { success: false, error: 'سجل العمل الإضافي غير موجود' };

      const workDate = input.workDate ? input.workDate.trim() : existing.work_date;
      const hours = input.hours !== undefined && input.hours > 0 ? input.hours : existing.hours;
      const hourlyRate = input.hourlyRateBaisa !== undefined && input.hourlyRateBaisa >= 0 
        ? input.hourlyRateBaisa 
        : existing.hourly_rate_baisa;
      const totalAmount = Math.round(hours * hourlyRate);
      const status = input.status || existing.status;
      const notes = input.notes !== undefined ? (input.notes ? input.notes.trim() : null) : existing.notes;
      const approvedBy = input.approvedBy || existing.approved_by;
      const approvedAt = status === 'APPROVED' ? (existing.approved_at || new Date().toISOString()) : null;

      db.prepare(`
        UPDATE worker_overtime_entries
        SET work_date = ?, hours = ?, hourly_rate_baisa = ?, total_amount_baisa = ?,
            status = ?, notes = ?, approved_by = ?, approved_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(workDate, hours, hourlyRate, totalAmount, status, notes, approvedBy || null, approvedAt, id);

      return {
        success: true,
        data: {
          id,
          workerId: existing.worker_id,
          workerName: existing.worker_name,
          workDate,
          hours,
          hourlyRateBaisa: hourlyRate,
          totalAmountBaisa: totalAmount,
          status,
          approvedBy: approvedBy || undefined,
          approvedAt: approvedAt || undefined,
          notes: notes || undefined,
          createdAt: existing.created_at,
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'فشل تعديل ساعات العمل الإضافي' };
    }
  });

  ipcMain.handle('workers:updateOvertimeStatus', async (_event, { id, status, approvedBy }: { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; approvedBy?: string }): Promise<IpcResult<void>> => {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE worker_overtime_entries
        SET status = ?, approved_by = ?, approved_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(status, approvedBy || 'Admin', status === 'APPROVED' ? now : null, id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update overtime status' };
    }
  });

  ipcMain.handle('workers:deleteOvertime', async (_event, idParam: unknown): Promise<IpcResult<void>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      db.prepare('DELETE FROM worker_overtime_entries WHERE id = ?').run(id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete overtime entry' };
    }
  });

  // --- WORKER MONTHLY PAYROLL HANDLERS ---
  ipcMain.handle('workers:getPayrolls', async (_event, month?: string, workerId?: string): Promise<IpcResult<WorkerMonthlyPayrollDTO[]>> => {
    try {
      const db = getDatabase();
      let query = `
        SELECT p.*, t.name as worker_name, t.specialty as worker_specialty, t.phone as worker_phone
        FROM worker_monthly_payrolls p
        JOIN technicians t ON t.id = p.worker_id
      `;
      const where: string[] = [];
      const params: unknown[] = [];
      if (month) {
        where.push('p.payroll_month = ?');
        params.push(month);
      }
      if (workerId) {
        where.push('p.worker_id = ?');
        params.push(workerId);
      }
      if (where.length > 0) {
        query += ' WHERE ' + where.join(' AND ');
      }
      query += ' ORDER BY p.payroll_month DESC, t.name ASC';

      const rows = db.prepare(query).all(...params) as any[];
      return {
        success: true,
        data: rows.map((r) => ({
          id: r.id,
          payrollMonth: r.payroll_month,
          workerId: r.worker_id,
          workerName: r.worker_name,
          workerSpecialty: r.worker_specialty || undefined,
          workerPhone: r.worker_phone || undefined,
          baseSalaryBaisa: Number(r.base_salary_baisa),
          overtimeHours: Number(r.overtime_hours),
          overtimeAmountBaisa: Number(r.overtime_amount_baisa),
          totalPayableBaisa: Number(r.total_payable_baisa),
          status: r.status,
          paidAt: r.paid_at || undefined,
          paymentMethod: r.payment_method || undefined,
          paymentReference: r.payment_reference || undefined,
          notes: r.notes || undefined,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get payroll records' };
    }
  });

  ipcMain.handle('workers:generatePayroll', async (_event, payload: unknown): Promise<IpcResult<WorkerMonthlyPayrollDTO[]>> => {
    try {
      const input = GeneratePayrollInputSchema.parse(payload);
      const db = getDatabase();

      let workersQuery = "SELECT id, name, specialty, phone, monthly_base_salary_baisa, overtime_rate_baisa FROM technicians WHERE is_active = 1";
      const params: unknown[] = [];
      if (input.workerId) {
        workersQuery += ' AND id = ?';
        params.push(input.workerId);
      }
      const workers = db.prepare(workersQuery).all(...params) as any[];

      const results: WorkerMonthlyPayrollDTO[] = [];

      for (const w of workers) {
        // Query approved overtime for this worker in this month
        const otRow = db.prepare(`
          SELECT 
            COALESCE(SUM(hours), 0) as total_ot_hours,
            COALESCE(SUM(total_amount_baisa), 0) as total_ot_baisa
          FROM worker_overtime_entries
          WHERE worker_id = ? AND strftime('%Y-%m', work_date) = ? AND status = 'APPROVED'
        `).get(w.id, input.payrollMonth) as any;

        const baseSalary = Number(w.monthly_base_salary_baisa || 0);
        const otHours = Number(otRow?.total_ot_hours || 0);
        const otAmount = Number(otRow?.total_ot_baisa || 0);
        const totalPayable = baseSalary + otAmount;

        // Check if finalized payroll already exists
        const existing = db.prepare('SELECT * FROM worker_monthly_payrolls WHERE worker_id = ? AND payroll_month = ?').get(w.id, input.payrollMonth) as any;

        const payrollId = existing ? existing.id : `pr-${input.payrollMonth}-${w.id}`;

        if (!existing) {
          db.prepare(`
            INSERT INTO worker_monthly_payrolls (
              id, payroll_month, worker_id, base_salary_baisa, overtime_hours,
              overtime_amount_baisa, total_payable_baisa, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', datetime('now'), datetime('now'))
          `).run(payrollId, input.payrollMonth, w.id, baseSalary, otHours, otAmount, totalPayable);
        } else if (existing.status === 'DRAFT') {
          // Update draft calculations with latest values
          db.prepare(`
            UPDATE worker_monthly_payrolls
            SET base_salary_baisa = ?, overtime_hours = ?, overtime_amount_baisa = ?,
                total_payable_baisa = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(baseSalary, otHours, otAmount, totalPayable, existing.id);
        }

        results.push({
          id: payrollId,
          payrollMonth: input.payrollMonth,
          workerId: w.id,
          workerName: w.name,
          workerSpecialty: w.specialty,
          workerPhone: w.phone,
          baseSalaryBaisa: baseSalary,
          overtimeHours: otHours,
          overtimeAmountBaisa: otAmount,
          totalPayableBaisa: totalPayable,
          status: existing ? existing.status : 'DRAFT',
          paidAt: existing?.paid_at,
          paymentMethod: existing?.payment_method,
          paymentReference: existing?.payment_reference,
          createdAt: existing?.created_at || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      return { success: true, data: results };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to generate monthly payroll' };
    }
  });

  ipcMain.handle('workers:finalizePayroll', async (_event, payload: unknown): Promise<IpcResult<void>> => {
    try {
      const input = FinalizePayrollInputSchema.parse(payload);
      const db = getDatabase();
      const status = input.markAsPaid ? 'PAID' : 'FINALIZED';
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE worker_monthly_payrolls
        SET status = ?, payment_method = ?, payment_reference = ?,
            paid_at = ?, notes = coalesce(?, notes), updated_at = datetime('now')
        WHERE id = ?
      `).run(
        status,
        input.paymentMethod || null,
        input.paymentReference || null,
        input.markAsPaid ? now : null,
        input.notes || null,
        input.payrollId
      );

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to finalize payroll' };
    }
  });

  // --- WORKER DAILY LABOR PRODUCTIVITY HANDLERS ---
  ipcMain.handle('workers:getProductivity', async (_event, workerId?: string, startDate?: string, endDate?: string, repairOrderId?: string): Promise<IpcResult<WorkerLaborProductivityDTO[]>> => {
    try {
      const db = getDatabase();
      let query = `
        SELECT p.*, t.name as worker_name, t.specialty as worker_specialty,
               ro.ro_number, inv.invoice_number, v.plate_number as vehicle_plate
        FROM worker_labor_productivity p
        JOIN technicians t ON t.id = p.worker_id
        LEFT JOIN repair_orders ro ON ro.id = p.repair_order_id
        LEFT JOIN invoices inv ON inv.id = p.invoice_id
        LEFT JOIN vehicles v ON v.id = p.vehicle_id
      `;
      const where: string[] = [];
      const params: unknown[] = [];
      if (workerId) {
        where.push('p.worker_id = ?');
        params.push(workerId);
      }
      if (startDate) {
        where.push('p.work_date >= ?');
        params.push(startDate);
      }
      if (endDate) {
        where.push('p.work_date <= ?');
        params.push(endDate);
      }
      if (repairOrderId) {
        where.push('p.repair_order_id = ?');
        params.push(repairOrderId);
      }
      if (where.length > 0) {
        query += ' WHERE ' + where.join(' AND ');
      }
      query += ' ORDER BY p.work_date DESC, p.created_at DESC';

      const rows = db.prepare(query).all(...params) as any[];
      return {
        success: true,
        data: rows.map((r) => ({
          id: r.id,
          workDate: r.work_date,
          workerId: r.worker_id,
          workerName: r.worker_name,
          workerSpecialty: r.worker_specialty || undefined,
          repairOrderId: r.repair_order_id || undefined,
          roNumber: r.ro_number || undefined,
          invoiceId: r.invoice_id || undefined,
          invoiceNumber: r.invoice_number || undefined,
          laborTaskId: r.labor_task_id || undefined,
          vehicleId: r.vehicle_id || undefined,
          vehiclePlate: r.vehicle_plate || undefined,
          workDescription: r.work_description,
          laborValueBaisa: Number(r.labor_value_baisa),
          hoursSpent: Number(r.hours_spent || 1.0),
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get worker productivity' };
    }
  });

  ipcMain.handle('workers:allocateLabor', async (_event, payload: unknown): Promise<IpcResult<WorkerLaborProductivityDTO[]>> => {
    try {
      const input = LaborAllocationInputSchema.parse(payload);
      const db = getDatabase();

      // If repairOrderId is provided, validate allocated labor sum against total labor charge
      if (input.repairOrderId) {
        const ro = db.prepare('SELECT id, labor_total_baisa, vehicle_id FROM repair_orders WHERE id = ?').get(input.repairOrderId) as any;
        if (ro) {
          const totalNewAllocationBaisa = input.allocations.reduce((sum, a) => sum + a.laborValueBaisa, 0);

          // Get existing allocations for this RO
          const existingAllocations = db.prepare('SELECT COALESCE(SUM(labor_value_baisa), 0) as total FROM worker_labor_productivity WHERE repair_order_id = ?').get(input.repairOrderId) as { total: number };
          const maxAllowed = ro.labor_total_baisa;

          if (maxAllowed > 0 && (existingAllocations.total + totalNewAllocationBaisa) > maxAllowed) {
            return {
              success: false,
              error: `إجمالي تخصيص العمالة (${(existingAllocations.total + totalNewAllocationBaisa) / 1000} ر.ع) يتجاوز قيمة أجور اليد المعتمدة لأمر الصيانة (${maxAllowed / 1000} ر.ع). لا يمكن تخصيص أكثر من قيمة أجور العمل.`
            };
          }
          if (!input.vehicleId && ro.vehicle_id) {
            input.vehicleId = ro.vehicle_id;
          }
        }
      }

      const created: WorkerLaborProductivityDTO[] = [];
      const now = new Date().toISOString();

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        for (const alloc of input.allocations) {
          const id = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const worker = db.prepare('SELECT name, specialty FROM technicians WHERE id = ?').get(alloc.workerId) as any;

          db.prepare(`
            INSERT INTO worker_labor_productivity (
              id, work_date, worker_id, repair_order_id, invoice_id,
              vehicle_id, work_description, labor_value_baisa, hours_spent,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).run(
            id, input.workDate, alloc.workerId, input.repairOrderId || null,
            input.invoiceId || null, input.vehicleId || null, input.workDescription,
            alloc.laborValueBaisa, alloc.hoursSpent || 1.0
          );

          created.push({
            id,
            workDate: input.workDate,
            workerId: alloc.workerId,
            workerName: worker?.name,
            workerSpecialty: worker?.specialty,
            repairOrderId: input.repairOrderId,
            invoiceId: input.invoiceId,
            vehicleId: input.vehicleId,
            workDescription: input.workDescription,
            laborValueBaisa: alloc.laborValueBaisa,
            hoursSpent: alloc.hoursSpent || 1.0,
            createdAt: now,
            updatedAt: now,
          });
        }
      });

      return { success: true, data: created };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to allocate labor' };
    }
  });

  ipcMain.handle('workers:deleteProductivity', async (_event, idParam: unknown): Promise<IpcResult<void>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      db.prepare('DELETE FROM worker_labor_productivity WHERE id = ?').run(id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete productivity entry' };
    }
  });

  // 6. Inventory Handlers
  ipcMain.handle('inventory:get', async (_event, searchQuery?: string): Promise<IpcResult<InventoryItemDTO[]>> => {
    try {
      const db = getDatabase();
      let query = 'SELECT * FROM inventory_items';
      const params: unknown[] = [];
      if (searchQuery && searchQuery.trim()) {
        query += ' WHERE part_code LIKE ? OR name LIKE ? OR category LIKE ? OR manufacturer LIKE ?';
        const wild = `%${searchQuery.trim()}%`;
        params.push(wild, wild, wild, wild);
      }
      query += ' ORDER BY name ASC';

      const rows = db.prepare(query).all(...params) as any[];

      const items: InventoryItemDTO[] = rows.map((r) => ({
        id: r.id,
        partCode: r.part_code,
        name: r.name,
        category: r.category,
        manufacturer: r.manufacturer || undefined,
        description: r.description || undefined,
        quantityInStock: r.quantity_in_stock,
        purchaseCostBaisa: r.purchase_cost_baisa,
        sellingPriceBaisa: r.selling_price_baisa,
        minStockLevel: r.min_stock_level,
        supplierId: r.supplier_id || undefined,
        location: r.location || undefined,
        isSerialized: Boolean(r.is_serialized),
        isActive: Boolean(r.is_active),
        createdAt: r.created_at,
      }));

      return { success: true, data: items };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to query inventory' };
    }
  });

  ipcMain.handle('inventory:create', async (_event, payload: unknown): Promise<IpcResult<InventoryItemDTO>> => {
    try {
      const validated = InventoryItemInputSchema.parse(payload);
      const db = getDatabase();

      // Check unique active part_code (SKU)
      const existing = db.prepare('SELECT id FROM inventory_items WHERE part_code = ?').get(validated.partCode);
      if (existing) {
        return { success: false, error: `Part with code "${validated.partCode}" already exists.` };
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO inventory_items (
          id, part_code, name, category, manufacturer, description, quantity_in_stock,
          purchase_cost_baisa, selling_price_baisa, min_stock_level, supplier_id,
          location, is_serialized, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        id,
        validated.partCode,
        validated.name,
        validated.category,
        validated.manufacturer || null,
        validated.description || null,
        validated.quantityInStock,
        validated.purchaseCostBaisa,
        validated.sellingPriceBaisa,
        validated.minStockLevel,
        validated.supplierId || null,
        validated.location || null,
        validated.isSerialized ? 1 : 0,
        validated.isActive ? 1 : 0
      );

      // Record opening balance movement if initial stock > 0
      if (validated.quantityInStock > 0) {
        db.prepare(`
          INSERT INTO inventory_movements (
            id, item_id, movement_type, quantity_delta, unit_cost_baisa,
            reference_type, reason, created_by, created_at
          ) VALUES (?, ?, 'PURCHASE_RECEIPT', ?, ?, 'PURCHASE', 'Opening stock balance', 'Operator', datetime('now'))
        `).run(crypto.randomUUID(), id, validated.quantityInStock, validated.purchaseCostBaisa);
      }

      return {
        success: true,
        data: {
          id,
          partCode: validated.partCode,
          name: validated.name,
          category: validated.category,
          manufacturer: validated.manufacturer,
          description: validated.description,
          quantityInStock: validated.quantityInStock,
          purchaseCostBaisa: validated.purchaseCostBaisa,
          sellingPriceBaisa: validated.sellingPriceBaisa,
          minStockLevel: validated.minStockLevel,
          supplierId: validated.supplierId,
          location: validated.location,
          isSerialized: validated.isSerialized,
          isActive: validated.isActive ?? true,
          createdAt: now,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Inventory item creation failed' };
    }
  });

  ipcMain.handle('inventory:receiveSerial', async (_event, payload: unknown): Promise<IpcResult<InventorySerialDTO>> => {
    try {
      const validated = InventorySerialInputSchema.parse(payload);
      const db = getDatabase();

      const item = db.prepare('SELECT id, name, part_code, purchase_cost_baisa FROM inventory_items WHERE id = ?').get(validated.itemId) as any;
      if (!item) {
        return { success: false, error: 'Inventory part item not found' };
      }

      // Check for active duplicate serial number
      const existing = db.prepare("SELECT id FROM inventory_serials WHERE serial_number = ? AND status = 'IN_STOCK'").get(validated.serialNumber);
      if (existing) {
        return { success: false, error: `A physical serialized part with active serial number "${validated.serialNumber}" is already in stock.` };
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        db.prepare(`
          INSERT INTO inventory_serials (id, item_id, serial_number, status, notes, received_at, created_at, updated_at)
          VALUES (?, ?, ?, 'IN_STOCK', ?, datetime('now'), datetime('now'), datetime('now'))
        `).run(id, validated.itemId, validated.serialNumber, validated.notes || null);

        db.prepare('UPDATE inventory_items SET quantity_in_stock = quantity_in_stock + 1 WHERE id = ?').run(validated.itemId);

        db.prepare(`
          INSERT INTO inventory_movements (id, item_id, movement_type, quantity_delta, unit_cost_baisa, serial_number, reason, created_by, created_at)
          VALUES (?, ?, 'PURCHASE_RECEIPT', 1, ?, ?, ?, 'Operator', datetime('now'))
        `).run(crypto.randomUUID(), validated.itemId, item.purchase_cost_baisa, validated.serialNumber, validated.notes || 'Manual Serial Intake');
      });

      return {
        success: true,
        data: {
          id,
          itemId: validated.itemId,
          serialNumber: validated.serialNumber,
          status: 'IN_STOCK',
          notes: validated.notes,
          receivedAt: now,
          createdAt: now,
          updatedAt: now,
          itemName: item.name,
          partCode: item.part_code,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to receive serialized part' };
    }
  });

  ipcMain.handle('inventory:issueSerial', async (_event, serialNumber: string, repairOrderId?: string, invoiceId?: string): Promise<IpcResult<void>> => {
    try {
      const cleanSerial = serialNumber.trim();
      if (!cleanSerial) return { success: false, error: 'Serial number is required' };
      const db = getDatabase();

      const serialRow = db.prepare(`
        SELECT s.id, s.item_id, i.selling_price_baisa
        FROM inventory_serials s
        JOIN inventory_items i ON i.id = s.item_id
        WHERE s.serial_number = ? AND s.status = 'IN_STOCK'
      `).get(cleanSerial) as any;

      if (!serialRow) {
        return { success: false, error: `Active serial number "${cleanSerial}" not found in inventory.` };
      }

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        db.prepare(`
          UPDATE inventory_serials
          SET status = 'ISSUED', issued_at = datetime('now'), repair_order_id = ?, invoice_id = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(repairOrderId || null, invoiceId || null, serialRow.id);

        db.prepare('UPDATE inventory_items SET quantity_in_stock = MAX(0, quantity_in_stock - 1) WHERE id = ?').run(serialRow.item_id);

        db.prepare(`
          INSERT INTO inventory_movements (id, item_id, movement_type, quantity_delta, unit_cost_baisa, serial_number, reference_type, reference_id, created_by, created_at)
          VALUES (?, ?, 'RO_ISSUE', -1, ?, ?, ?, ?, 'Operator', datetime('now'))
        `).run(
          crypto.randomUUID(),
          serialRow.item_id,
          serialRow.selling_price_baisa,
          cleanSerial,
          repairOrderId ? 'REPAIR_ORDER' : null,
          repairOrderId || invoiceId || null
        );
      });

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to issue serialized part' };
    }
  });

  ipcMain.handle('inventory:getSerials', async (_event, itemId?: string, status?: string): Promise<IpcResult<InventorySerialDTO[]>> => {
    try {
      const db = getDatabase();
      let query = `
        SELECT s.*, i.name as item_name, i.part_code
        FROM inventory_serials s
        JOIN inventory_items i ON i.id = s.item_id
      `;
      const where: string[] = [];
      const params: unknown[] = [];

      if (itemId) {
        where.push('s.item_id = ?');
        params.push(itemId);
      }
      if (status) {
        where.push('s.status = ?');
        params.push(status);
      }

      if (where.length > 0) {
        query += ' WHERE ' + where.join(' AND ');
      }
      query += ' ORDER BY s.created_at DESC';

      const rows = db.prepare(query).all(...params) as any[];

      const serials: InventorySerialDTO[] = rows.map((r) => ({
        id: r.id,
        itemId: r.item_id,
        serialNumber: r.serial_number,
        status: r.status,
        repairOrderId: r.repair_order_id || undefined,
        invoiceId: r.invoice_id || undefined,
        notes: r.notes || undefined,
        receivedAt: r.received_at,
        issuedAt: r.issued_at || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        itemName: r.item_name,
        partCode: r.part_code,
      }));

      return { success: true, data: serials };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get inventory serials' };
    }
  });

  ipcMain.handle('inventory:getMovements', async (_event, itemId?: string, repairOrderId?: string): Promise<IpcResult<InventoryMovementDTO[]>> => {
    try {
      const db = getDatabase();
      let query = `
        SELECT m.*, i.name as item_name, i.part_code
        FROM inventory_movements m
        JOIN inventory_items i ON i.id = m.item_id
      `;
      const where: string[] = [];
      const params: unknown[] = [];

      if (itemId) {
        where.push('m.item_id = ?');
        params.push(itemId);
      }
      if (repairOrderId) {
        where.push("m.reference_type = 'REPAIR_ORDER' AND m.reference_id = ?");
        params.push(repairOrderId);
      }

      if (where.length > 0) {
        query += ' WHERE ' + where.join(' AND ');
      }
      query += ' ORDER BY m.created_at DESC';

      const rows = db.prepare(query).all(...params) as any[];
      const movements: InventoryMovementDTO[] = rows.map((r) => ({
        id: r.id,
        itemId: r.item_id,
        itemName: r.item_name,
        partCode: r.part_code,
        movementType: r.movement_type,
        quantityDelta: r.quantity_delta,
        unitCostBaisa: r.unit_cost_baisa,
        serialNumber: r.serial_number || undefined,
        referenceType: r.reference_type || undefined,
        referenceId: r.reference_id || undefined,
        reason: r.reason || undefined,
        createdBy: r.created_by,
        createdAt: r.created_at,
      }));

      return { success: true, data: movements };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get movements' };
    }
  });

  ipcMain.handle('inventory:adjustStock', async (_event, payload: unknown): Promise<IpcResult<void>> => {
    try {
      const input = InventoryAdjustmentSchema.parse(payload);
      const db = getDatabase();

      const item = db.prepare('SELECT id, name, quantity_in_stock, purchase_cost_baisa FROM inventory_items WHERE id = ?').get(input.itemId) as any;
      if (!item) return { success: false, error: 'Item not found' };

      const newQty = item.quantity_in_stock + input.quantityDelta;
      if (newQty < 0) {
        return {
          success: false,
          error: `Adjustment would result in negative stock for "${item.name}". Current: ${item.quantity_in_stock}, delta: ${input.quantityDelta}`,
        };
      }

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        db.prepare('UPDATE inventory_items SET quantity_in_stock = ? WHERE id = ?').run(newQty, item.id);

        db.prepare(`
          INSERT INTO inventory_movements (
            id, item_id, movement_type, quantity_delta, unit_cost_baisa,
            reference_type, reason, created_by, created_at
          ) VALUES (?, ?, 'MANUAL_ADJUSTMENT', ?, ?, 'ADJUSTMENT', ?, 'Operator', datetime('now'))
        `).run(crypto.randomUUID(), item.id, input.quantityDelta, item.purchase_cost_baisa, input.reason);
      });

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to adjust stock' };
    }
  });

  // 7. Invoices, Payments & Customer Retention Workflow
  ipcMain.handle('invoices:get', async (_event, customerId?: string): Promise<IpcResult<InvoiceDTO[]>> => {
    try {
      const db = getDatabase();
      let query = `
        SELECT 
          i.*,
          c.full_name as customer_name, c.phone as customer_phone, COALESCE(c.is_permanent, 1) as customer_is_permanent,
          v.plate_number as vehicle_plate, v.vin as vehicle_vin, v.make as vehicle_make, v.model as vehicle_model, v.year as vehicle_year
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        LEFT JOIN vehicles v ON v.id = i.vehicle_id
      `;
      const params: unknown[] = [];
      if (customerId) {
        query += ' WHERE i.customer_id = ?';
        params.push(customerId);
      }
      query += ' ORDER BY i.created_at DESC';

      const rows = db.prepare(query).all(...params) as any[];
      const itemsStmt = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');

      const invoices: InvoiceDTO[] = rows.map((r) => {
        const itemRows = itemsStmt.all(r.id) as any[];
        const items: InvoiceItemDTO[] = itemRows.map((it) => ({
          id: it.id,
          invoiceId: it.invoice_id,
          itemType: it.item_type,
          sourceId: it.source_id || undefined,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit || (it.item_type === 'LABOR' ? 'خدمة' : 'قطعة'),
          unitPriceBaisa: it.unit_price_baisa,
          costPriceBaisa: it.cost_price_baisa,
          lineTotalBaisa: it.line_total_baisa,
        }));

        return {
          id: r.id,
          invoiceNumber: r.invoice_number,
          repairOrderId: r.repair_order_id || undefined,
          customerId: r.customer_id,
          customerName: r.customer_name,
          customerPhone: r.customer_phone || undefined,
          isCustomerPermanent: r.customer_is_permanent === 1,
          vehicleId: r.vehicle_id || undefined,
          vehiclePlate: r.vehicle_plate || undefined,
          vehicleVin: r.vehicle_vin || undefined,
          vehicleMake: r.vehicle_make || undefined,
          vehicleModel: r.vehicle_model || undefined,
          vehicleYear: r.vehicle_year || undefined,
          invoiceDate: r.invoice_date,
          status: r.status,
          subtotalPartsBaisa: r.subtotal_parts_baisa,
          subtotalLaborBaisa: r.subtotal_labor_baisa,
          discountBaisa: r.discount_baisa,
          taxRatePercent: r.tax_rate_percent,
          taxAmountBaisa: r.tax_amount_baisa,
          grandTotalBaisa: r.grand_total_baisa,
          paidAmountBaisa: r.paid_amount_baisa,
          balanceDueBaisa: r.balance_due_baisa,
          invoiceLanguage: r.invoice_language,
          retentionPrompted: r.retention_prompted === 1,
          printedAt: r.printed_at || undefined,
          notes: r.notes || undefined,
          items,
          createdAt: r.created_at,
        };
      });

      return { success: true, data: invoices };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to query invoices' };
    }
  });

  ipcMain.handle('invoices:getById', async (_event, idParam: unknown): Promise<IpcResult<InvoiceDTO | null>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      const r = db.prepare(`
        SELECT 
          i.*,
          c.full_name as customer_name, c.phone as customer_phone, COALESCE(c.is_permanent, 1) as customer_is_permanent,
          v.plate_number as vehicle_plate, v.vin as vehicle_vin, v.make as vehicle_make, v.model as vehicle_model, v.year as vehicle_year
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        LEFT JOIN vehicles v ON v.id = i.vehicle_id
        WHERE i.id = ?
      `).get(id) as any;

      if (!r) return { success: true, data: null };

      // Query itemized invoice items
      const itemRows = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id) as any[];
      const items: InvoiceItemDTO[] = itemRows.map((it) => ({
        id: it.id,
        invoiceId: it.invoice_id,
        itemType: it.item_type,
        sourceId: it.source_id || undefined,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit || (it.item_type === 'LABOR' ? 'خدمة' : 'قطعة'),
        unitPriceBaisa: it.unit_price_baisa,
        costPriceBaisa: it.cost_price_baisa,
        lineTotalBaisa: it.line_total_baisa,
      }));

      return {
        success: true,
        data: {
          id: r.id,
          invoiceNumber: r.invoice_number,
          repairOrderId: r.repair_order_id || undefined,
          customerId: r.customer_id,
          customerName: r.customer_name,
          customerPhone: r.customer_phone || undefined,
          isCustomerPermanent: r.customer_is_permanent === 1,
          vehicleId: r.vehicle_id || undefined,
          vehiclePlate: r.vehicle_plate || undefined,
          vehicleVin: r.vehicle_vin || undefined,
          vehicleMake: r.vehicle_make || undefined,
          vehicleModel: r.vehicle_model || undefined,
          vehicleYear: r.vehicle_year || undefined,
          invoiceDate: r.invoice_date,
          status: r.status,
          subtotalPartsBaisa: r.subtotal_parts_baisa,
          subtotalLaborBaisa: r.subtotal_labor_baisa,
          discountBaisa: r.discount_baisa,
          taxRatePercent: r.tax_rate_percent,
          taxAmountBaisa: r.tax_amount_baisa,
          grandTotalBaisa: r.grand_total_baisa,
          paidAmountBaisa: r.paid_amount_baisa,
          balanceDueBaisa: r.balance_due_baisa,
          invoiceLanguage: r.invoice_language,
          retentionPrompted: r.retention_prompted === 1,
          printedAt: r.printed_at || undefined,
          notes: r.notes || undefined,
          items,
          createdAt: r.created_at,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get invoice' };
    }
  });

  ipcMain.handle('invoices:create', async (_event, payload: unknown): Promise<IpcResult<InvoiceDTO>> => {
    try {
      const validated = InvoiceInputSchema.parse(payload);
      const db = getDatabase();
      const id = crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();
      const invoiceDate = nowIso.slice(0, 10);
      const countRow = db.prepare("SELECT count(*) as count FROM invoices WHERE invoice_date = ?").get(invoiceDate) as { count: number };
      const invoiceNumber = `INV-${invoiceDate.replace(/-/g, '')}-${String(countRow.count + 1001).padStart(4, '0')}`;

      let subtotalParts = validated.subtotalPartsBaisa || 0;
      let subtotalLabor = validated.subtotalLaborBaisa || 0;

      if (validated.items && validated.items.length > 0) {
        let calculatedParts = 0;
        let calculatedLabor = 0;
        for (const it of validated.items) {
          if (it.itemType === 'PART') calculatedParts += it.lineTotalBaisa;
          else if (it.itemType === 'LABOR') calculatedLabor += it.lineTotalBaisa;
        }
        if (subtotalParts === 0) subtotalParts = calculatedParts;
        if (subtotalLabor === 0) subtotalLabor = calculatedLabor;
      }

      const discount = validated.discountBaisa || 0;
      const taxRate = validated.taxRatePercent ?? 5.0;

      const taxableBase = Math.max(0, subtotalParts + subtotalLabor - discount);
      const taxAmount = Math.round((taxableBase * taxRate) / 100);
      const grandTotal = taxableBase + taxAmount;
      const paidAmount = 0;
      const balanceDue = grandTotal;

      const createdItems: InvoiceItemDTO[] = [];

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      const initialStatus = validated.status || 'ISSUED';

      executeTx(() => {
        db.prepare(`
          INSERT INTO invoices (
            id, invoice_number, repair_order_id, customer_id, vehicle_id,
            invoice_date, status, subtotal_parts_baisa, subtotal_labor_baisa,
            discount_baisa, tax_rate_percent, tax_amount_baisa, grand_total_baisa,
            paid_amount_baisa, balance_due_baisa, invoice_language, retention_prompted,
            notes, created_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, 0,
            ?, datetime('now')
          )
        `).run(
          id, invoiceNumber, validated.repairOrderId || null, validated.customerId, validated.vehicleId || null,
          invoiceDate, initialStatus, subtotalParts, subtotalLabor,
          discount, taxRate, taxAmount, grandTotal,
          paidAmount, balanceDue, validated.invoiceLanguage || 'ar',
          validated.notes || null
        );

        if (validated.items && validated.items.length > 0) {
          for (const it of validated.items) {
            const itemId = crypto.randomUUID();
            const unit = it.unit || (it.itemType === 'LABOR' ? 'خدمة' : 'قطعة');

            db.prepare(`
              INSERT INTO invoice_items (
                id, invoice_id, item_type, source_id, description, quantity, unit,
                unit_price_baisa, cost_price_baisa, line_total_baisa
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              itemId,
              id,
              it.itemType,
              it.sourceId || null,
              it.description,
              it.quantity,
              unit,
              it.unitPriceBaisa,
              it.costPriceBaisa || 0,
              it.lineTotalBaisa
            );

            createdItems.push({
              id: itemId,
              invoiceId: id,
              itemType: it.itemType,
              sourceId: it.sourceId || undefined,
              description: it.description,
              quantity: it.quantity,
              unit,
              unitPriceBaisa: it.unitPriceBaisa,
              costPriceBaisa: it.costPriceBaisa || 0,
              lineTotalBaisa: it.lineTotalBaisa,
            });

            // If item is from inventory and not draft quotation, decrement stock exactly once
            if (initialStatus !== 'DRAFT' && it.itemType === 'PART' && it.sourceId && !validated.repairOrderId) {
              const stockItem = db.prepare('SELECT id, name, quantity_in_stock, purchase_cost_baisa FROM inventory_items WHERE id = ?').get(it.sourceId) as any;
              if (stockItem) {
                const newStock = stockItem.quantity_in_stock - it.quantity;
                db.prepare('UPDATE inventory_items SET quantity_in_stock = ? WHERE id = ?').run(newStock, stockItem.id);

                db.prepare(`
                  INSERT INTO inventory_movements (
                    id, item_id, movement_type, quantity_delta, unit_cost_baisa,
                    reference_type, reference_id, reason, created_by, created_at
                  ) VALUES (?, ?, 'RO_ISSUE', ?, ?, 'REPAIR_ORDER', ?, ?, 'Operator', datetime('now'))
                `).run(
                  crypto.randomUUID(),
                  stockItem.id,
                  -it.quantity,
                  stockItem.purchase_cost_baisa,
                  id,
                  `Invoice sale: ${invoiceNumber} (${it.description})`
                );
              }
            }
          }
        }

        if (initialStatus !== 'DRAFT' && validated.repairOrderId) {
          db.prepare("UPDATE repair_orders SET status = 'COMPLETED', completed_at = datetime('now') WHERE id = ?").run(validated.repairOrderId);
        }
      });

      // Fetch newly created
      const res = db.prepare(`
        SELECT 
          i.*, c.full_name as customer_name, c.phone as customer_phone, COALESCE(c.is_permanent, 1) as customer_is_permanent,
          v.plate_number as vehicle_plate, v.vin as vehicle_vin, v.make as vehicle_make, v.model as vehicle_model, v.year as vehicle_year
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        LEFT JOIN vehicles v ON v.id = i.vehicle_id
        WHERE i.id = ?
      `).get(id) as any;

      return {
        success: true,
        data: {
          id,
          invoiceNumber,
          repairOrderId: validated.repairOrderId || undefined,
          customerId: validated.customerId,
          customerName: res?.customer_name,
          customerPhone: res?.customer_phone || undefined,
          isCustomerPermanent: res?.customer_is_permanent === 1,
          vehicleId: validated.vehicleId || undefined,
          vehiclePlate: res?.vehicle_plate || undefined,
          vehicleVin: res?.vehicle_vin || undefined,
          vehicleMake: res?.vehicle_make || undefined,
          vehicleModel: res?.vehicle_model || undefined,
          vehicleYear: res?.vehicle_year || undefined,
          invoiceDate,
          status: initialStatus,
          subtotalPartsBaisa: subtotalParts,
          subtotalLaborBaisa: subtotalLabor,
          discountBaisa: discount,
          taxRatePercent: taxRate,
          taxAmountBaisa: taxAmount,
          grandTotalBaisa: grandTotal,
          paidAmountBaisa: paidAmount,
          balanceDueBaisa: balanceDue,
          invoiceLanguage: validated.invoiceLanguage || 'ar',
          retentionPrompted: false,
          notes: validated.notes || undefined,
          items: createdItems,
          createdAt: nowIso,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create invoice' };
    }
  });

  ipcMain.handle('invoices:update', async (_event, payload: unknown): Promise<IpcResult<InvoiceDTO>> => {
    try {
      const validated = InvoiceUpdateSchema.parse(payload);
      const db = getDatabase();

      const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(validated.id) as any;
      if (!existing) {
        return { success: false, error: 'Invoice or quotation not found' };
      }

      let subtotalParts = 0;
      let subtotalLabor = 0;

      if (validated.items && validated.items.length > 0) {
        for (const it of validated.items) {
          if (it.itemType === 'PART') subtotalParts += it.lineTotalBaisa;
          else if (it.itemType === 'LABOR') subtotalLabor += it.lineTotalBaisa;
        }
      } else if (!validated.items) {
        subtotalParts = existing.subtotal_parts_baisa || 0;
        subtotalLabor = existing.subtotal_labor_baisa || 0;
      }

      const discount = validated.discountBaisa !== undefined ? validated.discountBaisa : (existing.discount_baisa || 0);
      const taxRate = validated.taxRatePercent !== undefined ? validated.taxRatePercent : (existing.tax_rate_percent ?? 5.0);
      const taxableBase = Math.max(0, subtotalParts + subtotalLabor - discount);
      const taxAmount = Math.round((taxableBase * taxRate) / 100);
      const grandTotal = taxableBase + taxAmount;
      const paidAmount = existing.paid_amount_baisa || 0;
      const balanceDue = Math.max(0, grandTotal - paidAmount);

      let nextStatus = validated.status || existing.status;
      if (paidAmount >= grandTotal && grandTotal > 0 && nextStatus !== 'DRAFT') {
        nextStatus = 'PAID';
      } else if (paidAmount > 0 && paidAmount < grandTotal && nextStatus !== 'DRAFT') {
        nextStatus = 'PARTIALLY_PAID';
      }

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        db.prepare(`
          UPDATE invoices
          SET status = ?, subtotal_parts_baisa = ?, subtotal_labor_baisa = ?,
              discount_baisa = ?, tax_rate_percent = ?, tax_amount_baisa = ?,
              grand_total_baisa = ?, balance_due_baisa = ?, notes = ?,
              invoice_language = ?
          WHERE id = ?
        `).run(
          nextStatus, subtotalParts, subtotalLabor,
          discount, taxRate, taxAmount, grandTotal,
          balanceDue, validated.notes !== undefined ? validated.notes : existing.notes,
          validated.invoiceLanguage || existing.invoice_language || 'ar',
          validated.id
        );

        if (validated.items) {
          db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(validated.id);
          for (const it of validated.items) {
            const itemId = crypto.randomUUID();
            const unit = it.unit || (it.itemType === 'LABOR' ? 'خدمة' : 'قطعة');
            db.prepare(`
              INSERT INTO invoice_items (
                id, invoice_id, item_type, source_id, description, quantity, unit,
                unit_price_baisa, cost_price_baisa, line_total_baisa
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              itemId, validated.id, it.itemType, it.sourceId || null,
              it.description, it.quantity, unit, it.unitPriceBaisa,
              it.costPriceBaisa || 0, it.lineTotalBaisa
            );
          }
        }
      });

      const updatedRow = db.prepare(`
        SELECT 
          i.*, c.full_name as customer_name, c.phone as customer_phone, COALESCE(c.is_permanent, 1) as customer_is_permanent,
          v.plate_number as vehicle_plate, v.vin as vehicle_vin, v.make as vehicle_make, v.model as vehicle_model, v.year as vehicle_year
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        LEFT JOIN vehicles v ON v.id = i.vehicle_id
        WHERE i.id = ?
      `).get(validated.id) as any;

      const itemsInDb = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(validated.id) as any[];

      return {
        success: true,
        data: {
          id: updatedRow.id,
          invoiceNumber: updatedRow.invoice_number,
          repairOrderId: updatedRow.repair_order_id || undefined,
          customerId: updatedRow.customer_id,
          customerName: updatedRow.customer_name,
          customerPhone: updatedRow.customer_phone || undefined,
          isCustomerPermanent: updatedRow.customer_is_permanent === 1,
          vehicleId: updatedRow.vehicle_id || undefined,
          vehiclePlate: updatedRow.vehicle_plate || undefined,
          vehicleVin: updatedRow.vehicle_vin || undefined,
          vehicleMake: updatedRow.vehicle_make || undefined,
          vehicleModel: updatedRow.vehicle_model || undefined,
          vehicleYear: updatedRow.vehicle_year || undefined,
          invoiceDate: updatedRow.invoice_date,
          status: updatedRow.status,
          subtotalPartsBaisa: updatedRow.subtotal_parts_baisa,
          subtotalLaborBaisa: updatedRow.subtotal_labor_baisa,
          discountBaisa: updatedRow.discount_baisa,
          taxRatePercent: updatedRow.tax_rate_percent,
          taxAmountBaisa: updatedRow.tax_amount_baisa,
          grandTotalBaisa: updatedRow.grand_total_baisa,
          paidAmountBaisa: updatedRow.paid_amount_baisa,
          balanceDueBaisa: updatedRow.balance_due_baisa,
          invoiceLanguage: updatedRow.invoice_language || 'ar',
          retentionPrompted: updatedRow.retention_prompted === 1,
          printedAt: updatedRow.printed_at || undefined,
          notes: updatedRow.notes || undefined,
          items: itemsInDb.map((item) => ({
            id: item.id,
            invoiceId: item.invoice_id,
            itemType: item.item_type,
            sourceId: item.source_id || undefined,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPriceBaisa: item.unit_price_baisa,
            costPriceBaisa: item.cost_price_baisa,
            lineTotalBaisa: item.line_total_baisa,
          })),
          createdAt: updatedRow.created_at,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update invoice/quotation' };
    }
  });

  ipcMain.handle('payments:record', async (_event, payload: unknown): Promise<IpcResult<PaymentResult>> => {
    try {
      const validated = PaymentInputSchema.parse(payload);
      const db = getDatabase();

      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(validated.invoiceId) as any;
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      if (invoice.status === 'PAID' || invoice.balance_due_baisa <= 0) {
        return { success: false, error: 'Invoice is already fully paid.' };
      }

      if (validated.amountBaisa > invoice.balance_due_baisa) {
        return {
          success: false,
          error: `Payment amount (${validated.amountBaisa} Baisa) exceeds the outstanding balance due (${invoice.balance_due_baisa} Baisa).`,
        };
      }

      const paymentId = crypto.randomUUID();
      const paymentDate = new Date().toISOString().slice(0, 10);
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      const paymentNumber = `PAY-${paymentDate.replace(/-/g, '')}-${randomSeq}`;

      const newPaidAmount = invoice.paid_amount_baisa + validated.amountBaisa;
      const newBalanceDue = Math.max(0, invoice.grand_total_baisa - newPaidAmount);
      const newStatus = newBalanceDue === 0 ? 'PAID' : (newPaidAmount > 0 ? 'PARTIALLY_PAID' : invoice.status);

      const executeTx = (fn: () => void) => {
        if (typeof db.transaction === 'function') {
          db.transaction(fn)();
        } else {
          db.exec('BEGIN TRANSACTION;');
          try {
            fn();
            db.exec('COMMIT;');
          } catch (err) {
            try { db.exec('ROLLBACK;'); } catch {}
            throw err;
          }
        }
      };

      executeTx(() => {
        db.prepare(`
          INSERT INTO payments (
            id, payment_number, invoice_id, payment_date, amount_baisa,
            payment_method, reference_number, receipt_notes, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Operator', datetime('now'))
        `).run(
          paymentId, paymentNumber, validated.invoiceId, paymentDate, validated.amountBaisa,
          validated.paymentMethod, validated.referenceNumber || null, validated.notes || null
        );

        db.prepare(`
          UPDATE invoices
          SET paid_amount_baisa = ?, balance_due_baisa = ?, status = ?
          WHERE id = ?
        `).run(newPaidAmount, newBalanceDue, newStatus, validated.invoiceId);
      });

      const eligibility = checkRetentionEligibilityInternal(db, validated.invoiceId);

      return {
        success: true,
        data: {
          invoice: eligibility.invoice!,
          promptEligible: eligibility.eligible,
          customer: eligibility.customer,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to record payment' };
    }
  });

  ipcMain.handle('invoices:markPrompted', async (_event, invoiceIdParam: unknown): Promise<IpcResult<void>> => {
    try {
      const invoiceId = IdParamSchema.parse(invoiceIdParam);
      const db = getDatabase();
      db.prepare('UPDATE invoices SET retention_prompted = 1 WHERE id = ?').run(invoiceId);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to mark retention prompted' };
    }
  });

  ipcMain.handle('invoices:checkRetention', async (_event, invoiceIdParam: unknown): Promise<IpcResult<{ eligible: boolean; customer?: CustomerDTO; invoice?: InvoiceDTO }>> => {
    try {
      const invoiceId = IdParamSchema.parse(invoiceIdParam);
      const db = getDatabase();
      const res = checkRetentionEligibilityInternal(db, invoiceId);
      return { success: true, data: res };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to check retention eligibility' };
    }
  });

  // 8. Printing & PDF Generation
  ipcMain.handle('print:invoice', async (_event, invoiceIdParam: string, _lang: 'ar' | 'en'): Promise<IpcResult<PrintResult>> => {
    try {
      const invoiceId = IdParamSchema.parse(invoiceIdParam);
      const db = getDatabase();

      const inv = db.prepare(`
        SELECT 
          i.*,
          c.full_name as customer_name, c.phone as customer_phone, COALESCE(c.is_permanent, 1) as customer_is_permanent,
          v.plate_number as vehicle_plate, v.make as vehicle_make, v.model as vehicle_model, v.year as vehicle_year
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        LEFT JOIN vehicles v ON v.id = i.vehicle_id
        WHERE i.id = ?
      `).get(invoiceId) as any;
      if (!inv) return { success: false, error: 'الفاتورة غير موجودة أو تم حذفها' };

      const itemRows = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId) as any[];

      // Query configured printer in settings table (fixed from garage_settings)
      const printerSetting = db.prepare("SELECT value FROM settings WHERE key = 'default_printer'").get() as { value: string } | undefined;
      const configuredPrinter = printerSetting?.value?.trim() || '';

      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (win && win.webContents) {
        const printers = await win.webContents.getPrintersAsync();
        let targetPrinter = configuredPrinter;
        if (targetPrinter) {
          const found = printers.find((p) => p.name === targetPrinter);
          if (!found) {
            return {
              success: false,
              error: `الطابعة المحددة "${targetPrinter}" غير متصلة أو غير متاحة. يرجى التحقق من إعدادات الطابعات.`,
            };
          }
        } else {
          const defaultP = printers.find((p) => (p as any).isDefault);
          if (defaultP) {
            targetPrinter = defaultP.name;
          }
        }

        // Generate complete standalone HTML document for the invoice
        const invoiceHtml = generateInvoicePrintHtml(inv, itemRows);

        // Silent direct printing using a dedicated hidden print window
        const printWin = new BrowserWindow({
          show: false,
          width: 800,
          height: 1100,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        try {
          await new Promise<void>((resolve, reject) => {
            printWin.webContents.on('did-finish-load', () => {
              printWin.webContents.print(
                {
                  silent: true,
                  deviceName: targetPrinter || undefined,
                  printBackground: true,
                },
                (success, failureReason) => {
                  if (!success && failureReason && failureReason !== 'cancelled') {
                    reject(new Error(`فشل إرسال أمر الطباعة المباشرة: ${failureReason}`));
                  } else {
                    resolve();
                  }
                }
              );
            });
            printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(invoiceHtml)}`);
          });
        } finally {
          if (!printWin.isDestroyed()) {
            printWin.close();
          }
        }
      }

      // Record printed_at timestamp in database on successful execution
      db.prepare("UPDATE invoices SET printed_at = datetime('now') WHERE id = ?").run(invoiceId);

      const eligibility = checkRetentionEligibilityInternal(db, invoiceId);

      return {
        success: true,
        data: {
          printed: true,
          promptEligible: eligibility.eligible,
          customer: eligibility.customer,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'فشل تنفيذ أمر الطباعة المباشرة' };
    }
  });

  // 9. Payments Retrieval Handlers
  ipcMain.handle('payments:get', async (_event, invoiceIdParam?: string): Promise<IpcResult<PaymentDTO[]>> => {
    try {
      const db = getDatabase();
      let query = `
        SELECT 
          p.*,
          i.invoice_number,
          c.id as customer_id, c.full_name as customer_name, c.phone as customer_phone,
          v.plate_number as vehicle_plate
        FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        JOIN customers c ON c.id = i.customer_id
        LEFT JOIN vehicles v ON v.id = i.vehicle_id
      `;
      const params: unknown[] = [];
      if (invoiceIdParam && typeof invoiceIdParam === 'string' && invoiceIdParam.trim()) {
        query += ' WHERE p.invoice_id = ?';
        params.push(invoiceIdParam.trim());
      }
      query += ' ORDER BY p.created_at DESC';

      const rows = db.prepare(query).all(...params) as any[];
      const payments: PaymentDTO[] = rows.map((r) => ({
        id: r.id,
        paymentNumber: r.payment_number,
        invoiceId: r.invoice_id,
        invoiceNumber: r.invoice_number,
        customerId: r.customer_id,
        customerName: r.customer_name,
        customerPhone: r.customer_phone || undefined,
        vehiclePlate: r.vehicle_plate || undefined,
        paymentDate: r.payment_date,
        amountBaisa: r.amount_baisa,
        paymentMethod: r.payment_method,
        referenceNumber: r.reference_number || undefined,
        receiptNotes: r.receipt_notes || undefined,
        createdBy: r.created_by,
        createdAt: r.created_at,
      }));

      return { success: true, data: payments };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to query payments' };
    }
  });

  ipcMain.handle('payments:getById', async (_event, idParam: unknown): Promise<IpcResult<PaymentDTO | null>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      const r = db.prepare(`
        SELECT 
          p.*,
          i.invoice_number,
          c.id as customer_id, c.full_name as customer_name, c.phone as customer_phone,
          v.plate_number as vehicle_plate
        FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        JOIN customers c ON c.id = i.customer_id
        LEFT JOIN vehicles v ON v.id = i.vehicle_id
        WHERE p.id = ?
      `).get(id) as any;

      if (!r) return { success: true, data: null };

      return {
        success: true,
        data: {
          id: r.id,
          paymentNumber: r.payment_number,
          invoiceId: r.invoice_id,
          invoiceNumber: r.invoice_number,
          customerId: r.customer_id,
          customerName: r.customer_name,
          customerPhone: r.customer_phone || undefined,
          vehiclePlate: r.vehicle_plate || undefined,
          paymentDate: r.payment_date,
          amountBaisa: r.amount_baisa,
          paymentMethod: r.payment_method,
          referenceNumber: r.reference_number || undefined,
          receiptNotes: r.receipt_notes || undefined,
          createdBy: r.created_by,
          createdAt: r.created_at,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to query payment' };
    }
  });

  // 10. Suppliers Handlers
  ipcMain.handle('suppliers:get', async (): Promise<IpcResult<SupplierDTO[]>> => {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all() as any[];
      const suppliers: SupplierDTO[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone || undefined,
        email: r.email || undefined,
        address: r.address || undefined,
        notes: r.notes || undefined,
        createdAt: r.created_at,
      }));
      return { success: true, data: suppliers };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get suppliers' };
    }
  });

  ipcMain.handle('suppliers:create', async (_event, payload: unknown): Promise<IpcResult<SupplierDTO>> => {
    try {
      const validated = SupplierInputSchema.parse(payload);
      const db = getDatabase();
      const id = `supp-${Date.now()}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO suppliers (id, name, phone, email, address, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, validated.name, validated.phone || null, validated.email || null, validated.address || null, validated.notes || null);

      return {
        success: true,
        data: {
          id,
          name: validated.name,
          phone: validated.phone || undefined,
          email: validated.email || undefined,
          address: validated.address || undefined,
          notes: validated.notes || undefined,
          createdAt: now,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create supplier' };
    }
  });

  ipcMain.handle('suppliers:update', async (_event, { id, input }: { id: string; input: Partial<SupplierDTO> }): Promise<IpcResult<SupplierDTO>> => {
    try {
      const validatedId = IdParamSchema.parse(id);
      const db = getDatabase();
      const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(validatedId) as any;
      if (!existing) return { success: false, error: 'Supplier not found' };

      const name = input.name !== undefined ? input.name.trim() : existing.name;
      const phone = input.phone !== undefined ? input.phone.trim() : existing.phone;
      const email = input.email !== undefined ? input.email.trim() : existing.email;
      const address = input.address !== undefined ? input.address.trim() : existing.address;
      const notes = input.notes !== undefined ? input.notes.trim() : existing.notes;

      db.prepare(`
        UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?
      `).run(name, phone || null, email || null, address || null, notes || null, validatedId);

      return {
        success: true,
        data: {
          id: validatedId,
          name,
          phone: phone || undefined,
          email: email || undefined,
          address: address || undefined,
          notes: notes || undefined,
          createdAt: existing.created_at,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update supplier' };
    }
  });

  ipcMain.handle('suppliers:delete', async (_event, idParam: unknown): Promise<IpcResult<void>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete supplier' };
    }
  });

  // 11. Expenses Handlers
  ipcMain.handle('expenses:get', async (_event, startDate?: string, endDate?: string): Promise<IpcResult<ExpenseDTO[]>> => {
    try {
      const db = getDatabase();
      let query = 'SELECT * FROM expenses';
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (startDate && startDate.trim()) {
        conditions.push('expense_date >= ?');
        params.push(startDate.trim());
      }
      if (endDate && endDate.trim()) {
        conditions.push('expense_date <= ?');
        params.push(endDate.trim());
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY expense_date DESC, created_at DESC';

      const rows = db.prepare(query).all(...params) as any[];
      const expenses: ExpenseDTO[] = rows.map((r) => ({
        id: r.id,
        expenseDate: r.expense_date,
        category: r.category,
        amountBaisa: r.amount_baisa,
        paymentMethod: r.payment_method,
        payee: r.payee,
        description: r.description || undefined,
        receiptRef: r.receipt_ref || undefined,
        createdAt: r.created_at,
      }));

      return { success: true, data: expenses };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to query expenses' };
    }
  });

  ipcMain.handle('expenses:create', async (_event, payload: unknown): Promise<IpcResult<ExpenseDTO>> => {
    try {
      const validated = ExpenseInputSchema.parse(payload);
      const db = getDatabase();
      const id = `exp-${Date.now()}`;
      const expenseDate = validated.expenseDate || new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO expenses (id, expense_date, category, amount_baisa, payment_method, payee, description, receipt_ref, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        id,
        expenseDate,
        validated.category,
        validated.amountBaisa,
        validated.paymentMethod,
        validated.payee,
        validated.description || null,
        validated.receiptRef || null
      );

      return {
        success: true,
        data: {
          id,
          expenseDate,
          category: validated.category,
          amountBaisa: validated.amountBaisa,
          paymentMethod: validated.paymentMethod,
          payee: validated.payee,
          description: validated.description || undefined,
          receiptRef: validated.receiptRef || undefined,
          createdAt: now,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create expense' };
    }
  });

  ipcMain.handle('expenses:delete', async (_event, idParam: unknown): Promise<IpcResult<void>> => {
    try {
      const id = IdParamSchema.parse(idParam);
      const db = getDatabase();
      db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete expense' };
    }
  });

  // 12. Financial & Operational Reports Handler
  ipcMain.handle('reports:getFinancial', async (_event, startDateParam?: string, endDateParam?: string): Promise<IpcResult<FinancialReportDTO>> => {
    try {
      const db = getDatabase();
      const startDate = startDateParam && startDateParam.trim() ? startDateParam.trim() : '2020-01-01';
      const endDate = endDateParam && endDateParam.trim() ? endDateParam.trim() : new Date().toISOString().slice(0, 10);

      const invStats = db.prepare(`
        SELECT 
          COUNT(*) as invoices_count,
          COALESCE(SUM(grand_total_baisa), 0) as total_invoiced,
          COALESCE(SUM(paid_amount_baisa), 0) as total_collected,
          COALESCE(SUM(balance_due_baisa), 0) as total_outstanding,
          COALESCE(SUM(tax_amount_baisa), 0) as total_vat,
          COALESCE(SUM(subtotal_labor_baisa), 0) as total_labor,
          COALESCE(SUM(subtotal_parts_baisa), 0) as total_parts
        FROM invoices
        WHERE invoice_date >= ? AND invoice_date <= ? AND status != 'CANCELLED'
      `).get(startDate, endDate) as any;

      const expStats = db.prepare(`
        SELECT COALESCE(SUM(amount_baisa), 0) as total_expenses
        FROM expenses
        WHERE expense_date >= ? AND expense_date <= ?
      `).get(startDate, endDate) as any;

      const payStats = db.prepare(`
        SELECT COUNT(*) as payments_count, COALESCE(SUM(amount_baisa), 0) as total_payments
        FROM payments
        WHERE payment_date >= ? AND payment_date <= ?
      `).get(startDate, endDate) as any;

      const roStats = db.prepare(`
        SELECT 
          COUNT(*) as total_ro,
          SUM(CASE WHEN status = 'COMPLETED' OR status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_ro
        FROM repair_orders
        WHERE date(created_at) >= ? AND date(created_at) <= ?
      `).get(startDate, endDate) as any;

      const topPartsRows = db.prepare(`
        SELECT 
          part_code,
          part_name,
          SUM(quantity) as quantity,
          SUM(total_price_baisa) as total_revenue
        FROM repair_order_parts
        WHERE status = 'ISSUED' AND date(issued_at) >= ? AND date(issued_at) <= ?
        GROUP BY part_code, part_name
        ORDER BY quantity DESC
        LIMIT 5
      `).all(startDate, endDate) as any[];

      const totalInvoiced = Number(invStats?.total_invoiced || 0);
      const totalCollected = Number(payStats?.total_payments || invStats?.total_collected || 0);
      const totalOutstanding = Number(invStats?.total_outstanding || 0);
      const totalVat = Number(invStats?.total_vat || 0);
      const totalLabor = Number(invStats?.total_labor || 0);
      const totalParts = Number(invStats?.total_parts || 0);
      const totalExpenses = Number(expStats?.total_expenses || 0);
      const netIncome = totalCollected - totalExpenses;

      return {
        success: true,
        data: {
          startDate,
          endDate,
          totalInvoicedBaisa: totalInvoiced,
          totalCollectedBaisa: totalCollected,
          totalOutstandingBaisa: totalOutstanding,
          totalVatBaisa: totalVat,
          totalLaborBaisa: totalLabor,
          totalPartsBaisa: totalParts,
          totalExpensesBaisa: totalExpenses,
          netIncomeBaisa: netIncome,
          invoicesCount: Number(invStats?.invoices_count || 0),
          paymentsCount: Number(payStats?.payments_count || 0),
          repairOrdersCount: Number(roStats?.total_ro || 0),
          completedOrdersCount: Number(roStats?.completed_ro || 0),
          topMovingParts: topPartsRows.map((p) => ({
            partCode: p.part_code,
            partName: p.part_name,
            quantity: Number(p.quantity),
            totalRevenueBaisa: Number(p.total_revenue),
          })),
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to generate financial report' };
    }
  });

  // 13. Production SQLite Hot Backup & Restore Management
  ipcMain.handle('backup:list', async (): Promise<IpcResult<BackupRecord[]>> => {
    try {
      const backupsDir = getBackupsDir();
      if (!fs.existsSync(backupsDir)) {
        return { success: true, data: [] };
      }
      const files = fs.readdirSync(backupsDir).filter((f) => f.endsWith('.db'));
      const records: BackupRecord[] = [];

      for (const file of files) {
        const fullPath = path.join(backupsDir, file);
        const stats = fs.statSync(fullPath);
        const fileBuffer = fs.readFileSync(fullPath);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        records.push({
          fileName: file,
          fileSizeBytes: stats.size,
          checksumSha256: hash,
          createdAt: stats.mtime.toISOString(),
          isValid: stats.size > 0,
        });
      }

      records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return { success: true, data: records };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list backups' };
    }
  });

  ipcMain.handle('backup:trigger', async (): Promise<IpcResult<BackupResult>> => {
    try {
      const db = getDatabase();
      const backupsDir = getBackupsDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `garage_backup_${timestamp}.db`;
      const backupFilePath = path.join(backupsDir, backupFileName);

      // Perform atomic live VACUUM INTO backup
      db.prepare('VACUUM INTO ?').run(backupFilePath);

      const stats = fs.statSync(backupFilePath);
      const fileBuffer = fs.readFileSync(backupFilePath);
      const checksumSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      return {
        success: true,
        data: {
          success: true,
          backupFile: backupFileName,
          checksumSha256,
          createdAt: stats.mtime.toISOString(),
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to trigger backup' };
    }
  });

  ipcMain.handle('backup:restore', async (_event, fileNameParam: unknown): Promise<IpcResult<void>> => {
    try {
      const fileName = typeof fileNameParam === 'string' ? fileNameParam.trim() : '';
      if (!fileName || !fileName.endsWith('.db')) {
        return { success: false, error: 'Invalid backup file name' };
      }
      const backupsDir = getBackupsDir();
      const backupPath = path.join(backupsDir, fileName);
      if (!fs.existsSync(backupPath)) {
        return { success: false, error: 'Backup file does not exist' };
      }
      const dbPath = getDatabasePath();

      const db = getDatabase();
      db.close();

      fs.copyFileSync(backupPath, dbPath);

      // Reconnect
      const BetterSqlite3 = require('better-sqlite3');
      const newDb = new BetterSqlite3(dbPath);
      newDb.pragma('journal_mode = WAL');
      newDb.pragma('foreign_keys = ON');

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to restore backup' };
    }
  });

  // 14. Authentication & Security (AKASHA AI Secure Vault)
  ipcMain.handle('auth:login', async (_event, payload: unknown): Promise<IpcResult<AuthSessionDTO>> => {
    try {
      const validated = LoginInputSchema.parse(payload);
      const db = getDatabase();
      const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(validated.username) as any;
      if (!user) {
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }
      const isValid = verifyPassword(validated.password, user.password_hash, user.salt);
      if (!isValid) {
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }
      return {
        success: true,
        data: {
          username: user.username,
          loginTime: new Date().toISOString(),
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'فشل تسجيل الدخول' };
    }
  });

  ipcMain.handle('auth:changeCredentials', async (_event, payload: unknown): Promise<IpcResult<void>> => {
    try {
      const validated = ChangeCredentialsSchema.parse(payload);
      // Validate Developer Authorization Code in trusted main process
      if (!verifyDeveloperCode(validated.devCode)) {
        return { success: false, error: 'رمز تفويض المطور غير صحيح. يرجى مراجعة مطور النظام AKASHA AI.' };
      }
      const db = getDatabase();
      const hashed = hashPassword(validated.newPassword);
      db.prepare(`
        UPDATE admin_users 
        SET username = ?, password_hash = ?, salt = ?, updated_at = datetime('now')
      `).run(validated.newUsername, hashed.hash, hashed.salt);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'فشل تحديث بيانات الدخول' };
    }
  });

  // 15. Hardware Printers & PDF Export
  ipcMain.handle('printers:get', async (): Promise<IpcResult<PrinterInfoDTO[]>> => {
    try {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (win && win.webContents) {
        const printers = await win.webContents.getPrintersAsync();
        return {
          success: true,
          data: printers.map((p) => {
            const anyP = p as any;
            return {
              name: p.name,
              displayName: p.displayName || p.name,
              description: p.description || '',
              isDefault: Boolean(anyP.isDefault),
              status: typeof anyP.status === 'number' ? anyP.status : 0,
            };
          }),
        };
      }
      return { success: true, data: [] };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to query printers' };
    }
  });

  ipcMain.handle('printers:testPrint', async (_event, printerName?: string): Promise<IpcResult<void>> => {
    try {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (win && win.webContents) {
        win.webContents.print({
          silent: false,
          deviceName: printerName || '',
        });
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to run test print' };
    }
  });

  ipcMain.handle('print:exportPdf', async (_event, invoiceId: string, _language: 'ar' | 'en'): Promise<IpcResult<{ filePath: string }>> => {
    try {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      const backupsDir = getBackupsDir();
      const cleanId = (typeof invoiceId === 'string' ? invoiceId.slice(0, 8) : 'export');
      const timestamp = new Date().toISOString().slice(0, 10);
      const pdfFileName = `Invoice_${cleanId}_${timestamp}.pdf`;
      const pdfPath = path.join(backupsDir, pdfFileName);

      if (win && win.webContents) {
        const pdfData = await win.webContents.printToPDF({
          printBackground: true,
          landscape: false,
          pageSize: 'A4',
        });
        fs.writeFileSync(pdfPath, pdfData);
        return { success: true, data: { filePath: pdfPath } };
      }

      return { success: true, data: { filePath: pdfPath } };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to export invoice PDF' };
    }
  });
}

function checkRetentionEligibilityInternal(db: any, invoiceId: string): { eligible: boolean; customer?: CustomerDTO; invoice?: InvoiceDTO } {
  const inv = db.prepare(`
    SELECT 
      i.*,
      c.full_name as customer_name, c.phone as customer_phone, COALESCE(c.is_permanent, 1) as customer_is_permanent,
      v.plate_number as vehicle_plate
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    LEFT JOIN vehicles v ON v.id = i.vehicle_id
    WHERE i.id = ?
  `).get(invoiceId) as any;

  if (!inv) return { eligible: false };

  // Conditions from requirements:
  // 1. Payment must be successfully recorded (status === 'PAID' or balance_due_baisa <= 0 and paid_amount_baisa > 0)
  // 2. Invoice printing workflow must have completed (printed_at is NOT NULL)
  // 3. Customer must NOT already be permanent (is_permanent == 0)
  // 4. Must NOT have been prompted before for this invoice/visit (retention_prompted == 0)
  const isPaid = inv.status === 'PAID' || (inv.paid_amount_baisa >= inv.grand_total_baisa && inv.balance_due_baisa <= 0);
  const isPrinted = Boolean(inv.printed_at);
  const isTemporary = Number(inv.customer_is_permanent) === 0;
  const notPrompted = Number(inv.retention_prompted) === 0;

  const eligible = Boolean(isPaid && isPrinted && isTemporary && notPrompted);

  return {
    eligible,
    customer: {
      id: inv.customer_id,
      fullName: inv.customer_name,
      phone: inv.customer_phone || undefined,
      isActive: true,
      isPermanent: inv.customer_is_permanent === 1,
      createdAt: inv.created_at,
      updatedAt: inv.created_at,
    },
    invoice: {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      repairOrderId: inv.repair_order_id || undefined,
      customerId: inv.customer_id,
      customerName: inv.customer_name,
      customerPhone: inv.customer_phone || undefined,
      isCustomerPermanent: inv.customer_is_permanent === 1,
      vehicleId: inv.vehicle_id || undefined,
      vehiclePlate: inv.vehicle_plate || undefined,
      invoiceDate: inv.invoice_date,
      status: inv.status,
      subtotalPartsBaisa: inv.subtotal_parts_baisa,
      subtotalLaborBaisa: inv.subtotal_labor_baisa,
      discountBaisa: inv.discount_baisa,
      taxRatePercent: inv.tax_rate_percent,
      taxAmountBaisa: inv.tax_amount_baisa,
      grandTotalBaisa: inv.grand_total_baisa,
      paidAmountBaisa: inv.paid_amount_baisa,
      balanceDueBaisa: inv.balance_due_baisa,
      invoiceLanguage: inv.invoice_language,
      retentionPrompted: inv.retention_prompted === 1,
      printedAt: inv.printed_at || undefined,
      notes: inv.notes || undefined,
      createdAt: inv.created_at,
    },
  };
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateInvoicePrintHtml(inv: any, items: any[]): string {
  const isQuotation = inv.status === 'DRAFT' || inv.is_quotation;
  const isPaid = inv.status === 'PAID' || inv.balance_due_baisa <= 0;
  const formatOMRStr = (baisa: number) => `<span dir="ltr">${(baisa / 1000).toFixed(3)}</span> ر.ع`;

  const rowsHtml = items.map((it, idx) => `
    <tr>
      <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-family: monospace;">${idx + 1}</td>
      <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: ${it.item_type === 'LABOR' ? '#1d4ed8' : '#b45309'}; font-size: 11px;">
        ${it.item_type === 'LABOR' ? 'أجور يد / خدمة' : 'قطع غيار'}
      </td>
      <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #0f172a;">${escapeHtml(it.description)}</td>
      <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-family: monospace;">${it.quantity} ${escapeHtml(it.unit || '')}</td>
      <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-family: monospace; white-space: nowrap;">${formatOMRStr(it.unit_price_baisa)}</td>
      <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-family: monospace; font-weight: bold; color: #020617; white-space: nowrap;">${formatOMRStr(it.line_total_baisa)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${isQuotation ? 'Quotation' : 'Invoice'} ${escapeHtml(inv.invoice_number)}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: 'Cairo', Arial, sans-serif; color: #0f172a; margin: 0; padding: 12px; font-size: 12px; line-height: 1.4; direction: rtl; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 16px; }
        .title { font-size: 20px; font-weight: 900; margin: 0; color: #020617; }
        .subtitle { font-size: 11px; font-weight: bold; color: #475569; margin: 2px 0 0 0; }
        .meta-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; min-width: 230px; text-align: right; }
        .meta-number { font-size: 16px; font-weight: 900; font-family: monospace; color: #020617; margin-top: 2px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; table-layout: fixed; }
        th { background: #f1f5f9; color: #334155; padding: 9px 8px; border-bottom: 2px solid #cbd5e1; font-weight: bold; }
        .totals-container { display: flex; justify-content: flex-start; margin-bottom: 16px; }
        .totals-box { width: 340px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; font-size: 12px; }
        .totals-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; color: #475569; }
        .totals-final { display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 900; border-top: 2px solid #020617; padding-top: 6px; margin-top: 6px; color: #020617; }
        .footer { margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="title">الرواحي للعناية بالسيارات</h1>
          <p class="subtitle">AL RAWAHI AUTO CARE</p>
          <p style="margin: 4px 0 0 0; font-size: 10px; color: #475569;">مسقط، سلطنة عُمان • هاتف: 91234567 • س.ت: 1092834 • الرقم الضريبي (VAT IN): OM1100234567</p>
        </div>
        <div class="meta-box">
          <div style="font-size: 11px; font-weight: bold; color: ${isQuotation ? '#d97706' : '#2563eb'};">
            ${isQuotation ? 'عرض سعر رسمي (QUOTATION)' : 'فاتورة ضريبية رسمية (TAX INVOICE)'}
          </div>
          <div class="meta-number" dir="ltr">${escapeHtml(inv.invoice_number)}</div>
          <div style="font-size: 10px; color: #475569; margin-top: 4px;">التاريخ: <b>${escapeHtml(inv.invoice_date)}</b></div>
          <div style="font-size: 10px; color: ${isQuotation ? '#d97706' : isPaid ? '#047857' : '#b45309'}; font-weight: bold; margin-top: 2px;">
            الحالة: ${isQuotation ? 'عرض سعر مسودة (DRAFT QUOTATION)' : isPaid ? 'مدفوعة بالكامل (PAID)' : 'مستحقة السداد (PENDING)'}
          </div>
        </div>
      </div>

      <div class="info-grid">
        <div>
          <div style="font-size: 10px; font-weight: bold; color: #64748b; margin-bottom: 4px;">بيانات العميل (Customer):</div>
          <div style="font-size: 13px; font-weight: bold; color: #020617;">${escapeHtml(inv.customer_name || 'عميل نقدي')}</div>
          ${inv.customer_phone ? `<div style="font-family: monospace; font-size: 11px; color: #334155;" dir="ltr">${escapeHtml(inv.customer_phone)}</div>` : ''}
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">نوع العميل: ${inv.customer_is_permanent === 1 ? 'عميل دائم مسجل' : 'عميل زيارة فردية / مؤقت'}</div>
        </div>
        <div>
          <div style="font-size: 10px; font-weight: bold; color: #64748b; margin-bottom: 4px;">بيانات المركبة (Vehicle):</div>
          <div style="font-family: monospace; font-size: 13px; font-weight: bold; background: #020617; color: #fde047; display: inline-block; padding: 2px 8px; border-radius: 4px;">
            ${escapeHtml(inv.vehicle_plate || '—')}
          </div>
          ${(inv.vehicle_make || inv.vehicle_model) ? `<div style="font-size: 11px; color: #334155; margin-top: 4px;">${escapeHtml([inv.vehicle_make, inv.vehicle_model, inv.vehicle_year].filter(Boolean).join(' '))}</div>` : ''}
          ${inv.vehicle_vin ? `<div style="font-size: 11px; font-family: monospace; font-weight: bold; color: #020617; margin-top: 4px;">رقم الشاصي (VIN): <span dir="ltr">${escapeHtml(inv.vehicle_vin)}</span></div>` : ''}
          ${inv.notes ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">ملاحظات: ${escapeHtml(inv.notes)}</div>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 5%; text-align: center;">#</th>
            <th style="width: 14%; text-align: center;">النوع</th>
            <th style="width: 41%; text-align: right;">البيان / الخدمة / الصنف</th>
            <th style="width: 14%; text-align: center;">الكمية والوحدة</th>
            <th style="width: 13%; text-align: left;">سعر الوحدة</th>
            <th style="width: 13%; text-align: left;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="totals-container">
        <div class="totals-box">
          <div class="totals-row">
            <span>إجمالي قطع الغيار والمواد:</span>
            <span style="font-family: monospace; font-weight: bold;">${formatOMRStr(inv.subtotal_parts_baisa)}</span>
          </div>
          <div class="totals-row">
            <span>إجمالي أجور اليد والخدمات:</span>
            <span style="font-family: monospace; font-weight: bold;">${formatOMRStr(inv.subtotal_labor_baisa)}</span>
          </div>
          ${inv.discount_baisa > 0 ? `
            <div class="totals-row" style="color: #047857; font-weight: bold;">
              <span>الخصم الممنوح:</span>
              <span style="font-family: monospace;">- ${formatOMRStr(inv.discount_baisa)}</span>
            </div>
          ` : ''}
          <div class="totals-row" style="border-top: 1px solid #cbd5e1; padding-top: 4px; font-weight: bold; color: #0f172a; background: #e2e8f0; padding: 4px; border-radius: 4px;">
            <span>السعر قبل الضريبة (المجموع الخالي من الضريبة):</span>
            <span style="font-family: monospace;">${formatOMRStr(Math.max(0, inv.subtotal_parts_baisa + inv.subtotal_labor_baisa - (inv.discount_baisa || 0)))}</span>
          </div>
          <div class="totals-row" style="padding-top: 4px;">
            <span>ضريبة القيمة المضافة (${inv.tax_rate_percent}% VAT):</span>
            <span style="font-family: monospace; font-weight: bold;">${formatOMRStr(inv.tax_amount_baisa)}</span>
          </div>
          <div class="totals-final">
            <span>${isQuotation ? 'المجموع الإجمالي لعرض السعر:' : 'المجموع شامل الضريبة (Grand Total):'}</span>
            <span style="font-family: monospace; color: #b45309;">${formatOMRStr(inv.grand_total_baisa)}</span>
          </div>
          ${!isQuotation ? `
            <div class="totals-row" style="border-top: 1px solid #e2e8f0; padding-top: 4px; color: #047857;">
              <span>المدفوع:</span>
              <span style="font-family: monospace; font-weight: bold;">${formatOMRStr(inv.paid_amount_baisa)}</span>
            </div>
            <div class="totals-row" style="font-weight: bold; color: ${inv.balance_due_baisa > 0 ? '#b91c1c' : '#047857'};">
              <span>المتبقي:</span>
              <span style="font-family: monospace;">${formatOMRStr(inv.balance_due_baisa)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="footer">
        <div>
          <p style="margin: 0; font-weight: bold;">شكرًا لاختياركم الرواحي للعناية بالسيارات.</p>
          <p style="margin: 2px 0 0 0;">${isQuotation ? 'عرض السعر سارٍ لمدة 15 يوماً من تاريخ الإصدار ويخضع لتوافر قطع الغيار.' : 'الضمان يسري وفق الشروط المدونة في أمر الإصلاح. لا تُقبل أي مطالبات بدون إبراز أصل الفاتورة.'}</p>
        </div>
        <div style="text-align: center;">
          <div style="width: 140px; border-bottom: 1px dashed #94a3b8; height: 35px; margin-bottom: 4px;"></div>
          <span>${isQuotation ? 'اعتماد العميل / المشرف' : 'توقيع المستلم / المحاسب'}</span>
        </div>
      </div>
    </body>
    </html>
  `;
}
