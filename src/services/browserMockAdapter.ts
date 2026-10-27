/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Browser Preview Adapter (Google AI Studio Development Mode)
 * 
 * IMPORTANT NOTICE:
 * This adapter runs strictly in web browser environments (such as AI Studio preview).
 * It simulates the desktop GarageApi contract using in-memory / localStorage storage.
 * It NEVER claims to be or interacts with the real Windows SQLite database.
 */

import type {
  GarageApi,
  IpcResult,
  SystemInfo,
  CustomerDTO,
  CustomerInput,
  VehicleDTO,
  VehicleInput,
  VehicleFilter,
  RepairOrderDTO,
  RepairOrderInput,
  RepairOrderStatus,
  StatusChangeInput,
  LaborTaskDTO,
  LaborTaskInput,
  RepairOrderPartDTO,
  IssuePartInput,
  ReturnPartInput,
  RepairOrderCustomerApprovalInput,
  RepairOrderStatusHistoryDTO,
  TechnicianDTO,
  InventoryItemDTO,
  InventoryItemInput,
  InventorySerialDTO,
  InventorySerialInput,
  InventoryMovementDTO,
  InventoryAdjustmentInput,
  CreateInvoiceFromROInput,
  InvoiceDTO,
  InvoiceInput,
  PaymentInput,
  PaymentResult,
  PaymentDTO,
  TechnicianInput,
  SupplierDTO,
  SupplierInput,
  ExpenseDTO,
  ExpenseInput,
  FinancialReportDTO,
  PrintResult,
  BackupRecord,
  BackupResult,
  LoginInput,
  ChangeCredentialsInput,
  AuthSessionDTO,
  PrinterInfoDTO,
  WorkerOvertimeEntryDTO,
  WorkerOvertimeInput,
  WorkerOvertimeUpdateInput,
  InvoiceItemDTO,
  WorkerMonthlyPayrollDTO,
  GeneratePayrollInput,
  FinalizePayrollInput,
  WorkerLaborProductivityDTO,
  LaborAllocationInput,
} from '../types/ipc.ts';

function normalizePlate(plate: string): string {
  return plate.trim().replace(/\s+/g, ' ').toUpperCase();
}

// Deterministic in-memory storage seeded for immediate visual preview
const STORAGE_PREFIX = 'al_rawahi_preview_';

class BrowserMockAdapter implements GarageApi {
  private inMemoryFallback = new Map<string, unknown>();

  private getStorage<T>(key: string, defaultValue: T): T {
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        const stored = localStorage.getItem(STORAGE_PREFIX + key);
        if (stored) return JSON.parse(stored);
      }
      if (this.inMemoryFallback.has(key)) {
        return this.inMemoryFallback.get(key) as T;
      }
      return defaultValue;
    } catch {
      if (this.inMemoryFallback.has(key)) {
        return this.inMemoryFallback.get(key) as T;
      }
      return defaultValue;
    }
  }

  private setStorage<T>(key: string, value: T): void {
    this.inMemoryFallback.set(key, value);
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      }
    } catch (e) {
      // ignore storage error in non-browser env
    }
  }

  constructor() {
    this.seedIfEmpty();
  }

  private seedIfEmpty(): void {
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    if (customers.length === 0) {
      const initialCustomers: CustomerDTO[] = [
        {
          id: 'cust-1',
          fullName: 'سالم بن حمد الرواحي (Salim Al Rawahi)',
          phone: '+968 91234567',
          altPhone: '+968 24567890',
          email: 'salim.rawahi@example.om',
          address: 'مسقط، سلطنة عُمان (Muscat, Oman)',
          notes: 'عميل دائم - صيانة دورية لمركبات العائلة',
          isActive: true,
          isPermanent: true,
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
          id: 'cust-2',
          fullName: 'محمد بن علي الحارثي (Mohammed Al Harthy)',
          phone: '+968 99887766',
          altPhone: '',
          email: 'm.harthy@example.om',
          address: 'السيب، مسقط (Seeb, Muscat)',
          notes: 'إصلاحات فرامل وفحص دوري',
          isActive: true,
          isPermanent: true,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: 'cust-3',
          fullName: 'طارق بن عبدالله المعولي (Tariq Al Mawali)',
          phone: '+968 94561234',
          altPhone: '+968 98761122',
          email: 'tariq.m@example.om',
          address: 'بركاء، جنوب الباطنة (Barka, South Batinah)',
          notes: 'متابع لأسعار القطع وزيوت المحركات',
          isActive: true,
          isPermanent: true,
          createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
        },
        {
          id: 'cust-4',
          fullName: 'خالد بن ناصر السعدي (Khalid Al Saadi)',
          phone: '+968 95551234',
          altPhone: '',
          email: 'khalid.saadi@example.om',
          address: 'الخوض، مسقط (Al Khoudh, Muscat)',
          notes: 'عميل زيارة فردية - تغيير زيت وفلتر',
          isActive: true,
          isPermanent: false,
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        },
      ];
      this.setStorage('customers', initialCustomers);

      const initialVehicles: VehicleDTO[] = [
        {
          id: 'veh-1',
          customerId: 'cust-1',
          customerName: 'سالم بن حمد الرواحي (Salim Al Rawahi)',
          customerPhone: '+968 91234567',
          plateNumber: '12345 A (ع)',
          make: 'Toyota',
          model: 'Land Cruiser Prado',
          year: 2022,
          vin: 'JTEBU5JR2N5123456',
          odometer: 48500,
          color: 'أبيض لؤلؤي (Pearl White)',
          notes: 'صيانة دورية 50 ألف كم',
          isActive: true,
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
          id: 'veh-4',
          customerId: 'cust-4',
          customerName: 'خالد بن ناصر السعدي (Khalid Al Saadi)',
          customerPhone: '+968 95551234',
          plateNumber: '54321 C (د)',
          make: 'Mazda',
          model: 'CX-9',
          year: 2021,
          vin: 'JM3TB3CA2M0123456',
          odometer: 62000,
          color: 'رمادي ميتاليك (Metallic Grey)',
          notes: 'زيارة سريعة لتغيير الزيت',
          isActive: true,
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        },
        {
          id: 'veh-2',
          customerId: 'cust-2',
          customerName: 'محمد بن علي الحارثي (Mohammed Al Harthy)',
          customerPhone: '+968 99887766',
          plateNumber: '98765 B (ب)',
          make: 'Nissan',
          model: 'Patrol Platinum V8',
          year: 2021,
          vin: 'JN8AY2NC3M987654',
          odometer: 72300,
          color: 'رمادي غامق (Dark Grey)',
          notes: 'فحص دوري واستبدال فحمات فرامل',
          isActive: true,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: 'veh-3',
          customerId: 'cust-1',
          customerName: 'سالم بن حمد الرواحي (Salim Al Rawahi)',
          customerPhone: '+968 91234567',
          plateNumber: '55441 D (د)',
          make: 'Lexus',
          model: 'LX 600 VIP',
          year: 2023,
          vin: 'JTJHY7AX8P4554411',
          odometer: 19800,
          color: 'أسود ملوكي (Royal Black)',
          notes: 'فحص كهرباء ومكيف دوري',
          isActive: true,
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
      ];
      this.setStorage('vehicles', initialVehicles);

      const initialTechnicians: TechnicianDTO[] = [
        {
          id: 'tech-1',
          name: 'أحمد الشامسي (Ahmed Al Shamsi)',
          phone: '+968 92001122',
          specialty: 'ميكانيكا عامة ومحركات (Engine & Mechanical)',
          isActive: true,
          notes: 'فني أول ميكانيكا',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tech-2',
          name: 'كمال الدين مصطفى (Kamal Mustafa)',
          phone: '+968 93003344',
          specialty: 'كهرباء وفحص كمبيوتر (Electrical & Diagnostics)',
          isActive: true,
          notes: 'خبير برمجة وكهرباء مركبات',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tech-3',
          name: 'راجيش كومار (Rajesh Kumar)',
          phone: '+968 94005566',
          specialty: 'فرامل وميزانية ونظام تعليق (Brakes & Suspension)',
          isActive: true,
          notes: 'أخصائي فرامل وهيدروليك',
          createdAt: new Date().toISOString(),
        },
      ];
      this.setStorage('technicians', initialTechnicians);

      const initialROs: RepairOrderDTO[] = [
        {
          id: 'ro-1',
          roNumber: 'RO-202610-0001',
          customerId: 'cust-1',
          vehicleId: 'veh-1',
          status: 'IN_PROGRESS',
          odometerIn: 48500,
          reportedProblem: 'صوت صرير عند الضغط على الفرامل مع اهتزاز خفيف',
          inspectionNotes: 'تآكل فحمات الفرامل الأمامية وحاجة لخرط الهوبات',
          requestedWork: 'استبدال فحمات فرامل أمامية أصلية + خرط هوبات + فحص زيت الفرامل',
          estimatedCostBaisa: 42500, // 42.500 OMR
          partsTotalBaisa: 26500,
          laborTotalBaisa: 14000,
          taxAmountBaisa: 2025,
          grandTotalBaisa: 42525,
          customerApproved: true,
          approvalStatus: 'APPROVED',
          approvedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          assignedTechnicianId: 'tech-3',
          assignedTechnicianName: 'راجيش كومار (Rajesh Kumar)',
          warrantyPeriodMonths: 3,
          warrantyTerms: 'ضمان 3 أشهر على القطع الأصلية وأجور اليد',
          receivedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
      ];
      this.setStorage('repair_orders', initialROs);

      const initialLaborTasks: LaborTaskDTO[] = [
        {
          id: 'task-1',
          repairOrderId: 'ro-1',
          technicianId: 'tech-3',
          technicianName: 'راجيش كومار (Rajesh Kumar)',
          description: 'فك واستبدال فحمات الفرامل الأمامية وخرط الهوبات بالمخرطة (Replace Front Brake Pads & Rotor Resurfacing)',
          hours: 2.0,
          hourlyRateBaisa: 7000,
          laborChargeBaisa: 14000,
          internalCostBaisa: 6000,
          isApproved: true,
          status: 'IN_PROGRESS',
          workDate: new Date().toISOString().slice(0, 10),
          notes: 'تم فحص سماكة الهوبات والتأكد من مطابقتها لمعايير الأمان',
        },
      ];
      this.setStorage('labor_tasks', initialLaborTasks);

      const initialInventory: InventoryItemDTO[] = [
        {
          id: 'part-1',
          partCode: '04465-60320',
          name: 'فحمات فرامل أمامية - تويوتا لاندكروزر برادو (Front Brake Pads)',
          category: 'الفرامل (Brakes)',
          manufacturer: 'Toyota Genuine',
          description: 'قطع غيار تويوتا أصلية وكالة',
          quantityInStock: 8,
          purchaseCostBaisa: 18000, // 18.000 OMR
          sellingPriceBaisa: 26500, // 26.500 OMR
          minStockLevel: 3,
          location: 'الرف A-03',
          isSerialized: false,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'part-2',
          partCode: '90915-YZZD4',
          name: 'فلتر زيت محرك أصلي (Engine Oil Filter)',
          category: 'زيوت وفلاتر (Lubrication)',
          manufacturer: 'Toyota Genuine',
          description: 'فلتر زيت محرك سيارات تويوتا 6 سلندر و 8 سلندر',
          quantityInStock: 25,
          purchaseCostBaisa: 2200, // 2.200 OMR
          sellingPriceBaisa: 3500, // 3.500 OMR
          minStockLevel: 5,
          location: 'الرف B-01',
          isSerialized: false,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'part-3',
          partCode: 'OIL-5W30-4L',
          name: 'زيت محرك تخليقي بالكامل 5W-30 عبوة 4 لتر',
          category: 'زيوت وفلاتر (Lubrication)',
          manufacturer: 'Mobil 1 / Toyota',
          description: 'زيت محرك تويوتا تخليقي أصلي',
          quantityInStock: 12,
          purchaseCostBaisa: 9500, // 9.500 OMR
          sellingPriceBaisa: 14000, // 14.000 OMR
          minStockLevel: 4,
          location: 'الرف B-04',
          isSerialized: false,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'part-4',
          partCode: 'DENSO-ALT-3920',
          name: 'دينامو شحن أصلي - لكزس / لاندكروزر (Alternator 130A)',
          category: 'الكهرباء (Electrical)',
          manufacturer: 'Denso Japan',
          description: 'دينامو أصلي مع رقم تسلسلي مسجل وضمان 6 أشهر',
          quantityInStock: 3,
          purchaseCostBaisa: 65000, // 65.000 OMR
          sellingPriceBaisa: 88000, // 88.000 OMR
          minStockLevel: 1,
          location: 'الخزينة C-02',
          isSerialized: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ];
      this.setStorage('inventory', initialInventory);

      const initialSerials: InventorySerialDTO[] = [
        {
          id: 'sn-1',
          itemId: 'part-4',
          serialNumber: 'DNS-2026-98441',
          status: 'IN_STOCK',
          itemName: 'دينامو شحن أصلي - لكزس / لاندكروزر (Alternator 130A)',
          partCode: 'DENSO-ALT-3920',
          receivedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: 'sn-2',
          itemId: 'part-4',
          serialNumber: 'DNS-2026-98442',
          status: 'IN_STOCK',
          itemName: 'دينامو شحن أصلي - لكزس / لاندكروزر (Alternator 130A)',
          partCode: 'DENSO-ALT-3920',
          receivedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
      ];
      this.setStorage('inventory_serials', initialSerials);

      const initialROParts: RepairOrderPartDTO[] = [
        {
          id: 'ro-part-1',
          repairOrderId: 'ro-1',
          itemId: 'part-1',
          partCode: '04465-60320',
          partName: 'فحمات فرامل أمامية - تويوتا لاندكروزر برادو (Front Brake Pads)',
          quantity: 1,
          unitPriceBaisa: 26500,
          unitCostBaisa: 18000,
          totalPriceBaisa: 26500,
          isApproved: true,
          status: 'ISSUED',
          issuedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
      ];
      this.setStorage('repair_order_parts', initialROParts);

      const initialMovements: InventoryMovementDTO[] = [
        {
          id: 'mov-1',
          itemId: 'part-1',
          itemName: 'فحمات فرامل أمامية - تويوتا لاندكروزر برادو (Front Brake Pads)',
          partCode: '04465-60320',
          movementType: 'RO_ISSUE',
          quantityDelta: -1,
          unitCostBaisa: 18000,
          referenceType: 'REPAIR_ORDER',
          referenceId: 'ro-1',
          reason: 'صرف لأمر الإصلاح RO-202610-0001',
          createdBy: 'المشرف (Supervisor)',
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
      ];
      this.setStorage('inventory_movements', initialMovements);
    }
  }

  async getSystemInfo(): Promise<IpcResult<SystemInfo>> {
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);

    return {
      success: true,
      data: {
        platform: 'browser-mock',
        appName: 'AL RAWAHI GARAGE MANAGEMENT SYSTEM (Browser Preview)',
        version: '1.0.0-preview',
        databaseStatus: 'mock-active',
        activeSchemaVersion: 2,
        totalCustomers: customers.filter((c) => c.isActive !== false).length,
        totalVehicles: vehicles.filter((v) => v.isActive !== false).length,
        openRepairOrders: ros.filter((r) => r.status !== 'DELIVERED' && r.status !== 'CANCELLED').length,
      },
    };
  }

  async getSetting(key: string): Promise<IpcResult<string | null>> {
    const settings = this.getStorage<Record<string, string>>('settings', {
      garage_name: 'AL RAWAHI GARAGE',
      developer: 'AKASHA AI',
      currency_code: 'OMR',
      currency_symbol_ar: 'ر.ع.',
      default_tax_rate_percent: '5.0',
      default_language: 'ar',
      invoice_language_default: 'ar',
    });
    return { success: true, data: settings[key] ?? null };
  }

  async setSetting(key: string, value: string): Promise<IpcResult<void>> {
    const settings = this.getStorage<Record<string, string>>('settings', {});
    settings[key] = value;
    this.setStorage('settings', settings);
    return { success: true };
  }

  async getAllSettings(): Promise<IpcResult<Record<string, string>>> {
    const settings = this.getStorage<Record<string, string>>('settings', {
      garage_name: 'AL RAWAHI GARAGE',
      developer: 'AKASHA AI',
      currency_code: 'OMR',
      currency_symbol_ar: 'ر.ع.',
      default_tax_rate_percent: '5.0',
      default_language: 'ar',
      invoice_language_default: 'ar',
    });
    return { success: true, data: settings };
  }

  async getCustomers(searchQuery?: string, includeArchived = false, includeTemporary = false): Promise<IpcResult<CustomerDTO[]>> {
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);

    let list = customers;
    if (!includeArchived) {
      list = list.filter((c) => c.isActive !== false);
    }

    if (!includeTemporary) {
      list = list.filter((c) => c.isPermanent !== false);
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.altPhone && c.altPhone.includes(q))
      );
    }

    const result = list.map((c) => ({
      ...c,
      isActive: c.isActive !== false,
      isPermanent: c.isPermanent !== false,
      vehicleCount: vehicles.filter((v) => v.customerId === c.id).length,
    }));

    return { success: true, data: result };
  }

  async getCustomerById(id: string): Promise<IpcResult<CustomerDTO | null>> {
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const match = customers.find((c) => c.id === id);
    if (!match) return { success: true, data: null };

    return {
      success: true,
      data: {
        ...match,
        isActive: match.isActive !== false,
        isPermanent: match.isPermanent !== false,
        vehicleCount: vehicles.filter((v) => v.customerId === match.id).length,
      },
    };
  }

  async createCustomer(input: CustomerInput): Promise<IpcResult<CustomerDTO>> {
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const now = new Date().toISOString();
    const isPermanent = input.isPermanent !== false;
    const newCustomer: CustomerDTO = {
      id: `cust-${Date.now()}`,
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() || undefined,
      altPhone: input.altPhone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      address: input.address?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      isActive: input.isActive !== false,
      isPermanent,
      createdAt: now,
      updatedAt: now,
      vehicleCount: 0,
    };
    customers.unshift(newCustomer);
    this.setStorage('customers', customers);
    return { success: true, data: newCustomer };
  }

  async updateCustomer(id: string, input: Partial<CustomerInput>): Promise<IpcResult<CustomerDTO>> {
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const index = customers.findIndex((c) => c.id === id);
    if (index === -1) {
      return { success: false, error: 'Customer not found' };
    }
    const current = customers[index];
    const updated: CustomerDTO = {
      ...current,
      fullName: input.fullName !== undefined ? input.fullName.trim() : current.fullName,
      phone: input.phone !== undefined ? input.phone.trim() : current.phone,
      altPhone: input.altPhone !== undefined ? (input.altPhone.trim() || undefined) : current.altPhone,
      email: input.email !== undefined ? (input.email.trim() || undefined) : current.email,
      address: input.address !== undefined ? (input.address.trim() || undefined) : current.address,
      notes: input.notes !== undefined ? (input.notes.trim() || undefined) : current.notes,
      isActive: input.isActive !== undefined ? input.isActive : (current.isActive !== false),
      updatedAt: new Date().toISOString(),
      vehicleCount: vehicles.filter((v) => v.customerId === id).length,
    };
    customers[index] = updated;
    this.setStorage('customers', customers);

    // Also update customer name on linked vehicles
    const updatedVehicles = vehicles.map((v) =>
      v.customerId === id ? { ...v, customerName: updated.fullName, customerPhone: updated.phone } : v
    );
    this.setStorage('vehicles', updatedVehicles);

    return { success: true, data: updated };
  }

  async archiveCustomer(id: string): Promise<IpcResult<void>> {
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const target = customers.find((c) => c.id === id);
    if (!target) return { success: false, error: 'Customer not found' };
    target.isActive = false;
    target.updatedAt = new Date().toISOString();
    this.setStorage('customers', customers);
    return { success: true };
  }

  async restoreCustomer(id: string): Promise<IpcResult<void>> {
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const target = customers.find((c) => c.id === id);
    if (!target) return { success: false, error: 'Customer not found' };
    target.isActive = true;
    target.updatedAt = new Date().toISOString();
    this.setStorage('customers', customers);
    return { success: true };
  }

  async deleteCustomer(id: string): Promise<IpcResult<void>> {
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    const hasVehicles = vehicles.some((v) => v.customerId === id);
    const hasRos = ros.some((r) => r.customerId === id);

    if (hasVehicles || hasRos) {
      return {
        success: false,
        error: 'Cannot delete customer with registered vehicles or repair orders. Please archive the customer instead to preserve history.',
        errorCode: 'CUSTOMER_HAS_LINKED_RECORDS',
      };
    }

    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    this.setStorage('customers', customers.filter((c) => c.id !== id));
    return { success: true };
  }

  async promoteCustomer(id: string): Promise<IpcResult<CustomerDTO>> {
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const target = customers.find((c) => c.id === id);
    if (!target) return { success: false, error: 'Customer not found' };

    target.isPermanent = true;
    target.updatedAt = new Date().toISOString();
    this.setStorage('customers', customers);

    return {
      success: true,
      data: {
        ...target,
        isPermanent: true,
        vehicleCount: vehicles.filter((v) => v.customerId === id).length,
      },
    };
  }

  async getVehicles(filterParam?: VehicleFilter | string): Promise<IpcResult<VehicleDTO[]>> {
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const customers = this.getStorage<CustomerDTO[]>('customers', []);

    let customerId: string | undefined;
    let searchQuery: string | undefined;
    let includeArchived = false;

    if (typeof filterParam === 'string' && filterParam.trim()) {
      customerId = filterParam.trim();
    } else if (filterParam && typeof filterParam === 'object') {
      customerId = filterParam.customerId;
      searchQuery = filterParam.searchQuery;
      includeArchived = Boolean(filterParam.includeArchived);
    }

    let list = vehicles;
    if (!includeArchived) {
      list = list.filter((v) => v.isActive !== false);
    }
    if (customerId) {
      list = list.filter((v) => v.customerId === customerId);
    }
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (v) =>
          v.plateNumber.toLowerCase().includes(q) ||
          (v.vin && v.vin.toLowerCase().includes(q)) ||
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          (v.customerName && v.customerName.toLowerCase().includes(q)) ||
          (v.customerPhone && v.customerPhone.includes(q))
      );
    }

    // Attach latest customer names and phones
    const enriched = list.map((v) => {
      const owner = customers.find((c) => c.id === v.customerId);
      return {
        ...v,
        customerName: owner ? owner.fullName : v.customerName,
        customerPhone: owner ? owner.phone : v.customerPhone,
        isActive: v.isActive !== false,
      };
    });

    return { success: true, data: enriched };
  }

  async getVehicleById(id: string): Promise<IpcResult<VehicleDTO | null>> {
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const found = vehicles.find((v) => v.id === id);
    if (!found) return { success: true, data: null };

    const owner = customers.find((c) => c.id === found.customerId);
    return {
      success: true,
      data: {
        ...found,
        customerName: owner ? owner.fullName : found.customerName,
        customerPhone: owner ? owner.phone : found.customerPhone,
        isActive: found.isActive !== false,
      },
    };
  }

  async searchVehiclesByPlate(plateNumber: string): Promise<IpcResult<VehicleDTO[]>> {
    return this.getVehicles({ searchQuery: plateNumber });
  }

  async checkVehicleDuplicates(
    plateNumber: string,
    vin?: string,
    excludeVehicleId?: string
  ): Promise<IpcResult<{ plateExists: boolean; vinExists: boolean }>> {
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const normPlate = normalizePlate(plateNumber);

    const plateExists = vehicles.some(
      (v) => normalizePlate(v.plateNumber) === normPlate && (!excludeVehicleId || v.id !== excludeVehicleId)
    );

    let vinExists = false;
    if (vin && vin.trim()) {
      const cleanVin = vin.trim().toUpperCase();
      vinExists = vehicles.some(
        (v) => v.vin && v.vin.trim().toUpperCase() === cleanVin && (!excludeVehicleId || v.id !== excludeVehicleId)
      );
    }

    return { success: true, data: { plateExists, vinExists } };
  }

  async createVehicle(input: VehicleInput): Promise<IpcResult<VehicleDTO>> {
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const customers = this.getStorage<CustomerDTO[]>('customers', []);

    const normPlate = normalizePlate(input.plateNumber);
    if (vehicles.some((v) => normalizePlate(v.plateNumber) === normPlate)) {
      return { success: false, error: `A vehicle with plate number "${input.plateNumber}" already exists.` };
    }

    if (input.vin && input.vin.trim()) {
      const cleanVin = input.vin.trim().toUpperCase();
      if (vehicles.some((v) => v.vin && v.vin.trim().toUpperCase() === cleanVin)) {
        return { success: false, error: `A vehicle with VIN "${input.vin}" already exists.` };
      }
    }

    let customerId = input.customerId?.trim() || '';
    let customerName = input.customerName?.trim() || '';
    let customerPhone = input.customerPhone?.trim() || '';

    if (customerId) {
      const owner = customers.find((c) => c.id === customerId);
      if (!owner) {
        return { success: false, error: 'Customer not found' };
      }
      customerName = owner.fullName;
      customerPhone = owner.phone || '';
    } else {
      if (!customerName || customerName.length < 2) {
        return { success: false, error: 'Customer name is required (minimum 2 characters)' };
      }
      customerId = `cust-${Date.now()}`;
      const now = new Date().toISOString();
      const isPermanent = input.isPermanentCustomer !== false;
      const newCustomer: CustomerDTO = {
        id: customerId,
        fullName: customerName,
        phone: customerPhone || undefined,
        isActive: true,
        isPermanent,
        createdAt: now,
        updatedAt: now,
        vehicleCount: 1,
      };
      customers.unshift(newCustomer);
      this.setStorage('customers', customers);
    }

    const now = new Date().toISOString();
    const newVehicle: VehicleDTO = {
      id: `veh-${Date.now()}`,
      customerId,
      customerName,
      customerPhone: customerPhone || undefined,
      plateNumber: normPlate,
      make: input.make.trim(),
      model: input.model.trim(),
      year: input.year,
      vin: input.vin?.trim() || undefined,
      odometer: input.odometer,
      color: input.color?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      isActive: input.isActive !== false,
      createdAt: now,
      updatedAt: now,
    };

    vehicles.unshift(newVehicle);
    this.setStorage('vehicles', vehicles);
    return { success: true, data: newVehicle };
  }

  async updateVehicle(id: string, input: Partial<VehicleInput>): Promise<IpcResult<VehicleDTO>> {
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const index = vehicles.findIndex((v) => v.id === id);
    if (index === -1) {
      return { success: false, error: 'Vehicle not found' };
    }

    const current = vehicles[index];
    const targetPlate = input.plateNumber ? normalizePlate(input.plateNumber) : current.plateNumber;
    if (targetPlate !== current.plateNumber && vehicles.some((v) => v.id !== id && normalizePlate(v.plateNumber) === targetPlate)) {
      return { success: false, error: `A vehicle with plate number "${targetPlate}" already exists.` };
    }

    const targetVin = input.vin !== undefined ? (input.vin.trim() || undefined) : current.vin;
    if (targetVin && targetVin.toUpperCase() !== (current.vin?.toUpperCase() || '')) {
      const cleanVin = targetVin.toUpperCase();
      if (vehicles.some((v) => v.id !== id && v.vin && v.vin.trim().toUpperCase() === cleanVin)) {
        return { success: false, error: `A vehicle with VIN "${targetVin}" already exists.` };
      }
    }

    const targetCustomerId = input.customerId ?? current.customerId;
    const owner = customers.find((c) => c.id === targetCustomerId);

    const now = new Date().toISOString();
    const updated: VehicleDTO = {
      ...current,
      customerId: targetCustomerId,
      customerName: owner?.fullName || current.customerName,
      customerPhone: owner?.phone || current.customerPhone,
      plateNumber: targetPlate,
      make: input.make !== undefined ? input.make.trim() : current.make,
      model: input.model !== undefined ? input.model.trim() : current.model,
      year: input.year !== undefined ? input.year : current.year,
      vin: targetVin,
      odometer: input.odometer !== undefined ? input.odometer : current.odometer,
      color: input.color !== undefined ? (input.color.trim() || undefined) : current.color,
      notes: input.notes !== undefined ? (input.notes.trim() || undefined) : current.notes,
      isActive: input.isActive !== undefined ? input.isActive : (current.isActive !== false),
      updatedAt: now,
    };

    vehicles[index] = updated;
    this.setStorage('vehicles', vehicles);
    return { success: true, data: updated };
  }

  async archiveVehicle(id: string): Promise<IpcResult<void>> {
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const target = vehicles.find((v) => v.id === id);
    if (!target) return { success: false, error: 'Vehicle not found' };
    target.isActive = false;
    target.updatedAt = new Date().toISOString();
    this.setStorage('vehicles', vehicles);
    return { success: true };
  }

  async restoreVehicle(id: string): Promise<IpcResult<void>> {
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const target = vehicles.find((v) => v.id === id);
    if (!target) return { success: false, error: 'Vehicle not found' };
    target.isActive = true;
    target.updatedAt = new Date().toISOString();
    this.setStorage('vehicles', vehicles);
    return { success: true };
  }

  async deleteVehicle(id: string): Promise<IpcResult<void>> {
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    if (ros.some((r) => r.vehicleId === id)) {
      return {
        success: false,
        error: 'Cannot delete vehicle with repair order history. Please archive the vehicle instead.',
        errorCode: 'VEHICLE_HAS_LINKED_RECORDS',
      };
    }

    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    this.setStorage('vehicles', vehicles.filter((v) => v.id !== id));
    return { success: true };
  }

  private recalculateMockROTotals(repairOrderId: string): void {
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    const ro = ros.find((r) => r.id === repairOrderId);
    if (!ro) return;

    const parts = this.getStorage<RepairOrderPartDTO[]>('repair_order_parts', []).filter(
      (p) => p.repairOrderId === repairOrderId && p.status === 'ISSUED' && p.isApproved
    );
    const tasks = this.getStorage<LaborTaskDTO[]>('labor_tasks', []).filter(
      (t) => t.repairOrderId === repairOrderId && t.isApproved
    );

    const partsTotal = parts.reduce((sum, p) => sum + (p.totalPriceBaisa || 0), 0);
    const laborTotal = tasks.reduce((sum, t) => sum + (t.laborChargeBaisa || 0), 0);
    const taxAmount = Math.round(((partsTotal + laborTotal) * 5) / 100);
    const grandTotal = partsTotal + laborTotal + taxAmount;

    ro.partsTotalBaisa = partsTotal;
    ro.laborTotalBaisa = laborTotal;
    ro.taxAmountBaisa = taxAmount;
    ro.grandTotalBaisa = grandTotal;

    this.setStorage('repair_orders', ros);
  }

  async getRepairOrders(statusFilter?: RepairOrderStatus): Promise<IpcResult<RepairOrderDTO[]>> {
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);

    let list = ros;
    if (statusFilter) {
      list = list.filter((r) => r.status === statusFilter);
    }

    const enriched = list.map((ro) => {
      const cust = customers.find((c) => c.id === ro.customerId);
      const veh = vehicles.find((v) => v.id === ro.vehicleId);
      return {
        ...ro,
        customerName: cust?.fullName || ro.customerName,
        customerPhone: cust?.phone || ro.customerPhone,
        vehiclePlate: veh?.plateNumber || ro.vehiclePlate,
        vehicleMake: veh?.make || ro.vehicleMake,
        vehicleModel: veh?.model || ro.vehicleModel,
      };
    });

    return { success: true, data: enriched };
  }

  async getRepairOrderById(id: string): Promise<IpcResult<RepairOrderDTO | null>> {
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const ro = ros.find((r) => r.id === id);
    if (!ro) return { success: true, data: null };

    const cust = customers.find((c) => c.id === ro.customerId);
    const veh = vehicles.find((v) => v.id === ro.vehicleId);

    return {
      success: true,
      data: {
        ...ro,
        customerName: cust?.fullName || ro.customerName,
        customerPhone: cust?.phone || ro.customerPhone,
        vehiclePlate: veh?.plateNumber || ro.vehiclePlate,
        vehicleMake: veh?.make || ro.vehicleMake,
        vehicleModel: veh?.model || ro.vehicleModel,
      },
    };
  }

  async createRepairOrder(input: RepairOrderInput): Promise<IpcResult<RepairOrderDTO>> {
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);

    const cust = customers.find((c) => c.id === input.customerId);
    if (!cust) {
      return { success: false, error: 'Customer not found.' };
    }

    const veh = vehicles.find((v) => v.id === input.vehicleId);
    if (!veh) {
      return { success: false, error: 'Vehicle not found.' };
    }

    if (veh.customerId !== input.customerId) {
      return {
        success: false,
        error: `Vehicle ${veh.plateNumber} belongs to another customer. Verify vehicle ownership.`,
      };
    }

    if (input.odometerIn < veh.odometer) {
      return {
        success: false,
        error: `Odometer in (${input.odometerIn} km) cannot be less than vehicle current odometer (${veh.odometer} km).`,
      };
    }

    // Update vehicle odometer if higher
    if (input.odometerIn > veh.odometer) {
      veh.odometer = input.odometerIn;
      veh.updatedAt = new Date().toISOString();
      this.setStorage('vehicles', vehicles);
    }

    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const roNumber = `RO-${ym}-${String(ros.length + 1).padStart(4, '0')}`;
    const id = `ro-${Date.now()}`;

    const newRO: RepairOrderDTO = {
      id,
      roNumber,
      customerId: input.customerId,
      customerName: cust.fullName,
      customerPhone: cust.phone,
      vehicleId: input.vehicleId,
      vehiclePlate: veh.plateNumber,
      vehicleMake: veh.make,
      vehicleModel: veh.model,
      status: 'RECEIVED',
      odometerIn: input.odometerIn,
      reportedProblem: input.reportedProblem,
      inspectionNotes: input.inspectionNotes,
      requestedWork: input.requestedWork,
      estimatedCostBaisa: input.estimatedCostBaisa || 0,
      partsTotalBaisa: 0,
      laborTotalBaisa: 0,
      taxAmountBaisa: 0,
      grandTotalBaisa: 0,
      customerApproved: false,
      approvalStatus: 'PENDING',
      assignedTechnicianId: input.assignedTechnicianId,
      assignedTechnicianName: input.assignedTechnicianName,
      receivedAt: now.toISOString(),
      expectedAt: input.expectedAt,
      createdAt: now.toISOString(),
    };

    ros.unshift(newRO);
    this.setStorage('repair_orders', ros);

    // Record initial status history
    const history = this.getStorage<RepairOrderStatusHistoryDTO[]>('ro_status_history', []);
    history.unshift({
      id: `hist-${Date.now()}`,
      repairOrderId: id,
      oldStatus: 'NONE',
      newStatus: 'RECEIVED',
      changedBy: 'الموظف (Staff)',
      remarks: 'استلام المركبة وفتح أمر الإصلاح الجديد',
      changedAt: now.toISOString(),
    });
    this.setStorage('ro_status_history', history);

    return { success: true, data: newRO };
  }

  async updateRepairOrderStatus(input: StatusChangeInput): Promise<IpcResult<void>> {
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    const target = ros.find((r) => r.id === input.repairOrderId);
    if (!target) {
      return { success: false, error: 'Repair order not found.' };
    }

    const oldStatus = target.status;
    if (oldStatus === input.newStatus) {
      return { success: true };
    }

    if (oldStatus === 'COMPLETED' && input.newStatus !== 'COMPLETED') {
      return { success: false, error: 'Cannot modify the status of a completed and finalized repair order.' };
    }

    if (input.newStatus === 'CANCELLED') {
      const roParts = this.getStorage<RepairOrderPartDTO[]>('repair_order_parts', []);
      const activeParts = roParts.filter((p) => p.repairOrderId === input.repairOrderId && p.status === 'ISSUED');
      if (activeParts.length > 0) {
        return {
          success: false,
          error: `Cannot cancel repair order with ${activeParts.length} active issued part(s). All issued parts must be returned or reversed to inventory before cancellation.`,
        };
      }
    }

    target.status = input.newStatus;
    if (input.newStatus === 'COMPLETED') target.completedAt = new Date().toISOString();
    if (input.newStatus === 'READY_FOR_DELIVERY') target.deliveredAt = new Date().toISOString();

    this.setStorage('repair_orders', ros);

    // Log history
    const history = this.getStorage<RepairOrderStatusHistoryDTO[]>('ro_status_history', []);
    history.unshift({
      id: `hist-${Date.now()}`,
      repairOrderId: input.repairOrderId,
      oldStatus,
      newStatus: input.newStatus,
      changedBy: input.changedBy || 'المشرف (Supervisor)',
      remarks: input.remarks || '',
      changedAt: new Date().toISOString(),
    });
    this.setStorage('ro_status_history', history);

    return { success: true };
  }

  async getLaborTasks(repairOrderId: string): Promise<IpcResult<LaborTaskDTO[]>> {
    const tasks = this.getStorage<LaborTaskDTO[]>('labor_tasks', []);
    return {
      success: true,
      data: tasks.filter((t) => t.repairOrderId === repairOrderId),
    };
  }

  async addLaborTask(input: LaborTaskInput): Promise<IpcResult<LaborTaskDTO>> {
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    const ro = ros.find((r) => r.id === input.repairOrderId);
    if (!ro) return { success: false, error: 'Repair order not found.' };
    if (ro.status === 'COMPLETED' || ro.status === 'CANCELLED') {
      return { success: false, error: `Cannot add labor tasks to a ${ro.status.toLowerCase()} repair order.` };
    }

    const tasks = this.getStorage<LaborTaskDTO[]>('labor_tasks', []);
    const now = new Date();
    const hours = input.hours || 1.0;
    const hourlyRate = input.hourlyRateBaisa || 0;
    const laborCharge = input.laborChargeBaisa || Math.round(hours * hourlyRate);

    const newTask: LaborTaskDTO = {
      id: `task-${Date.now()}`,
      repairOrderId: input.repairOrderId,
      technicianId: input.technicianId,
      technicianName: input.technicianName,
      description: input.description,
      hours,
      hourlyRateBaisa: hourlyRate,
      laborChargeBaisa: laborCharge,
      internalCostBaisa: input.internalCostBaisa || 0,
      isApproved: input.isApproved ?? true,
      status: input.status || 'PENDING',
      notes: input.notes,
      workDate: now.toISOString().slice(0, 10),
    };

    tasks.push(newTask);
    this.setStorage('labor_tasks', tasks);
    this.recalculateMockROTotals(input.repairOrderId);

    return { success: true, data: newTask };
  }

  async updateLaborTask(id: string, input: Partial<LaborTaskInput>): Promise<IpcResult<LaborTaskDTO>> {
    const tasks = this.getStorage<LaborTaskDTO[]>('labor_tasks', []);
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      return { success: false, error: 'Labor task not found.' };
    }

    const current = tasks[index];
    const hours = input.hours !== undefined ? input.hours : current.hours;
    const hourlyRate = input.hourlyRateBaisa !== undefined ? input.hourlyRateBaisa : current.hourlyRateBaisa;
    const laborCharge = input.laborChargeBaisa !== undefined ? input.laborChargeBaisa : current.laborChargeBaisa;

    const updated: LaborTaskDTO = {
      ...current,
      description: input.description ?? current.description,
      technicianId: input.technicianId ?? current.technicianId,
      technicianName: input.technicianName ?? current.technicianName,
      hours,
      hourlyRateBaisa: hourlyRate,
      laborChargeBaisa: laborCharge,
      internalCostBaisa: input.internalCostBaisa !== undefined ? input.internalCostBaisa : current.internalCostBaisa,
      isApproved: input.isApproved !== undefined ? input.isApproved : current.isApproved,
      status: input.status ?? current.status,
      notes: input.notes !== undefined ? input.notes : current.notes,
    };

    tasks[index] = updated;
    this.setStorage('labor_tasks', tasks);
    this.recalculateMockROTotals(current.repairOrderId);

    return { success: true, data: updated };
  }

  async deleteLaborTask(id: string): Promise<IpcResult<void>> {
    const tasks = this.getStorage<LaborTaskDTO[]>('labor_tasks', []);
    const target = tasks.find((t) => t.id === id);
    if (!target) return { success: false, error: 'Labor task not found.' };

    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    const ro = ros.find((r) => r.id === target.repairOrderId);
    if (ro && (ro.status === 'COMPLETED' || ro.status === 'CANCELLED')) {
      return { success: false, error: `Cannot delete labor tasks from a ${ro.status.toLowerCase()} repair order.` };
    }

    this.setStorage('labor_tasks', tasks.filter((t) => t.id !== id));
    this.recalculateMockROTotals(target.repairOrderId);
    return { success: true };
  }

  async getRepairOrderParts(repairOrderId: string): Promise<IpcResult<RepairOrderPartDTO[]>> {
    const parts = this.getStorage<RepairOrderPartDTO[]>('repair_order_parts', []);
    return {
      success: true,
      data: parts.filter((p) => p.repairOrderId === repairOrderId),
    };
  }

  async issuePartToRO(input: IssuePartInput): Promise<IpcResult<RepairOrderPartDTO>> {
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    const ro = ros.find((r) => r.id === input.repairOrderId);
    if (!ro) return { success: false, error: 'Repair order not found.' };
    if (ro.status === 'COMPLETED' || ro.status === 'CANCELLED') {
      return { success: false, error: `Cannot issue parts to a ${ro.status.toLowerCase()} repair order.` };
    }

    const roParts = this.getStorage<RepairOrderPartDTO[]>('repair_order_parts', []);
    if (input.idempotencyKey) {
      const existing = roParts.find((p) => p.idempotencyKey === input.idempotencyKey);
      if (existing) return { success: true, data: existing };
    }

    const items = this.getStorage<InventoryItemDTO[]>('inventory', []);
    const item = items.find((i) => i.id === input.itemId);
    if (!item) {
      return { success: false, error: 'Part item not found in catalog.' };
    }

    if (item.quantityInStock < input.quantity) {
      return {
        success: false,
        error: `Insufficient stock for "${item.name}". In stock: ${item.quantityInStock}, requested: ${input.quantity}.`,
      };
    }

    const serials = this.getStorage<InventorySerialDTO[]>('inventory_serials', []);
    let validatedSerial: string | undefined = undefined;

    if (item.isSerialized || input.serialNumber) {
      if (!input.serialNumber) {
        return { success: false, error: `Part "${item.name}" requires a physical serial number.` };
      }
      const cleanSerial = input.serialNumber.trim();
      const snRecord = serials.find((s) => s.itemId === item.id && s.serialNumber === cleanSerial && s.status === 'IN_STOCK');
      if (!snRecord) {
        return { success: false, error: `Active serial "${cleanSerial}" not found in stock for this item.` };
      }

      // Check if already assigned to an active RO
      const alreadyAssigned = roParts.some((p) => p.serialNumber === cleanSerial && p.status === 'ISSUED');
      if (alreadyAssigned) {
        return { success: false, error: `Serial number "${cleanSerial}" is already assigned to repair order.` };
      }

      snRecord.status = 'ISSUED';
      snRecord.repairOrderId = input.repairOrderId;
      snRecord.issuedAt = new Date().toISOString();
      validatedSerial = cleanSerial;
      this.setStorage('inventory_serials', serials);
    }

    // Decrement item stock
    item.quantityInStock -= input.quantity;
    this.setStorage('inventory', items);

    const unitPrice = input.unitPriceBaisa ?? item.sellingPriceBaisa;
    const totalPrice = unitPrice * input.quantity;
    const roPartId = `ro-part-${Date.now()}`;
    const now = new Date().toISOString();

    const newROPart: RepairOrderPartDTO = {
      id: roPartId,
      repairOrderId: input.repairOrderId,
      itemId: item.id,
      partCode: item.partCode,
      partName: item.name,
      serialNumber: validatedSerial,
      quantity: input.quantity,
      unitPriceBaisa: unitPrice,
      unitCostBaisa: item.purchaseCostBaisa,
      totalPriceBaisa: totalPrice,
      isApproved: input.isApproved ?? true,
      status: 'ISSUED',
      issuedAt: now,
      idempotencyKey: input.idempotencyKey,
    };

    roParts.push(newROPart);
    this.setStorage('repair_order_parts', roParts);

    // Log movement ledger
    const movements = this.getStorage<InventoryMovementDTO[]>('inventory_movements', []);
    movements.unshift({
      id: `mov-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      partCode: item.partCode,
      movementType: 'RO_ISSUE',
      quantityDelta: -input.quantity,
      unitCostBaisa: item.purchaseCostBaisa,
      serialNumber: validatedSerial,
      referenceType: 'REPAIR_ORDER',
      referenceId: input.repairOrderId,
      reason: input.notes || `صرف لأمر الإصلاح`,
      createdBy: 'أمين المخزن (Storekeeper)',
      createdAt: now,
    });
    this.setStorage('inventory_movements', movements);

    this.recalculateMockROTotals(input.repairOrderId);
    return { success: true, data: newROPart };
  }

  async returnPartFromRO(input: ReturnPartInput): Promise<IpcResult<void>> {
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    const ro = ros.find((r) => r.id === input.repairOrderId);
    if (ro && (ro.status === 'COMPLETED' || ro.status === 'CANCELLED')) {
      return { success: false, error: `Cannot return parts from a ${ro.status.toLowerCase()} repair order.` };
    }

    const roParts = this.getStorage<RepairOrderPartDTO[]>('repair_order_parts', []);
    const part = roParts.find((p) => p.id === input.roPartId && p.repairOrderId === input.repairOrderId);
    if (!part) {
      return { success: false, error: 'Issued part record not found.' };
    }

    if (part.status === 'RETURNED') {
      return { success: false, error: 'This part has already been returned to inventory.' };
    }

    const isDefective = Boolean(input.isDefective) || Boolean(input.reason && /(defective|damaged|معيب|تالف|خربان|عطلان)/i.test(input.reason));

    part.status = 'RETURNED';
    part.returnedAt = new Date().toISOString();
    part.returnReason = input.reason || (isDefective ? 'إرجاع كقطعة معيبة' : 'إرجاع للمستودع');
    this.setStorage('repair_order_parts', roParts);

    if (isDefective) {
      if (part.serialNumber) {
        const serials = this.getStorage<InventorySerialDTO[]>('inventory_serials', []);
        const sn = serials.find((s) => s.itemId === part.itemId && s.serialNumber === part.serialNumber);
        if (sn) {
          sn.status = 'DAMAGED';
          sn.repairOrderId = undefined;
          this.setStorage('inventory_serials', serials);
        }
      }
      const movements = this.getStorage<InventoryMovementDTO[]>('inventory_movements', []);
      movements.unshift({
        id: `mov-${Date.now()}`,
        itemId: part.itemId,
        itemName: part.partName,
        partCode: part.partCode,
        movementType: 'RETURN_TO_STOCK',
        quantityDelta: 0,
        unitCostBaisa: part.unitCostBaisa,
        serialNumber: part.serialNumber,
        referenceType: 'REPAIR_ORDER',
        referenceId: input.repairOrderId,
        reason: input.reason || 'إرجاع كقطعة معيبة (مستبعدة من المخزون الصالح)',
        createdBy: 'أمين المخزن (Storekeeper)',
        createdAt: new Date().toISOString(),
      });
      this.setStorage('inventory_movements', movements);
    } else {
      // Restore item stock
      const items = this.getStorage<InventoryItemDTO[]>('inventory', []);
      const item = items.find((i) => i.id === part.itemId);
      if (item) {
        item.quantityInStock += part.quantity;
        this.setStorage('inventory', items);
      }

      // Restore serial if serialized
      if (part.serialNumber) {
        const serials = this.getStorage<InventorySerialDTO[]>('inventory_serials', []);
        const sn = serials.find((s) => s.itemId === part.itemId && s.serialNumber === part.serialNumber);
        if (sn) {
          sn.status = 'IN_STOCK';
          sn.repairOrderId = undefined;
          this.setStorage('inventory_serials', serials);
        }
      }

      // Log reversal movement
      const movements = this.getStorage<InventoryMovementDTO[]>('inventory_movements', []);
      movements.unshift({
        id: `mov-${Date.now()}`,
        itemId: part.itemId,
        itemName: part.partName,
        partCode: part.partCode,
        movementType: 'RETURN_TO_STOCK',
        quantityDelta: part.quantity,
        unitCostBaisa: part.unitCostBaisa,
        serialNumber: part.serialNumber,
        referenceType: 'REPAIR_ORDER',
        referenceId: input.repairOrderId,
        reason: input.reason || 'إرجاع سليم للمستودع',
        createdBy: 'أمين المخزن (Storekeeper)',
        createdAt: new Date().toISOString(),
      });
      this.setStorage('inventory_movements', movements);
    }

    this.recalculateMockROTotals(input.repairOrderId);
    return { success: true };
  }

  async recordCustomerApproval(input: RepairOrderCustomerApprovalInput): Promise<IpcResult<RepairOrderDTO>> {
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    const ro = ros.find((r) => r.id === input.repairOrderId);
    if (!ro) return { success: false, error: 'Repair order not found.' };

    ro.customerApproved = input.approved;
    ro.approvalStatus = input.approved ? 'APPROVED' : 'REJECTED';
    ro.approvedAt = new Date().toISOString();
    ro.approvalNotes = input.notes;

    if (input.approved && (ro.status === 'AWAITING_APPROVAL' || ro.status === 'RECEIVED' || ro.status === 'UNDER_INSPECTION')) {
      ro.status = 'APPROVED';
    }

    this.setStorage('repair_orders', ros);
    return { success: true, data: ro };
  }

  async getStatusHistory(repairOrderId: string): Promise<IpcResult<RepairOrderStatusHistoryDTO[]>> {
    const history = this.getStorage<RepairOrderStatusHistoryDTO[]>('ro_status_history', []);
    return {
      success: true,
      data: history.filter((h) => h.repairOrderId === repairOrderId),
    };
  }

  async createInvoiceFromRepairOrder(input: CreateInvoiceFromROInput): Promise<IpcResult<InvoiceDTO>> {
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);
    const ro = ros.find((r) => r.id === input.repairOrderId);
    if (!ro) return { success: false, error: 'Repair order not found.' };

    const parts = this.getStorage<RepairOrderPartDTO[]>('repair_order_parts', []).filter(
      (p) => p.repairOrderId === ro.id && p.status === 'ISSUED' && p.isApproved
    );
    const tasks = this.getStorage<LaborTaskDTO[]>('labor_tasks', []).filter(
      (t) => t.repairOrderId === ro.id && t.isApproved
    );

    const subtotalParts = parts.reduce((sum, p) => sum + p.totalPriceBaisa, 0);
    const subtotalLabor = tasks.reduce((sum, t) => sum + t.laborChargeBaisa, 0);
    const discount = input.discountBaisa || 0;
    const taxRate = 5.0;
    const taxableBase = Math.max(0, subtotalParts + subtotalLabor - discount);
    const taxAmount = Math.round((taxableBase * taxRate) / 100);
    const grandTotal = taxableBase + taxAmount;

    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);
    const cust = customers.find((c) => c.id === ro.customerId);
    const veh = vehicles.find((v) => v.id === ro.vehicleId);

    const now = new Date();
    const invoiceDate = now.toISOString().slice(0, 10);
    const invoiceNumber = `INV-${invoiceDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const invId = `inv-${Date.now()}`;
    const invoiceItems: InvoiceItemDTO[] = [
      ...parts.map((p, idx) => ({
        id: `it-p-${p.id || idx}`,
        invoiceId: invId,
        itemType: 'PART' as const,
        sourceId: p.id,
        description: p.serialNumber ? `${p.partName} (${p.serialNumber})` : p.partName,
        quantity: p.quantity,
        unit: p.unit || 'قطعة',
        unitPriceBaisa: p.unitPriceBaisa,
        costPriceBaisa: p.unitCostBaisa,
        lineTotalBaisa: p.totalPriceBaisa,
      })),
      ...tasks.map((t, idx) => ({
        id: `it-t-${t.id || idx}`,
        invoiceId: invId,
        itemType: 'LABOR' as const,
        sourceId: t.id,
        description: t.description,
        quantity: t.hours || 1,
        unit: 'خدمة',
        unitPriceBaisa: t.laborChargeBaisa,
        costPriceBaisa: t.internalCostBaisa || 0,
        lineTotalBaisa: t.laborChargeBaisa,
      })),
    ];

    const newInvoice: InvoiceDTO = {
      id: invId,
      invoiceNumber,
      repairOrderId: ro.id,
      customerId: ro.customerId,
      customerName: cust?.fullName || ro.customerName,
      customerPhone: cust?.phone || ro.customerPhone,
      isCustomerPermanent: cust ? cust.isPermanent !== false : true,
      vehicleId: ro.vehicleId,
      vehiclePlate: veh?.plateNumber || ro.vehiclePlate,
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
      notes: input.notes || `فاتورة صادرة عن أمر الإصلاح رقم ${ro.roNumber}`,
      items: invoiceItems,
      createdAt: now.toISOString(),
    };

    const invoices = this.getStorage<InvoiceDTO[]>('invoices', []);
    invoices.unshift(newInvoice);
    this.setStorage('invoices', invoices);

    // Advance RO status to COMPLETED
    ro.status = 'COMPLETED';
    ro.completedAt = now.toISOString();
    this.setStorage('repair_orders', ros);

    return { success: true, data: newInvoice };
  }

  async getTechnicians(): Promise<IpcResult<TechnicianDTO[]>> {
    const defaultTechs: TechnicianDTO[] = [
      {
        id: 'tech-1',
        name: 'أحمد البلوشي (Ahmed Al Balushi)',
        phone: '+968 92345678',
        specialty: 'ميكانيكا عامة ومحركات (Engine & Transmission)',
        isActive: true,
        hourlyRateBaisa: 7000,
        monthlyBaseSalaryBaisa: 450000,
        overtimeRateBaisa: 3000,
        nationalId: '10928374',
        hireDate: '2023-01-15',
        employmentStatus: 'ACTIVE',
        notes: 'كبير الفنيين خبرة 12 سنة',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tech-2',
        name: 'راجيش كومار (Rajesh Kumar)',
        phone: '+968 93456789',
        specialty: 'كهرباء وفحص كمبيوتر (Auto Electrician & Diagnostic)',
        isActive: true,
        hourlyRateBaisa: 7000,
        monthlyBaseSalaryBaisa: 380000,
        overtimeRateBaisa: 2500,
        nationalId: '29384756',
        hireDate: '2023-05-10',
        employmentStatus: 'ACTIVE',
        notes: 'أجهزة الفحص وبرمجة الحساسات',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tech-3',
        name: 'سيف المعمري (Saif Al Maamari)',
        phone: '+968 94567890',
        specialty: 'فرامل وميزانية ونظام تعليق (Brakes & Suspension)',
        isActive: true,
        hourlyRateBaisa: 7000,
        monthlyBaseSalaryBaisa: 400000,
        overtimeRateBaisa: 2700,
        nationalId: '98472918',
        hireDate: '2024-02-01',
        employmentStatus: 'ACTIVE',
        notes: 'متخصص أنظمة الهيدروليك والفرامل',
        createdAt: new Date().toISOString(),
      },
    ];

    const techs = this.getStorage<TechnicianDTO[]>('technicians', defaultTechs);
    return { success: true, data: techs };
  }

  async createTechnician(input: TechnicianInput): Promise<IpcResult<TechnicianDTO>> {
    const techs = this.getStorage<TechnicianDTO[]>('technicians', []);
    const newTech: TechnicianDTO = {
      id: `tech-${Date.now()}`,
      name: input.name.trim(),
      phone: input.phone?.trim() || undefined,
      specialty: input.specialty?.trim() || undefined,
      isActive: input.isActive !== false,
      notes: input.notes?.trim() || undefined,
      hourlyRateBaisa: input.hourlyRateBaisa ?? 7000,
      monthlyBaseSalaryBaisa: input.monthlyBaseSalaryBaisa ?? 350000,
      overtimeRateBaisa: input.overtimeRateBaisa ?? 2500,
      nationalId: input.nationalId?.trim() || undefined,
      hireDate: input.hireDate || new Date().toISOString().slice(0, 10),
      employmentStatus: input.employmentStatus || 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    techs.push(newTech);
    this.setStorage('technicians', techs);
    return { success: true, data: newTech };
  }

  async updateTechnician(id: string, input: Partial<TechnicianInput>): Promise<IpcResult<TechnicianDTO>> {
    const techs = this.getStorage<TechnicianDTO[]>('technicians', []);
    const target = techs.find((t) => t.id === id);
    if (!target) return { success: false, error: 'Technician not found' };

    if (input.name !== undefined) target.name = input.name.trim();
    if (input.phone !== undefined) target.phone = input.phone.trim();
    if (input.specialty !== undefined) target.specialty = input.specialty.trim();
    if (input.isActive !== undefined) target.isActive = input.isActive;
    if (input.notes !== undefined) target.notes = input.notes.trim();
    if (input.hourlyRateBaisa !== undefined) target.hourlyRateBaisa = input.hourlyRateBaisa;
    if (input.monthlyBaseSalaryBaisa !== undefined) target.monthlyBaseSalaryBaisa = input.monthlyBaseSalaryBaisa;
    if (input.overtimeRateBaisa !== undefined) target.overtimeRateBaisa = input.overtimeRateBaisa;
    if (input.nationalId !== undefined) target.nationalId = input.nationalId.trim();
    if (input.hireDate !== undefined) target.hireDate = input.hireDate;
    if (input.employmentStatus !== undefined) target.employmentStatus = input.employmentStatus;

    this.setStorage('technicians', techs);
    return { success: true, data: target };
  }

  async deleteTechnician(id: string): Promise<IpcResult<void>> {
    const techs = this.getStorage<TechnicianDTO[]>('technicians', []);
    const target = techs.find((t) => t.id === id);
    if (!target) return { success: true };
    target.isActive = false;
    target.employmentStatus = 'TERMINATED';
    this.setStorage('technicians', techs);
    return { success: true };
  }

  // --- WORKER OVERTIME METHODS ---
  async getWorkerOvertime(workerId?: string, month?: string): Promise<IpcResult<WorkerOvertimeEntryDTO[]>> {
    let list = this.getStorage<WorkerOvertimeEntryDTO[]>('worker_overtime_entries', []);
    const techs = this.getStorage<TechnicianDTO[]>('technicians', []);

    if (workerId) {
      list = list.filter((e) => e.workerId === workerId);
    }
    if (month) {
      list = list.filter((e) => e.workDate.slice(0, 7) === month);
    }

    list = list.map((e) => {
      const w = techs.find((t) => t.id === e.workerId);
      return {
        ...e,
        workerName: w?.name || e.workerName,
        workerSpecialty: w?.specialty || e.workerSpecialty,
      };
    });

    list.sort((a, b) => new Date(b.workDate).getTime() - new Date(a.workDate).getTime());
    return { success: true, data: list };
  }

  async addWorkerOvertime(input: WorkerOvertimeInput): Promise<IpcResult<WorkerOvertimeEntryDTO>> {
    const list = this.getStorage<WorkerOvertimeEntryDTO[]>('worker_overtime_entries', []);
    const techs = this.getStorage<TechnicianDTO[]>('technicians', []);
    const worker = techs.find((t) => t.id === input.workerId);
    if (!worker) return { success: false, error: 'Worker not found' };

    const hourlyRate = input.hourlyRateBaisa !== undefined && input.hourlyRateBaisa >= 0
      ? input.hourlyRateBaisa
      : (worker.overtimeRateBaisa || 2500);

    const totalAmount = Math.round(input.hours * hourlyRate);
    const now = new Date().toISOString();

    const newEntry: WorkerOvertimeEntryDTO = {
      id: `ot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workerId: input.workerId,
      workerName: worker.name,
      workerSpecialty: worker.specialty,
      workDate: input.workDate,
      hours: input.hours,
      hourlyRateBaisa: hourlyRate,
      totalAmountBaisa: totalAmount,
      status: 'PENDING',
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    list.unshift(newEntry);
    this.setStorage('worker_overtime_entries', list);
    return { success: true, data: newEntry };
  }

  async updateWorkerOvertime(id: string, input: WorkerOvertimeUpdateInput): Promise<IpcResult<WorkerOvertimeEntryDTO>> {
    const list = this.getStorage<WorkerOvertimeEntryDTO[]>('worker_overtime_entries', []);
    const entry = list.find((e) => e.id === id);
    if (!entry) return { success: false, error: 'Overtime entry not found' };

    if (input.workDate) entry.workDate = input.workDate;
    if (input.hours !== undefined && input.hours > 0) entry.hours = input.hours;
    if (input.hourlyRateBaisa !== undefined && input.hourlyRateBaisa >= 0) entry.hourlyRateBaisa = input.hourlyRateBaisa;
    entry.totalAmountBaisa = Math.round(entry.hours * entry.hourlyRateBaisa);
    if (input.status) entry.status = input.status;
    if (input.notes !== undefined) entry.notes = input.notes;
    if (input.approvedBy) entry.approvedBy = input.approvedBy;
    entry.updatedAt = new Date().toISOString();

    this.setStorage('worker_overtime_entries', list);
    return { success: true, data: entry };
  }

  async updateWorkerOvertimeStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED', approvedBy?: string): Promise<IpcResult<void>> {
    const list = this.getStorage<WorkerOvertimeEntryDTO[]>('worker_overtime_entries', []);
    const entry = list.find((e) => e.id === id);
    if (!entry) return { success: false, error: 'Overtime entry not found' };

    entry.status = status;
    entry.approvedBy = approvedBy || 'Admin';
    entry.approvedAt = status === 'APPROVED' ? new Date().toISOString() : undefined;
    entry.updatedAt = new Date().toISOString();

    this.setStorage('worker_overtime_entries', list);
    return { success: true };
  }

  async deleteWorkerOvertime(id: string): Promise<IpcResult<void>> {
    const list = this.getStorage<WorkerOvertimeEntryDTO[]>('worker_overtime_entries', []);
    const filtered = list.filter((e) => e.id !== id);
    this.setStorage('worker_overtime_entries', filtered);
    return { success: true };
  }

  // --- WORKER PAYROLL METHODS ---
  async getWorkerPayrolls(month?: string, workerId?: string): Promise<IpcResult<WorkerMonthlyPayrollDTO[]>> {
    let list = this.getStorage<WorkerMonthlyPayrollDTO[]>('worker_monthly_payrolls', []);
    const techs = this.getStorage<TechnicianDTO[]>('technicians', []);

    if (month) {
      list = list.filter((p) => p.payrollMonth === month);
    }
    if (workerId) {
      list = list.filter((p) => p.workerId === workerId);
    }

    list = list.map((p) => {
      const w = techs.find((t) => t.id === p.workerId);
      return {
        ...p,
        workerName: w?.name || p.workerName,
        workerSpecialty: w?.specialty || p.workerSpecialty,
        workerPhone: w?.phone || p.workerPhone,
      };
    });

    list.sort((a, b) => b.payrollMonth.localeCompare(a.payrollMonth));
    return { success: true, data: list };
  }

  async generateWorkerPayroll(input: GeneratePayrollInput): Promise<IpcResult<WorkerMonthlyPayrollDTO[]>> {
    const payrolls = this.getStorage<WorkerMonthlyPayrollDTO[]>('worker_monthly_payrolls', []);
    const techs = this.getStorage<TechnicianDTO[]>('technicians', []);
    const overtime = this.getStorage<WorkerOvertimeEntryDTO[]>('worker_overtime_entries', []);

    let targetWorkers = techs.filter((t) => t.isActive);
    if (input.workerId) {
      targetWorkers = targetWorkers.filter((t) => t.id === input.workerId);
    }

    const results: WorkerMonthlyPayrollDTO[] = [];

    for (const w of targetWorkers) {
      const approvedOt = overtime.filter(
        (o) => o.workerId === w.id && o.workDate.slice(0, 7) === input.payrollMonth && o.status === 'APPROVED'
      );

      const totalOtHours = approvedOt.reduce((sum, o) => sum + o.hours, 0);
      const totalOtAmount = approvedOt.reduce((sum, o) => sum + o.totalAmountBaisa, 0);
      const baseSalary = w.monthlyBaseSalaryBaisa || 350000;
      const totalPayable = baseSalary + totalOtAmount;

      const existingIndex = payrolls.findIndex(
        (p) => p.workerId === w.id && p.payrollMonth === input.payrollMonth
      );

      const now = new Date().toISOString();

      if (existingIndex < 0) {
        const newRecord: WorkerMonthlyPayrollDTO = {
          id: `pr-${input.payrollMonth}-${w.id}`,
          payrollMonth: input.payrollMonth,
          workerId: w.id,
          workerName: w.name,
          workerSpecialty: w.specialty,
          workerPhone: w.phone,
          baseSalaryBaisa: baseSalary,
          overtimeHours: totalOtHours,
          overtimeAmountBaisa: totalOtAmount,
          totalPayableBaisa: totalPayable,
          status: 'DRAFT',
          createdAt: now,
          updatedAt: now,
        };
        payrolls.push(newRecord);
        results.push(newRecord);
      } else if (payrolls[existingIndex].status === 'DRAFT') {
        payrolls[existingIndex].baseSalaryBaisa = baseSalary;
        payrolls[existingIndex].overtimeHours = totalOtHours;
        payrolls[existingIndex].overtimeAmountBaisa = totalOtAmount;
        payrolls[existingIndex].totalPayableBaisa = totalPayable;
        payrolls[existingIndex].updatedAt = now;
        results.push(payrolls[existingIndex]);
      } else {
        results.push(payrolls[existingIndex]);
      }
    }

    this.setStorage('worker_monthly_payrolls', payrolls);
    return { success: true, data: results };
  }

  async finalizeWorkerPayroll(input: FinalizePayrollInput): Promise<IpcResult<void>> {
    const payrolls = this.getStorage<WorkerMonthlyPayrollDTO[]>('worker_monthly_payrolls', []);
    const p = payrolls.find((item) => item.id === input.payrollId);
    if (!p) return { success: false, error: 'Payroll record not found' };

    p.status = input.markAsPaid ? 'PAID' : 'FINALIZED';
    if (input.paymentMethod) p.paymentMethod = input.paymentMethod;
    if (input.paymentReference) p.paymentReference = input.paymentReference;
    if (input.notes) p.notes = input.notes;
    if (input.markAsPaid) p.paidAt = new Date().toISOString();
    p.updatedAt = new Date().toISOString();

    this.setStorage('worker_monthly_payrolls', payrolls);
    return { success: true };
  }

  // --- WORKER LABOR PRODUCTIVITY METHODS ---
  async getWorkerProductivity(workerId?: string, startDate?: string, endDate?: string, repairOrderId?: string): Promise<IpcResult<WorkerLaborProductivityDTO[]>> {
    let list = this.getStorage<WorkerLaborProductivityDTO[]>('worker_labor_productivity', []);
    const techs = this.getStorage<TechnicianDTO[]>('technicians', []);
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);

    if (workerId) {
      list = list.filter((p) => p.workerId === workerId);
    }
    if (startDate) {
      list = list.filter((p) => p.workDate >= startDate);
    }
    if (endDate) {
      list = list.filter((p) => p.workDate <= endDate);
    }
    if (repairOrderId) {
      list = list.filter((p) => p.repairOrderId === repairOrderId);
    }

    list = list.map((p) => {
      const w = techs.find((t) => t.id === p.workerId);
      const ro = ros.find((r) => r.id === p.repairOrderId);
      return {
        ...p,
        workerName: w?.name || p.workerName,
        workerSpecialty: w?.specialty || p.workerSpecialty,
        roNumber: ro?.roNumber || p.roNumber,
      };
    });

    list.sort((a, b) => new Date(b.workDate).getTime() - new Date(a.workDate).getTime());
    return { success: true, data: list };
  }

  async allocateLaborProductivity(input: LaborAllocationInput): Promise<IpcResult<WorkerLaborProductivityDTO[]>> {
    const list = this.getStorage<WorkerLaborProductivityDTO[]>('worker_labor_productivity', []);
    const techs = this.getStorage<TechnicianDTO[]>('technicians', []);
    const ros = this.getStorage<RepairOrderDTO[]>('repair_orders', []);

    if (input.repairOrderId) {
      const ro = ros.find((r) => r.id === input.repairOrderId);
      if (ro) {
        const totalNew = input.allocations.reduce((sum, a) => sum + a.laborValueBaisa, 0);
        const existing = list
          .filter((p) => p.repairOrderId === input.repairOrderId)
          .reduce((sum, p) => sum + p.laborValueBaisa, 0);

        const maxAllowed = ro.estimatedCostBaisa || 0; // or labor charge
        if (maxAllowed > 0 && (existing + totalNew) > maxAllowed) {
          return {
            success: false,
            error: `إجمالي تخصيص العمالة (${(existing + totalNew) / 1000} ر.ع) يتجاوز قيمة أجور اليد المعتمدة لأمر الصيانة (${maxAllowed / 1000} ر.ع).`,
          };
        }
      }
    }

    const created: WorkerLaborProductivityDTO[] = [];
    const now = new Date().toISOString();

    for (const alloc of input.allocations) {
      const worker = techs.find((t) => t.id === alloc.workerId);
      const entry: WorkerLaborProductivityDTO = {
        id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
      };
      list.unshift(entry);
      created.push(entry);
    }

    this.setStorage('worker_labor_productivity', list);
    return { success: true, data: created };
  }

  async deleteWorkerProductivity(id: string): Promise<IpcResult<void>> {
    const list = this.getStorage<WorkerLaborProductivityDTO[]>('worker_labor_productivity', []);
    const filtered = list.filter((p) => p.id !== id);
    this.setStorage('worker_labor_productivity', filtered);
    return { success: true };
  }

  async getInventory(searchQuery?: string): Promise<IpcResult<InventoryItemDTO[]>> {
    const items = this.getStorage<InventoryItemDTO[]>('inventory', []);
    if (!searchQuery || !searchQuery.trim()) {
      return { success: true, data: items };
    }
    const q = searchQuery.toLowerCase().trim();
    return {
      success: true,
      data: items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.partCode.toLowerCase().includes(q) ||
          (i.manufacturer && i.manufacturer.toLowerCase().includes(q)) ||
          (i.category && i.category.toLowerCase().includes(q))
      ),
    };
  }

  async createInventoryItem(input: InventoryItemInput): Promise<IpcResult<InventoryItemDTO>> {
    const items = this.getStorage<InventoryItemDTO[]>('inventory', []);
    const cleanCode = input.partCode.trim().toUpperCase();

    if (items.some((i) => i.partCode.trim().toUpperCase() === cleanCode)) {
      return { success: false, error: `SKU / Part Code "${input.partCode}" already exists in inventory.` };
    }

    const newItem: InventoryItemDTO = {
      id: `part-${Date.now()}`,
      partCode: cleanCode,
      name: input.name.trim(),
      category: input.category.trim(),
      manufacturer: input.manufacturer?.trim(),
      description: input.description?.trim(),
      quantityInStock: input.quantityInStock,
      purchaseCostBaisa: input.purchaseCostBaisa,
      sellingPriceBaisa: input.sellingPriceBaisa,
      minStockLevel: input.minStockLevel,
      supplierId: input.supplierId,
      location: input.location?.trim(),
      isSerialized: Boolean(input.isSerialized),
      isActive: input.isActive ?? true,
      createdAt: new Date().toISOString(),
    };

    items.unshift(newItem);
    this.setStorage('inventory', items);

    // Initial stock receipt movement
    if (newItem.quantityInStock > 0) {
      const movements = this.getStorage<InventoryMovementDTO[]>('inventory_movements', []);
      movements.unshift({
        id: `mov-${Date.now()}`,
        itemId: newItem.id,
        itemName: newItem.name,
        partCode: newItem.partCode,
        movementType: 'PURCHASE_RECEIPT',
        quantityDelta: newItem.quantityInStock,
        unitCostBaisa: newItem.purchaseCostBaisa,
        referenceType: 'PURCHASE',
        reason: 'إدخال رصيد أول المدة',
        createdBy: 'مدير النظام (Admin)',
        createdAt: new Date().toISOString(),
      });
      this.setStorage('inventory_movements', movements);
    }

    return { success: true, data: newItem };
  }

  async receiveInventorySerial(input: InventorySerialInput): Promise<IpcResult<InventorySerialDTO>> {
    const serials = this.getStorage<InventorySerialDTO[]>('inventory_serials', []);
    const items = this.getStorage<InventoryItemDTO[]>('inventory', []);
    const item = items.find((i) => i.id === input.itemId);

    if (!item) {
      return { success: false, error: 'Inventory part item not found.' };
    }

    const cleanSerial = input.serialNumber.trim();
    const existing = serials.find((s) => s.serialNumber === cleanSerial && s.status === 'IN_STOCK');
    if (existing) {
      return {
        success: false,
        error: `A physical serialized part with active serial number "${cleanSerial}" is already in stock.`,
      };
    }

    const now = new Date().toISOString();
    const newSerial: InventorySerialDTO = {
      id: `sn-${Date.now()}`,
      itemId: input.itemId,
      serialNumber: cleanSerial,
      status: 'IN_STOCK',
      notes: input.notes?.trim() || undefined,
      receivedAt: now,
      createdAt: now,
      updatedAt: now,
      itemName: item.name,
      partCode: item.partCode,
    };

    serials.unshift(newSerial);
    this.setStorage('inventory_serials', serials);

    item.quantityInStock += 1;
    this.setStorage('inventory', items);

    const movements = this.getStorage<InventoryMovementDTO[]>('inventory_movements', []);
    movements.unshift({
      id: `mov-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      partCode: item.partCode,
      movementType: 'PURCHASE_RECEIPT',
      quantityDelta: 1,
      unitCostBaisa: item.purchaseCostBaisa,
      serialNumber: cleanSerial,
      referenceType: 'PURCHASE',
      reason: input.notes || `استلام قطعة مسلسلة رقم ${cleanSerial}`,
      createdBy: 'أمين المخزن (Storekeeper)',
      createdAt: now,
    });
    this.setStorage('inventory_movements', movements);

    return { success: true, data: newSerial };
  }

  async issueInventorySerial(serialNumber: string, repairOrderId?: string, invoiceId?: string): Promise<IpcResult<void>> {
    const cleanSerial = serialNumber.trim();
    const serials = this.getStorage<InventorySerialDTO[]>('inventory_serials', []);
    const items = this.getStorage<InventoryItemDTO[]>('inventory', []);
    const target = serials.find((s) => s.serialNumber === cleanSerial && s.status === 'IN_STOCK');

    if (!target) {
      return { success: false, error: `Active serial number "${cleanSerial}" not found in inventory.` };
    }

    target.status = 'ISSUED';
    target.issuedAt = new Date().toISOString();
    target.repairOrderId = repairOrderId;
    target.invoiceId = invoiceId;
    target.updatedAt = new Date().toISOString();
    this.setStorage('inventory_serials', serials);

    const item = items.find((i) => i.id === target.itemId);
    if (item) {
      item.quantityInStock = Math.max(0, item.quantityInStock - 1);
      this.setStorage('inventory', items);
    }

    return { success: true };
  }

  async getInventorySerials(itemId?: string, status?: string): Promise<IpcResult<InventorySerialDTO[]>> {
    let serials = this.getStorage<InventorySerialDTO[]>('inventory_serials', []);
    if (itemId) {
      serials = serials.filter((s) => s.itemId === itemId);
    }
    if (status) {
      serials = serials.filter((s) => s.status === status);
    }
    return { success: true, data: serials };
  }

  async getInventoryMovements(itemId?: string, repairOrderId?: string): Promise<IpcResult<InventoryMovementDTO[]>> {
    let movements = this.getStorage<InventoryMovementDTO[]>('inventory_movements', []);
    if (itemId) {
      movements = movements.filter((m) => m.itemId === itemId);
    }
    if (repairOrderId) {
      movements = movements.filter((m) => m.referenceId === repairOrderId);
    }
    return { success: true, data: movements };
  }

  async adjustStock(input: InventoryAdjustmentInput): Promise<IpcResult<void>> {
    const items = this.getStorage<InventoryItemDTO[]>('inventory', []);
    const item = items.find((i) => i.id === input.itemId);
    if (!item) {
      return { success: false, error: 'Inventory item not found.' };
    }

    const newQty = item.quantityInStock + input.quantityDelta;
    if (newQty < 0) {
      return { success: false, error: `Adjustment would result in negative stock (${newQty}).` };
    }

    item.quantityInStock = newQty;
    this.setStorage('inventory', items);

    const movements = this.getStorage<InventoryMovementDTO[]>('inventory_movements', []);
    movements.unshift({
      id: `mov-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      partCode: item.partCode,
      movementType: 'MANUAL_ADJUSTMENT',
      quantityDelta: input.quantityDelta,
      unitCostBaisa: item.purchaseCostBaisa,
      referenceType: 'ADJUSTMENT',
      reason: input.reason + (input.notes ? ` (${input.notes})` : ''),
      createdBy: 'مدير المستودع (Inventory Manager)',
      createdAt: new Date().toISOString(),
    });
    this.setStorage('inventory_movements', movements);

    return { success: true };
  }

  // Invoices, Payments & Customer Retention Workflow
  async getInvoices(customerId?: string): Promise<IpcResult<InvoiceDTO[]>> {
    let invoices = this.getStorage<InvoiceDTO[]>('invoices', []);
    if (invoices.length === 0) {
      // Seed a sample completed invoice for preview
      const sampleInvoice: InvoiceDTO = {
        id: 'inv-sample-1',
        invoiceNumber: 'INV-20261024-1001',
        customerId: 'cust-4',
        customerName: 'خالد بن ناصر السعدي (Khalid Al Saadi)',
        customerPhone: '+968 95551234',
        isCustomerPermanent: false,
        vehicleId: 'veh-4',
        vehiclePlate: '54321 C (د)',
        invoiceDate: new Date().toISOString().slice(0, 10),
        status: 'PAID',
        subtotalPartsBaisa: 15000,
        subtotalLaborBaisa: 10000,
        discountBaisa: 0,
        taxRatePercent: 5.0,
        taxAmountBaisa: 1250,
        grandTotalBaisa: 26250,
        paidAmountBaisa: 26250,
        balanceDueBaisa: 0,
        invoiceLanguage: 'ar',
        retentionPrompted: false,
        notes: 'صيانة وتغيير زيت محرك وفلتر أصلي',
        items: [
          {
            id: 'it-sample-1',
            invoiceId: 'inv-sample-1',
            itemType: 'PART',
            description: 'فلتر زيت تويوتا أصلي (Oil Filter)',
            quantity: 1,
            unit: 'قطعة',
            unitPriceBaisa: 3500,
            lineTotalBaisa: 3500,
          },
          {
            id: 'it-sample-2',
            invoiceId: 'inv-sample-1',
            itemType: 'PART',
            description: 'زيت محرك تويوتا 5W-30 تخليقي بالكامل',
            quantity: 3,
            unit: 'لتر',
            unitPriceBaisa: 3833,
            lineTotalBaisa: 11500,
          },
          {
            id: 'it-sample-3',
            invoiceId: 'inv-sample-1',
            itemType: 'LABOR',
            description: 'أجور تبديل الزيت وفحص سوائل المحرك والتشحيم',
            quantity: 1,
            unit: 'خدمة',
            unitPriceBaisa: 10000,
            lineTotalBaisa: 10000,
          },
        ],
        createdAt: new Date().toISOString(),
      };
      invoices = [sampleInvoice];
      this.setStorage('invoices', invoices);
    }

    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);

    let list = invoices;
    if (customerId) {
      list = list.filter((i) => i.customerId === customerId);
    }

    const enriched = list.map((inv) => {
      const cust = customers.find((c) => c.id === inv.customerId);
      const veh = vehicles.find((v) => v.id === inv.vehicleId);

      let invItems = inv.items;
      if (!invItems || invItems.length === 0) {
        invItems = [];
        if (inv.subtotalPartsBaisa > 0) {
          invItems.push({
            id: `it-${inv.id}-parts`,
            invoiceId: inv.id,
            itemType: 'PART',
            description: 'قطع غيار ومواد مستهلكة في الصيانة',
            quantity: 1,
            unit: 'قطعة',
            unitPriceBaisa: inv.subtotalPartsBaisa,
            lineTotalBaisa: inv.subtotalPartsBaisa,
          });
        }
        if (inv.subtotalLaborBaisa > 0) {
          invItems.push({
            id: `it-${inv.id}-labor`,
            invoiceId: inv.id,
            itemType: 'LABOR',
            description: 'خدمات وأجور فحص وصيانة دورية',
            quantity: 1,
            unit: 'خدمة',
            unitPriceBaisa: inv.subtotalLaborBaisa,
            lineTotalBaisa: inv.subtotalLaborBaisa,
          });
        }
      }

      return {
        ...inv,
        customerName: cust ? cust.fullName : inv.customerName,
        customerPhone: cust ? cust.phone : inv.customerPhone,
        isCustomerPermanent: cust ? cust.isPermanent !== false : false,
        vehiclePlate: veh ? veh.plateNumber : inv.vehiclePlate,
        items: invItems,
      };
    });

    return { success: true, data: enriched };
  }

  async getInvoiceById(id: string): Promise<IpcResult<InvoiceDTO | null>> {
    const res = await this.getInvoices();
    const inv = res.data?.find((i) => i.id === id) || null;
    return { success: true, data: inv };
  }

  async createInvoice(input: InvoiceInput): Promise<IpcResult<InvoiceDTO>> {
    const invoices = this.getStorage<InvoiceDTO[]>('invoices', []);
    const customers = this.getStorage<CustomerDTO[]>('customers', []);
    const vehicles = this.getStorage<VehicleDTO[]>('vehicles', []);

    const cust = customers.find((c) => c.id === input.customerId);
    const veh = input.vehicleId ? vehicles.find((v) => v.id === input.vehicleId) : undefined;

    const id = `inv-${Date.now()}`;
    const now = new Date();
    const invoiceDate = now.toISOString().slice(0, 10);
    const invoiceNumber = `INV-${invoiceDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const subtotalParts = input.subtotalPartsBaisa || 0;
    const subtotalLabor = input.subtotalLaborBaisa || 0;
    const discount = input.discountBaisa || 0;
    const taxRate = input.taxRatePercent ?? 5.0;
    const taxableBase = Math.max(0, subtotalParts + subtotalLabor - discount);
    const taxAmount = Math.round((taxableBase * taxRate) / 100);
    const grandTotal = taxableBase + taxAmount;
    const paidAmount = 0;
    const balanceDue = grandTotal;

    const newInvoice: InvoiceDTO = {
      id,
      invoiceNumber,
      repairOrderId: input.repairOrderId,
      customerId: input.customerId,
      customerName: cust?.fullName,
      customerPhone: cust?.phone,
      isCustomerPermanent: cust ? cust.isPermanent !== false : true,
      vehicleId: input.vehicleId,
      vehiclePlate: veh?.plateNumber,
      invoiceDate,
      status: 'ISSUED',
      subtotalPartsBaisa: subtotalParts,
      subtotalLaborBaisa: subtotalLabor,
      discountBaisa: discount,
      taxRatePercent: taxRate,
      taxAmountBaisa: taxAmount,
      grandTotalBaisa: grandTotal,
      paidAmountBaisa: paidAmount,
      balanceDueBaisa: balanceDue,
      invoiceLanguage: input.invoiceLanguage || 'ar',
      retentionPrompted: false,
      notes: input.notes,
      createdAt: now.toISOString(),
    };

    invoices.unshift(newInvoice);
    this.setStorage('invoices', invoices);

    return { success: true, data: newInvoice };
  }

  async recordPayment(input: PaymentInput): Promise<IpcResult<PaymentResult>> {
    const invoices = this.getStorage<InvoiceDTO[]>('invoices', []);
    const index = invoices.findIndex((i) => i.id === input.invoiceId);
    if (index === -1) {
      return { success: false, error: 'Invoice not found' };
    }

    const inv = invoices[index];
    if (inv.status === 'PAID' || inv.balanceDueBaisa <= 0) {
      return { success: false, error: 'Invoice is already fully paid.' };
    }
    if (input.amountBaisa > inv.balanceDueBaisa) {
      return {
        success: false,
        error: `Payment amount (${input.amountBaisa} Baisa) exceeds the outstanding balance due (${inv.balanceDueBaisa} Baisa).`,
      };
    }

    const newPaidAmount = inv.paidAmountBaisa + input.amountBaisa;
    const newBalanceDue = Math.max(0, inv.grandTotalBaisa - newPaidAmount);
    const newStatus = newBalanceDue === 0 ? 'PAID' : (newPaidAmount > 0 ? 'PARTIALLY_PAID' : inv.status);

    inv.paidAmountBaisa = newPaidAmount;
    inv.balanceDueBaisa = newBalanceDue;
    inv.status = newStatus;

    invoices[index] = inv;
    this.setStorage('invoices', invoices);

    // Record in payments ledger
    const payments = this.getStorage<PaymentDTO[]>('payments', []);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const newPayment: PaymentDTO = {
      id: `pay-${Date.now()}`,
      paymentNumber: `PAY-${dateStr.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customerId,
      customerName: inv.customerName,
      customerPhone: inv.customerPhone,
      vehiclePlate: inv.vehiclePlate,
      paymentDate: dateStr,
      amountBaisa: input.amountBaisa,
      paymentMethod: input.paymentMethod,
      referenceNumber: input.referenceNumber,
      receiptNotes: input.notes,
      createdBy: 'المشرف (Supervisor)',
      createdAt: now.toISOString(),
    };
    payments.unshift(newPayment);
    this.setStorage('payments', payments);

    const eligibility = await this.checkRetentionEligibility(inv.id);

    return {
      success: true,
      data: {
        invoice: eligibility.data?.invoice || inv,
        promptEligible: Boolean(eligibility.data?.eligible),
        customer: eligibility.data?.customer,
      },
    };
  }

  async getPayments(invoiceId?: string): Promise<IpcResult<PaymentDTO[]>> {
    const payments = this.getStorage<PaymentDTO[]>('payments', []);
    let list = payments;
    if (invoiceId && invoiceId.trim()) {
      list = list.filter((p) => p.invoiceId === invoiceId.trim());
    }
    return { success: true, data: list };
  }

  async getPaymentById(id: string): Promise<IpcResult<PaymentDTO | null>> {
    const payments = this.getStorage<PaymentDTO[]>('payments', []);
    const match = payments.find((p) => p.id === id);
    return { success: true, data: match || null };
  }

  async getSuppliers(): Promise<IpcResult<SupplierDTO[]>> {
    const suppliers = this.getStorage<SupplierDTO[]>('suppliers', [
      {
        id: 'supp-1',
        name: 'مؤسسة بهوان لقطع الغيار الأصلية (Bahwan Spare Parts)',
        phone: '+968 24561122',
        email: 'parts@bahwan.om',
        address: 'غلا الصناعية، مسقط (Ghala Industrial, Muscat)',
        notes: 'مورد معتمد لقطع تويوتا ولكزس ونيسان الأصلية',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'supp-2',
        name: 'شركة زيوت المحركات العُمانية (Oman Engine Oils Co)',
        phone: '+968 24889900',
        email: 'sales@omanoils.om',
        address: 'الوادي الكبير، مسقط (Wadi Kabir, Muscat)',
        notes: 'وكيل شل وموبيل 1 وتوتال',
        createdAt: new Date().toISOString(),
      },
    ]);
    return { success: true, data: suppliers };
  }

  async createSupplier(input: SupplierInput): Promise<IpcResult<SupplierDTO>> {
    const res = await this.getSuppliers();
    const suppliers = res.data || [];
    const newSupp: SupplierDTO = {
      id: `supp-${Date.now()}`,
      name: input.name.trim(),
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      address: input.address?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    suppliers.push(newSupp);
    this.setStorage('suppliers', suppliers);
    return { success: true, data: newSupp };
  }

  async updateSupplier(id: string, input: Partial<SupplierInput>): Promise<IpcResult<SupplierDTO>> {
    const res = await this.getSuppliers();
    const suppliers = res.data || [];
    const target = suppliers.find((s) => s.id === id);
    if (!target) return { success: false, error: 'Supplier not found' };

    if (input.name !== undefined) target.name = input.name.trim();
    if (input.phone !== undefined) target.phone = input.phone.trim();
    if (input.email !== undefined) target.email = input.email.trim();
    if (input.address !== undefined) target.address = input.address.trim();
    if (input.notes !== undefined) target.notes = input.notes.trim();

    this.setStorage('suppliers', suppliers);
    return { success: true, data: target };
  }

  async deleteSupplier(id: string): Promise<IpcResult<void>> {
    const res = await this.getSuppliers();
    const suppliers = res.data || [];
    this.setStorage('suppliers', suppliers.filter((s) => s.id !== id));
    return { success: true };
  }

  async getExpenses(startDate?: string, endDate?: string): Promise<IpcResult<ExpenseDTO[]>> {
    const expenses = this.getStorage<ExpenseDTO[]>('expenses', [
      {
        id: 'exp-1',
        expenseDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
        category: 'TOOLS_EQUIPMENT',
        amountBaisa: 35000,
        paymentMethod: 'CASH',
        payee: 'معدات المخرطة الحديثة',
        description: 'شراء شفرات مخرطة هوبات جديدة',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'exp-2',
        expenseDate: new Date(Date.now() - 86400000 * 5).toISOString().slice(0, 10),
        category: 'SUPPLIES',
        amountBaisa: 12000,
        paymentMethod: 'CASH',
        payee: 'لوازم غسيل وسلامة مهنية',
        description: 'قفازات ومنظف فرامل ومناشف ورقية',
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
    ]);
    let list = expenses;
    if (startDate) list = list.filter((e) => e.expenseDate >= startDate);
    if (endDate) list = list.filter((e) => e.expenseDate <= endDate);
    return { success: true, data: list };
  }

  async createExpense(input: ExpenseInput): Promise<IpcResult<ExpenseDTO>> {
    const res = await this.getExpenses();
    const expenses = res.data || [];
    const newExp: ExpenseDTO = {
      id: `exp-${Date.now()}`,
      expenseDate: input.expenseDate || new Date().toISOString().slice(0, 10),
      category: input.category,
      amountBaisa: input.amountBaisa,
      paymentMethod: input.paymentMethod,
      payee: input.payee.trim(),
      description: input.description?.trim(),
      receiptRef: input.receiptRef?.trim(),
      createdAt: new Date().toISOString(),
    };
    expenses.unshift(newExp);
    this.setStorage('expenses', expenses);
    return { success: true, data: newExp };
  }

  async deleteExpense(id: string): Promise<IpcResult<void>> {
    const res = await this.getExpenses();
    const expenses = res.data || [];
    this.setStorage('expenses', expenses.filter((e) => e.id !== id));
    return { success: true };
  }

  async getFinancialReport(startDateParam?: string, endDateParam?: string): Promise<IpcResult<FinancialReportDTO>> {
    const startDate = startDateParam && startDateParam.trim() ? startDateParam.trim() : '2020-01-01';
    const endDate = endDateParam && endDateParam.trim() ? endDateParam.trim() : new Date().toISOString().slice(0, 10);

    const invoicesRes = await this.getInvoices();
    const invoices = (invoicesRes.data || []).filter(
      (i) => i.invoiceDate >= startDate && i.invoiceDate <= endDate && i.status !== 'CANCELLED'
    );

    const expRes = await this.getExpenses(startDate, endDate);
    const expenses = expRes.data || [];

    const paymentsRes = await this.getPayments();
    const payments = (paymentsRes.data || []).filter(
      (p) => p.paymentDate >= startDate && p.paymentDate <= endDate
    );

    const rosRes = await this.getRepairOrders();
    const ros = (rosRes.data || []).filter(
      (r) => r.createdAt.slice(0, 10) >= startDate && r.createdAt.slice(0, 10) <= endDate
    );

    const totalInvoiced = invoices.reduce((sum, i) => sum + (i.grandTotalBaisa || 0), 0);
    const totalCollected = payments.reduce((sum, p) => sum + (p.amountBaisa || 0), 0);
    const totalOutstanding = invoices.reduce((sum, i) => sum + (i.balanceDueBaisa || 0), 0);
    const totalVat = invoices.reduce((sum, i) => sum + (i.taxAmountBaisa || 0), 0);
    const totalLabor = invoices.reduce((sum, i) => sum + (i.subtotalLaborBaisa || 0), 0);
    const totalParts = invoices.reduce((sum, i) => sum + (i.subtotalPartsBaisa || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amountBaisa || 0), 0);
    const netIncome = totalCollected - totalExpenses;

    const parts = this.getStorage<RepairOrderPartDTO[]>('repair_order_parts', []).filter(
      (p) => p.status === 'ISSUED' && p.issuedAt.slice(0, 10) >= startDate && p.issuedAt.slice(0, 10) <= endDate
    );

    const partMap: Record<string, { partCode: string; partName: string; quantity: number; totalRevenueBaisa: number }> = {};
    for (const p of parts) {
      if (!partMap[p.partCode]) {
        partMap[p.partCode] = { partCode: p.partCode, partName: p.partName, quantity: 0, totalRevenueBaisa: 0 };
      }
      partMap[p.partCode].quantity += p.quantity;
      partMap[p.partCode].totalRevenueBaisa += p.totalPriceBaisa;
    }

    const topMoving = Object.values(partMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

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
        invoicesCount: invoices.length,
        paymentsCount: payments.length,
        repairOrdersCount: ros.length,
        completedOrdersCount: ros.filter((r) => r.status === 'COMPLETED' || r.status === 'DELIVERED').length,
        topMovingParts: topMoving,
      },
    };
  }

  async listBackups(): Promise<IpcResult<BackupRecord[]>> {
    const backups = this.getStorage<BackupRecord[]>('mock_backups', [
      {
        fileName: 'garage_backup_2026-10-25_initial.db',
        fileSizeBytes: 122880,
        checksumSha256: '9f83c6b12a884b2383ec13171343ae74c8c5c76e2730de15f6ee8d203874c8ef',
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        isValid: true,
      },
    ]);
    return { success: true, data: backups };
  }

  async triggerBackup(): Promise<IpcResult<BackupResult>> {
    const backups = this.getStorage<BackupRecord[]>('mock_backups', []);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `garage_backup_${timestamp}.db`;
    const newRecord: BackupRecord = {
      fileName,
      fileSizeBytes: 147456,
      checksumSha256: 'b4a1c5d9e87f321045ab67ef8912cd34567890abcdef1234567890abcdef1234',
      createdAt: new Date().toISOString(),
      isValid: true,
    };
    backups.unshift(newRecord);
    this.setStorage('mock_backups', backups);
    return {
      success: true,
      data: {
        success: true,
        backupFile: fileName,
        checksumSha256: newRecord.checksumSha256,
        createdAt: newRecord.createdAt,
      },
    };
  }

  async restoreBackup(fileName: string): Promise<IpcResult<void>> {
    const backups = this.getStorage<BackupRecord[]>('mock_backups', []);
    const match = backups.find((b) => b.fileName === fileName);
    if (!match) return { success: false, error: 'Backup file not found' };
    return { success: true };
  }

  async markInvoiceRetentionPrompted(invoiceId: string): Promise<IpcResult<void>> {
    const invoices = this.getStorage<InvoiceDTO[]>('invoices', []);
    const inv = invoices.find((i) => i.id === invoiceId);
    if (inv) {
      inv.retentionPrompted = true;
      this.setStorage('invoices', invoices);
    }
    return { success: true };
  }

  async checkRetentionEligibility(invoiceId: string): Promise<IpcResult<{ eligible: boolean; customer?: CustomerDTO; invoice?: InvoiceDTO }>> {
    const invoices = this.getStorage<InvoiceDTO[]>('invoices', []);
    const customers = this.getStorage<CustomerDTO[]>('customers', []);

    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return { success: true, data: { eligible: false } };

    let cust = customers.find((c) => c.id === inv.customerId);
    if (!cust) {
      cust = {
        id: inv.customerId,
        fullName: inv.customerName || 'Walk-in Customer',
        phone: inv.customerPhone || '',
        isActive: true,
        isPermanent: inv.isCustomerPermanent !== undefined ? inv.isCustomerPermanent : false,
        createdAt: inv.createdAt,
        updatedAt: inv.createdAt,
      };
    }

    const isPaid = inv.status === 'PAID' || (inv.paidAmountBaisa >= inv.grandTotalBaisa && inv.balanceDueBaisa <= 0);
    const isPrinted = Boolean(inv.printedAt);
    const isTemporary = cust.isPermanent === false;
    const notPrompted = !inv.retentionPrompted;

    const eligible = isPaid && isPrinted && isTemporary && notPrompted;

    return {
      success: true,
      data: {
        eligible,
        customer: cust,
        invoice: inv,
      },
    };
  }

  async printInvoice(
    invoiceId: string,
    _language: 'ar' | 'en'
  ): Promise<IpcResult<PrintResult>> {
    const invoices = this.getStorage<InvoiceDTO[]>('invoices', []);
    const inv = invoices.find((i) => i.id === invoiceId);
    if (inv) {
      inv.printedAt = new Date().toISOString();
      this.setStorage('invoices', invoices);
    }

    const eligibility = await this.checkRetentionEligibility(invoiceId);

    return {
      success: true,
      data: {
        printed: true,
        promptEligible: Boolean(eligibility.data?.eligible),
        customer: eligibility.data?.customer,
      },
    };
  }

  async exportInvoicePdf(
    invoiceId: string,
    _language: 'ar' | 'en'
  ): Promise<IpcResult<{ filePath: string }>> {
    return {
      success: true,
      data: {
        filePath: `Invoice_${invoiceId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.pdf`,
      },
    };
  }

  async login(input: LoginInput): Promise<IpcResult<AuthSessionDTO>> {
    const creds = this.getStorage<{ username: string; password: string }>('admin_credentials', {
      username: 'admin9988',
      password: '1122334455',
    });

    if (input.username === creds.username && input.password === creds.password) {
      return {
        success: true,
        data: {
          username: creds.username,
          loginTime: new Date().toISOString(),
        },
      };
    }
    return {
      success: false,
      error: 'اسم المستخدم أو كلمة المرور غير صحيحة',
    };
  }

  async changeCredentials(input: ChangeCredentialsInput): Promise<IpcResult<void>> {
    if (input.devCode.trim() !== 'Akasha249') {
      return {
        success: false,
        error: 'رمز تفويض المطور غير صحيح. يرجى مراجعة مطور النظام AKASHA AI.',
      };
    }

    this.setStorage('admin_credentials', {
      username: input.newUsername.trim(),
      password: input.newPassword,
    });

    return { success: true };
  }

  async getPrinters(): Promise<IpcResult<PrinterInfoDTO[]>> {
    return {
      success: true,
      data: [
        {
          name: 'Canon MF440 Series (A4 Default)',
          displayName: 'طابعة المكتب الرئيسية Canon Laser A4',
          description: 'A4 Network Laser Printer',
          isDefault: true,
          status: 0,
        },
        {
          name: 'Epson TM-T88VI (Thermal Receipt)',
          displayName: 'طابعة الإيصالات الحرارية 80mm',
          description: 'POS 80mm Thermal Printer',
          isDefault: false,
          status: 0,
        },
        {
          name: 'Microsoft Print to PDF',
          displayName: 'طابعة PDF الافتراضية للويندوز',
          description: 'Virtual Document Printer',
          isDefault: false,
          status: 0,
        },
      ],
    };
  }

  async testPrint(_printerName?: string): Promise<IpcResult<void>> {
    return { success: true };
  }

  async exportInvoicePdf(invoiceId: string, _language: 'ar' | 'en'): Promise<IpcResult<{ filePath: string }>> {
    return {
      success: true,
      data: {
        filePath: `C:\\Users\\User\\AppData\\Roaming\\al-rawahi-garage\\Invoice_${invoiceId.slice(0, 8)}.pdf`,
      },
    };
  }
}

export const browserMockAdapter = new BrowserMockAdapter();
