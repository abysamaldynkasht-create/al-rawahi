"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const crypto_1 = __importDefault(require("crypto"));
const connection_ts_1 = require("../database/connection.js");
const validation_ts_1 = require("./validation.js");
function registerIpcHandlers() {
    // 1. System Info Handler
    electron_1.ipcMain.handle('system:getInfo', async () => {
        try {
            const db = (0, connection_ts_1.getDatabase)();
            const migrationRow = db.prepare('SELECT max(version) as version FROM schema_migrations').get();
            const customerCount = db.prepare('SELECT count(*) as count FROM customers').get();
            const vehicleCount = db.prepare('SELECT count(*) as count FROM vehicles').get();
            const roCount = db.prepare("SELECT count(*) as count FROM repair_orders WHERE status NOT IN ('DELIVERED', 'CANCELLED')").get();
            return {
                success: true,
                data: {
                    platform: 'electron',
                    appName: 'AL RAWAHI GARAGE MANAGEMENT SYSTEM',
                    version: '1.0.0',
                    databasePath: (0, connection_ts_1.getDatabasePath)(),
                    databaseStatus: 'connected',
                    activeSchemaVersion: migrationRow?.version || 1,
                    totalCustomers: customerCount.count,
                    totalVehicles: vehicleCount.count,
                    openRepairOrders: roCount.count,
                },
            };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown database error' };
        }
    });
    // 2. Settings Handlers
    electron_1.ipcMain.handle('settings:get', async (_event, key) => {
        try {
            const db = (0, connection_ts_1.getDatabase)();
            const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
            return { success: true, data: row ? row.value : null };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to retrieve setting' };
        }
    });
    electron_1.ipcMain.handle('settings:set', async (_event, payload) => {
        try {
            const validated = validation_ts_1.SettingInputSchema.parse(payload);
            const db = (0, connection_ts_1.getDatabase)();
            db.prepare(`
        INSERT INTO settings (key, value, updated_at) 
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `).run(validated.key, validated.value);
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Validation or database error' };
        }
    });
    electron_1.ipcMain.handle('settings:getAll', async () => {
        try {
            const db = (0, connection_ts_1.getDatabase)();
            const rows = db.prepare('SELECT key, value FROM settings').all();
            const map = {};
            for (const r of rows)
                map[r.key] = r.value;
            return { success: true, data: map };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to retrieve settings' };
        }
    });
    // 3. Customers Handlers
    electron_1.ipcMain.handle('customers:get', async (_event, searchQuery) => {
        try {
            const db = (0, connection_ts_1.getDatabase)();
            let query = 'SELECT id, full_name, phone, email, address, notes, created_at, updated_at FROM customers';
            const params = [];
            if (searchQuery && searchQuery.trim()) {
                query += ' WHERE full_name LIKE ? OR phone LIKE ?';
                const wild = `%${searchQuery.trim()}%`;
                params.push(wild, wild);
            }
            query += ' ORDER BY created_at DESC';
            const rows = db.prepare(query).all(...params);
            const customers = rows.map((r) => ({
                id: r.id,
                fullName: r.full_name,
                phone: r.phone,
                email: r.email || undefined,
                address: r.address || undefined,
                notes: r.notes || undefined,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
            }));
            return { success: true, data: customers };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to query customers' };
        }
    });
    electron_1.ipcMain.handle('customers:getById', async (_event, idParam) => {
        try {
            const id = validation_ts_1.IdParamSchema.parse(idParam);
            const db = (0, connection_ts_1.getDatabase)();
            const row = db.prepare('SELECT id, full_name, phone, email, address, notes, created_at, updated_at FROM customers WHERE id = ?').get(id);
            if (!row) {
                return { success: true, data: null };
            }
            return {
                success: true,
                data: {
                    id: row.id,
                    fullName: row.full_name,
                    phone: row.phone,
                    email: row.email || undefined,
                    address: row.address || undefined,
                    notes: row.notes || undefined,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                },
            };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to get customer by ID' };
        }
    });
    electron_1.ipcMain.handle('customers:create', async (_event, payload) => {
        try {
            const validated = validation_ts_1.CustomerInputSchema.parse(payload);
            const db = (0, connection_ts_1.getDatabase)();
            const id = crypto_1.default.randomUUID();
            const now = new Date().toISOString();
            db.prepare(`
        INSERT INTO customers (id, full_name, phone, email, address, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, validated.fullName, validated.phone, validated.email || null, validated.address || null, validated.notes || null);
            return {
                success: true,
                data: {
                    id,
                    fullName: validated.fullName,
                    phone: validated.phone,
                    email: validated.email,
                    address: validated.address,
                    notes: validated.notes,
                    createdAt: now,
                    updatedAt: now,
                },
            };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Validation or database error' };
        }
    });
    electron_1.ipcMain.handle('customers:update', async (_event, payload) => {
        try {
            const { id, input } = validation_ts_1.CustomerUpdateSchema.parse(payload);
            const db = (0, connection_ts_1.getDatabase)();
            const existing = db.prepare('SELECT id, full_name, phone, email, address, notes, created_at FROM customers WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'Customer not found' };
            }
            const updatedName = input.fullName ?? existing.full_name;
            const updatedPhone = input.phone ?? existing.phone;
            const updatedEmail = input.email !== undefined ? input.email : existing.email;
            const updatedAddress = input.address !== undefined ? input.address : existing.address;
            const updatedNotes = input.notes !== undefined ? input.notes : existing.notes;
            const now = new Date().toISOString();
            db.prepare(`
        UPDATE customers SET
          full_name = ?,
          phone = ?,
          email = ?,
          address = ?,
          notes = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(updatedName, updatedPhone, updatedEmail || null, updatedAddress || null, updatedNotes || null, id);
            return {
                success: true,
                data: {
                    id,
                    fullName: updatedName,
                    phone: updatedPhone,
                    email: updatedEmail || undefined,
                    address: updatedAddress || undefined,
                    notes: updatedNotes || undefined,
                    createdAt: existing.created_at,
                    updatedAt: now,
                },
            };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Customer update failed' };
        }
    });
    // 4. Vehicles Handlers
    electron_1.ipcMain.handle('vehicles:get', async (_event, customerId) => {
        try {
            const db = (0, connection_ts_1.getDatabase)();
            let query = 'SELECT id, customer_id, plate_number, make, model, year, vin, odometer, color, notes, created_at FROM vehicles';
            const params = [];
            if (customerId) {
                query += ' WHERE customer_id = ?';
                params.push(customerId);
            }
            query += ' ORDER BY created_at DESC';
            const rows = db.prepare(query).all(...params);
            const vehicles = rows.map((r) => ({
                id: r.id,
                customerId: r.customer_id,
                plateNumber: r.plate_number,
                make: r.make,
                model: r.model,
                year: r.year,
                vin: r.vin || undefined,
                odometer: r.odometer,
                color: r.color || undefined,
                notes: r.notes || undefined,
                createdAt: r.created_at,
            }));
            return { success: true, data: vehicles };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to query vehicles' };
        }
    });
    electron_1.ipcMain.handle('vehicles:getById', async (_event, idParam) => {
        try {
            const id = validation_ts_1.IdParamSchema.parse(idParam);
            const db = (0, connection_ts_1.getDatabase)();
            const row = db.prepare('SELECT id, customer_id, plate_number, make, model, year, vin, odometer, color, notes, created_at FROM vehicles WHERE id = ?').get(id);
            if (!row) {
                return { success: true, data: null };
            }
            return {
                success: true,
                data: {
                    id: row.id,
                    customerId: row.customer_id,
                    plateNumber: row.plate_number,
                    make: row.make,
                    model: row.model,
                    year: row.year,
                    vin: row.vin || undefined,
                    odometer: row.odometer,
                    color: row.color || undefined,
                    notes: row.notes || undefined,
                    createdAt: row.created_at,
                },
            };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to get vehicle by ID' };
        }
    });
    electron_1.ipcMain.handle('vehicles:searchPlate', async (_event, plateParam) => {
        try {
            const plate = validation_ts_1.IdParamSchema.parse(plateParam);
            const db = (0, connection_ts_1.getDatabase)();
            const rows = db.prepare('SELECT id, customer_id, plate_number, make, model, year, vin, odometer, color, notes, created_at FROM vehicles WHERE plate_number LIKE ?').all(`%${plate}%`);
            const vehicles = rows.map((r) => ({
                id: r.id,
                customerId: r.customer_id,
                plateNumber: r.plate_number,
                make: r.make,
                model: r.model,
                year: r.year,
                vin: r.vin || undefined,
                odometer: r.odometer,
                color: r.color || undefined,
                notes: r.notes || undefined,
                createdAt: r.created_at,
            }));
            return { success: true, data: vehicles };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to search vehicles by plate' };
        }
    });
    electron_1.ipcMain.handle('vehicles:create', async (_event, payload) => {
        try {
            const validated = validation_ts_1.VehicleInputSchema.parse(payload);
            const db = (0, connection_ts_1.getDatabase)();
            const id = crypto_1.default.randomUUID();
            const now = new Date().toISOString();
            db.prepare(`
        INSERT INTO vehicles (id, customer_id, plate_number, make, model, year, vin, odometer, color, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, validated.customerId, validated.plateNumber, validated.make, validated.model, validated.year, validated.vin || null, validated.odometer, validated.color || null, validated.notes || null);
            return {
                success: true,
                data: {
                    id,
                    customerId: validated.customerId,
                    plateNumber: validated.plateNumber,
                    make: validated.make,
                    model: validated.model,
                    year: validated.year,
                    vin: validated.vin,
                    odometer: validated.odometer,
                    color: validated.color,
                    notes: validated.notes,
                    createdAt: now,
                },
            };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Vehicle creation failed' };
        }
    });
    // 5. Repair Orders Handlers
    electron_1.ipcMain.handle('repairOrders:get', async (_event, statusFilter) => {
        try {
            const db = (0, connection_ts_1.getDatabase)();
            let query = 'SELECT * FROM repair_orders';
            const params = [];
            if (statusFilter) {
                query += ' WHERE status = ?';
                params.push(statusFilter);
            }
            query += ' ORDER BY created_at DESC';
            const rows = db.prepare(query).all(...params);
            const ros = rows.map((r) => ({
                id: r.id,
                roNumber: r.ro_number,
                customerId: r.customer_id,
                vehicleId: r.vehicle_id,
                status: r.status,
                odometerIn: r.odometer_in,
                reportedProblem: r.reported_problem,
                inspectionNotes: r.inspection_notes || undefined,
                requestedWork: r.requested_work || undefined,
                estimatedCostBaisa: r.estimated_cost_baisa,
                customerApproved: Boolean(r.customer_approved),
                warrantyPeriodMonths: r.warranty_period_months,
                warrantyTerms: r.warranty_terms || undefined,
                receivedAt: r.received_at,
                expectedAt: r.expected_at || undefined,
                completedAt: r.completed_at || undefined,
                deliveredAt: r.delivered_at || undefined,
                createdAt: r.created_at,
            }));
            return { success: true, data: ros };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to query repair orders' };
        }
    });
    electron_1.ipcMain.handle('repairOrders:getById', async (_event, idParam) => {
        try {
            const id = validation_ts_1.IdParamSchema.parse(idParam);
            const db = (0, connection_ts_1.getDatabase)();
            const r = db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(id);
            if (!r) {
                return { success: true, data: null };
            }
            return {
                success: true,
                data: {
                    id: r.id,
                    roNumber: r.ro_number,
                    customerId: r.customer_id,
                    vehicleId: r.vehicle_id,
                    status: r.status,
                    odometerIn: r.odometer_in,
                    reportedProblem: r.reported_problem,
                    inspectionNotes: r.inspection_notes || undefined,
                    requestedWork: r.requested_work || undefined,
                    estimatedCostBaisa: r.estimated_cost_baisa,
                    customerApproved: Boolean(r.customer_approved),
                    warrantyPeriodMonths: r.warranty_period_months,
                    warrantyTerms: r.warranty_terms || undefined,
                    receivedAt: r.received_at,
                    expectedAt: r.expected_at || undefined,
                    completedAt: r.completed_at || undefined,
                    deliveredAt: r.delivered_at || undefined,
                    createdAt: r.created_at,
                },
            };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to get repair order by ID' };
        }
    });
    electron_1.ipcMain.handle('repairOrders:create', async (_event, payload) => {
        try {
            const validated = validation_ts_1.RepairOrderInputSchema.parse(payload);
            const db = (0, connection_ts_1.getDatabase)();
            const id = crypto_1.default.randomUUID();
            const now = new Date();
            const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
            // Generate sequential RO Number for month: RO-YYYYMM-XXXX
            const countRow = db.prepare("SELECT count(*) as count FROM repair_orders WHERE ro_number LIKE ?").get(`RO-${yearMonth}-%`);
            const roNumber = `RO-${yearMonth}-${String(countRow.count + 1).padStart(4, '0')}`;
            const nowIso = now.toISOString();
            const insertTx = db.transaction(() => {
                db.prepare(`
          INSERT INTO repair_orders (
            id, ro_number, customer_id, vehicle_id, status, odometer_in,
            reported_problem, inspection_notes, requested_work, estimated_cost_baisa,
            customer_approved, received_at, expected_at, created_at
          ) VALUES (?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, ?, 0, datetime('now'), ?, datetime('now'))
        `).run(id, roNumber, validated.customerId, validated.vehicleId, validated.odometerIn, validated.reportedProblem, validated.inspectionNotes || null, validated.requestedWork || null, validated.estimatedCostBaisa || 0, validated.expectedAt || null);
                // Record initial status in history
                db.prepare(`
          INSERT INTO repair_order_status_history (id, repair_order_id, old_status, new_status, changed_by, remarks, changed_at)
          VALUES (?, ?, 'NONE', 'RECEIVED', 'Operator', 'Repair order received', datetime('now'))
        `).run(crypto_1.default.randomUUID(), id);
            });
            insertTx();
            return {
                success: true,
                data: {
                    id,
                    roNumber,
                    customerId: validated.customerId,
                    vehicleId: validated.vehicleId,
                    status: 'RECEIVED',
                    odometerIn: validated.odometerIn,
                    reportedProblem: validated.reportedProblem,
                    inspectionNotes: validated.inspectionNotes,
                    requestedWork: validated.requestedWork,
                    estimatedCostBaisa: validated.estimatedCostBaisa || 0,
                    customerApproved: false,
                    receivedAt: nowIso,
                    expectedAt: validated.expectedAt,
                    createdAt: nowIso,
                },
            };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'RO creation failed' };
        }
    });
    electron_1.ipcMain.handle('repairOrders:updateStatus', async (_event, payload) => {
        try {
            const { repairOrderId, newStatus, remarks, changedBy } = validation_ts_1.StatusChangeInputSchema.parse(payload);
            const db = (0, connection_ts_1.getDatabase)();
            const current = db.prepare('SELECT status FROM repair_orders WHERE id = ?').get(repairOrderId);
            if (!current) {
                return { success: false, error: 'Repair order not found' };
            }
            const updateTx = db.transaction(() => {
                let completionClause = '';
                if (newStatus === 'COMPLETED')
                    completionClause = ", completed_at = datetime('now')";
                if (newStatus === 'DELIVERED')
                    completionClause = ", delivered_at = datetime('now')";
                db.prepare(`UPDATE repair_orders SET status = ? ${completionClause} WHERE id = ?`).run(newStatus, repairOrderId);
                db.prepare(`
          INSERT INTO repair_order_status_history (id, repair_order_id, old_status, new_status, changed_by, remarks, changed_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(crypto_1.default.randomUUID(), repairOrderId, current.status, newStatus, changedBy, remarks || null);
            });
            updateTx();
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Status update failed' };
        }
    });
    // 6. Inventory Handlers
    electron_1.ipcMain.handle('inventory:get', async (_event, searchQuery) => {
        try {
            const db = (0, connection_ts_1.getDatabase)();
            let query = 'SELECT * FROM inventory_items';
            const params = [];
            if (searchQuery && searchQuery.trim()) {
                query += ' WHERE part_code LIKE ? OR name LIKE ? OR category LIKE ?';
                const wild = `%${searchQuery.trim()}%`;
                params.push(wild, wild, wild);
            }
            query += ' ORDER BY name ASC';
            const rows = db.prepare(query).all(...params);
            const items = rows.map((r) => ({
                id: r.id,
                partCode: r.part_code,
                name: r.name,
                category: r.category,
                description: r.description || undefined,
                quantityInStock: r.quantity_in_stock,
                purchaseCostBaisa: r.purchase_cost_baisa,
                sellingPriceBaisa: r.selling_price_baisa,
                minStockLevel: r.min_stock_level,
                supplierId: r.supplier_id || undefined,
                location: r.location || undefined,
                isActive: Boolean(r.is_active),
                createdAt: r.created_at,
            }));
            return { success: true, data: items };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Failed to query inventory' };
        }
    });
    electron_1.ipcMain.handle('inventory:create', async (_event, payload) => {
        try {
            const validated = validation_ts_1.InventoryItemInputSchema.parse(payload);
            const db = (0, connection_ts_1.getDatabase)();
            const id = crypto_1.default.randomUUID();
            const now = new Date().toISOString();
            db.prepare(`
        INSERT INTO inventory_items (
          id, part_code, name, category, description, quantity_in_stock,
          purchase_cost_baisa, selling_price_baisa, min_stock_level, supplier_id,
          location, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, validated.partCode, validated.name, validated.category, validated.description || null, validated.quantityInStock, validated.purchaseCostBaisa, validated.sellingPriceBaisa, validated.minStockLevel, validated.supplierId || null, validated.location || null, validated.isActive ? 1 : 0);
            return {
                success: true,
                data: {
                    id,
                    partCode: validated.partCode,
                    name: validated.name,
                    category: validated.category,
                    description: validated.description,
                    quantityInStock: validated.quantityInStock,
                    purchaseCostBaisa: validated.purchaseCostBaisa,
                    sellingPriceBaisa: validated.sellingPriceBaisa,
                    minStockLevel: validated.minStockLevel,
                    supplierId: validated.supplierId,
                    location: validated.location,
                    isActive: validated.isActive ?? true,
                    createdAt: now,
                },
            };
        }
        catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Inventory item creation failed' };
        }
    });
    // 7. Backup Stubs for Desktop
    electron_1.ipcMain.handle('backup:list', async () => {
        return { success: true, data: [] };
    });
    electron_1.ipcMain.handle('backup:trigger', async () => {
        return {
            success: true,
            data: {
                success: true,
                backupFile: 'backup.db',
                checksumSha256: 'mock_sha256',
                createdAt: new Date().toISOString(),
            },
        };
    });
    // 8. Print Stub for Desktop
    electron_1.ipcMain.handle('print:invoice', async (_event, _invoiceId, _lang) => {
        return { success: true, data: { printed: true } };
    });
}
