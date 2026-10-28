/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Register New Maintenance Operation View
 * 
 * Key Capabilities:
 * - Real-time Customer Recognition & Autocomplete (partial name / phone matching)
 * - Optional Customer & Vehicle Saving: users can proceed as temporary / one-time customer
 *   without being forced to register them permanently (with optional "حفظ كعميل دائم" checkbox)
 * - Vehicle Selection or Temporary Vehicle entry with optional permanent registration
 * - Detailed Itemized Parts Selection from inventory with:
 *   * Quantity
 *   * Unit (قطعة, لتر, علبة, طقم...)
 *   * Unit Price (OMR) with line total auto-calculation (quantity × unit price)
 * - Choice of:
 *   * "حفظ كأمر صيانة (Save Repair Order)"
 *   * "إتمام العملية وإصدار الفاتورة فوراً (Complete & Issue Invoice)" with single stock deduction
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Wrench,
  Search,
  UserPlus,
  Car,
  User,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
  Layers,
  Receipt,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Phone,
  FileText,
  UserCheck,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { garageApi } from '../services/garageClient.ts';
import type {
  CustomerDTO,
  VehicleDTO,
  TechnicianDTO,
  InventoryItemDTO,
  InvoiceItemInput,
} from '../types/ipc.ts';
import { formatOMR, toBaisa, fromBaisa } from '../core/currency.ts';
import type { RouteId } from '../i18n/translations.ts';

interface ServiceItem {
  id: string;
  description: string;
  laborChargeOmr: string;
  technicianId?: string;
}

interface PartItem {
  id: string;
  inventoryItemId: string;
  partName: string;
  partCode: string;
  quantity: number;
  unit: string;
  unitPriceOmr: string;
  costPriceBaisa: number;
  availableStock: number;
}

const COMMON_UNITS = [
  'قطعة',
  'لتر',
  'علبة',
  'طقم',
  'متر',
  'كجم',
  'جالون',
];

export function RegisterMaintenanceView({ onNavigate }: { onNavigate?: (route: RouteId) => void }) {
  const { showToast } = useToast();

  // Autocomplete & Customer State
  const [customerQuery, setCustomerQuery] = useState('');
  const [matchingCustomers, setMatchingCustomers] = useState<CustomerDTO[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Customer Mode: 'search' vs 'manual'
  const [customerMode, setCustomerMode] = useState<'search' | 'manual'>('search');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAltPhone, setNewCustAltPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [saveAsPermanentCustomer, setSaveAsPermanentCustomer] = useState(false);

  // Vehicle State
  const [customerVehicles, setCustomerVehicles] = useState<VehicleDTO[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [isEnteringNewVehicle, setIsEnteringNewVehicle] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newMake, setNewMake] = useState('Toyota');
  const [newModel, setNewModel] = useState('');
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [newVin, setNewVin] = useState('');
  const [newOdometer, setNewOdometer] = useState('45000');
  const [newColor, setNewColor] = useState('');
  const [saveAsPermanentVehicle, setSaveAsPermanentVehicle] = useState(false);

  // Operation Details
  const [reportedProblem, setReportedProblem] = useState('');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [odometerIn, setOdometerIn] = useState('');
  const [expectedDate, setExpectedDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );

  // Services & Labor List
  const [services, setServices] = useState<ServiceItem[]>([
    { id: '1', description: 'فحص ميكانيكي وكهربائي شامل', laborChargeOmr: '10.000' },
  ]);

  // Spare Parts List (Itemized)
  const [allocatedParts, setAllocatedParts] = useState<PartItem[]>([]);

  // Catalogs
  const [technicians, setTechnicians] = useState<TechnicianDTO[]>([]);
  const [inventory, setInventory] = useState<InventoryItemDTO[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<'ro' | 'invoice' | null>(null);

  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Load Catalogs on mount
  useEffect(() => {
    garageApi.getTechnicians().then((res) => {
      if (res.success && res.data) setTechnicians(res.data.filter((t) => t.isActive));
    });
    garageApi.getInventory().then((res) => {
      if (res.success && res.data) setInventory(res.data.filter((i) => i.isActive));
    });
  }, []);

  // Debounced Customer Autocomplete Search
  useEffect(() => {
    if (customerMode !== 'search' || selectedCustomer) return;
    const clean = customerQuery.trim();
    if (clean.length < 1) {
      setMatchingCustomers([]);
      setShowCustomerDropdown(false);
      return;
    }

    setIsSearchingCustomers(true);
    const timer = setTimeout(async () => {
      try {
        const res = await garageApi.getCustomers(clean, false, true);
        if (res.success && res.data) {
          setMatchingCustomers(res.data);
          setShowCustomerDropdown(true);
        }
      } catch {
        // silent fail for autocomplete
      } finally {
        setIsSearchingCustomers(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [customerQuery, selectedCustomer, customerMode]);

  // Load vehicles when customer is selected
  useEffect(() => {
    if (selectedCustomer) {
      garageApi.getVehicles({ customerId: selectedCustomer.id }).then((res) => {
        if (res.success && res.data) {
          setCustomerVehicles(res.data);
          if (res.data.length > 0) {
            setSelectedVehicleId(res.data[0].id);
            setOdometerIn(res.data[0].odometer.toString());
            setIsEnteringNewVehicle(false);
          } else {
            setSelectedVehicleId('');
            setIsEnteringNewVehicle(true);
          }
        }
      });
    } else {
      setCustomerVehicles([]);
      setSelectedVehicleId('');
    }
  }, [selectedCustomer]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Customer selection handler
  const handleSelectCustomer = (customer: CustomerDTO) => {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.fullName);
    setShowCustomerDropdown(false);
    setCustomerMode('search');
    setIsEnteringNewVehicle(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
    setCustomerVehicles([]);
    setSelectedVehicleId('');
    setCustomerMode('search');
  };

  const handleSwitchToManualCustomer = () => {
    setSelectedCustomer(null);
    setCustomerMode('manual');
    setShowCustomerDropdown(false);
    if (customerQuery.trim().length > 0 && !newCustName) {
      setNewCustName(customerQuery.trim());
    }
    setIsEnteringNewVehicle(true);
  };

  // Services Management
  const handleAddService = () => {
    setServices((prev) => [
      ...prev,
      { id: Date.now().toString(), description: '', laborChargeOmr: '5.000' },
    ]);
  };

  const handleRemoveService = (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateService = (id: string, field: keyof ServiceItem, value: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  // Parts Allocation (Detailed Line Items)
  const handleAddPart = (item: InventoryItemDTO) => {
    const existing = allocatedParts.find((p) => p.inventoryItemId === item.id);
    if (existing) {
      setAllocatedParts((prev) =>
        prev.map((p) =>
          p.inventoryItemId === item.id ? { ...p, quantity: p.quantity + 1 } : p
        )
      );
      showToast(`تمت زيادة كمية "${item.name}" إلى ${existing.quantity + 1}`, 'info');
    } else {
      setAllocatedParts((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          inventoryItemId: item.id,
          partName: item.name,
          partCode: item.partCode,
          quantity: 1,
          unit: item.unit || 'قطعة',
          unitPriceOmr: fromBaisa(item.sellingPriceBaisa).toFixed(3),
          costPriceBaisa: item.purchaseCostBaisa || 0,
          availableStock: item.quantityInStock,
        },
      ]);
    }
  };

  const handleUpdatePartQuantity = (id: string, qty: number) => {
    if (qty <= 0) return;
    setAllocatedParts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, quantity: qty } : p))
    );
  };

  const handleUpdatePartUnit = (id: string, unit: string) => {
    setAllocatedParts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, unit } : p))
    );
  };

  const handleUpdatePartPrice = (id: string, priceOmr: string) => {
    setAllocatedParts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, unitPriceOmr: priceOmr } : p))
    );
  };

  const handleRemovePart = (id: string) => {
    setAllocatedParts((prev) => prev.filter((p) => p.id !== id));
  };

  // Financial Calculations (Strict Integer Baisa)
  const totalLaborBaisa = services.reduce(
    (sum, s) => sum + toBaisa(parseFloat(s.laborChargeOmr) || 0),
    0
  );
  const totalPartsBaisa = allocatedParts.reduce(
    (sum, p) => sum + Math.round(toBaisa(parseFloat(p.unitPriceOmr) || 0) * (p.quantity || 1)),
    0
  );
  const subtotalBaisa = totalLaborBaisa + totalPartsBaisa;
  const vatAmountBaisa = Math.round((subtotalBaisa * 5) / 100);
  const grandEstimatedBaisa = subtotalBaisa + vatAmountBaisa;

  // Resolve Customer & Vehicle resolution helper (creates temporary or permanent records transparently)
  const resolveCustomerAndVehicle = async (): Promise<{ customer: CustomerDTO; vehicle: VehicleDTO } | null> => {
    let resolvedCustomer: CustomerDTO | null = selectedCustomer;

    // 1. Resolve Customer
    if (!resolvedCustomer) {
      if (!newCustName.trim() || newCustName.trim().length < 2) {
        showToast('يرجى كتابة اسم العميل (حرفين على الأقل)', 'error');
        return null;
      }

      const custRes = await garageApi.createCustomer({
        fullName: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        altPhone: newCustAltPhone.trim() || undefined,
        address: newCustAddress.trim() || undefined,
        isPermanent: saveAsPermanentCustomer,
      });

      if (!custRes.success || !custRes.data) {
        showToast(custRes.error || 'تعذر تسجيل العميل', 'error');
        return null;
      }
      resolvedCustomer = custRes.data;
    }

    // 2. Resolve Vehicle
    let resolvedVehicle: VehicleDTO | null = null;
    if (selectedVehicleId && !isEnteringNewVehicle) {
      const found = customerVehicles.find((v) => v.id === selectedVehicleId);
      if (found) resolvedVehicle = found;
    }

    if (!resolvedVehicle) {
      if (!newPlate.trim()) {
        showToast('يرجى إدخال رقم لوحة المركبة', 'error');
        return null;
      }

      const vehRes = await garageApi.createVehicle({
        customerId: resolvedCustomer.id,
        plateNumber: newPlate.trim(),
        make: newMake.trim() || 'Toyota',
        model: newModel.trim() || 'صالون',
        year: parseInt(newYear) || new Date().getFullYear(),
        vin: newVin.trim() || undefined,
        odometer: parseInt(newOdometer || odometerIn) || 0,
        color: newColor.trim() || undefined,
        isPermanent: saveAsPermanentVehicle,
      });

      if (!vehRes.success || !vehRes.data) {
        showToast(vehRes.error || 'تعذر تسجيل بيانات المركبة', 'error');
        return null;
      }
      resolvedVehicle = vehRes.data;
    }

    return { customer: resolvedCustomer, vehicle: resolvedVehicle };
  };

  // Submit Handler: either Save Repair Order OR Complete & Issue Invoice immediately
  const handleFinalSubmit = async (mode: 'ro' | 'invoice') => {
    if (!reportedProblem.trim()) {
      showToast('يرجى كتابة المشكلة المبلغ عنها أو وصف الصيانة', 'error');
      return;
    }

    setIsSubmitting(true);
    setSubmitMode(mode);

    try {
      const resolved = await resolveCustomerAndVehicle();
      if (!resolved) {
        setIsSubmitting(false);
        setSubmitMode(null);
        return;
      }

      const { customer, vehicle } = resolved;
      const selectedTechObj = technicians.find((t) => t.id === selectedTechnicianId);

      // Create Repair Order
      const roRes = await garageApi.createRepairOrder({
        customerId: customer.id,
        vehicleId: vehicle.id,
        reportedProblem: reportedProblem.trim(),
        inspectionNotes: inspectionNotes.trim() || undefined,
        odometerIn: parseInt(odometerIn || newOdometer) || vehicle.odometer || 0,
        estimatedCostBaisa: grandEstimatedBaisa,
        assignedTechnicianId: selectedTechnicianId || undefined,
        assignedTechnicianName: selectedTechObj?.name,
        expectedAt: expectedDate,
      });

      if (!roRes.success || !roRes.data) {
        showToast(roRes.error || 'تعذر إنشاء أمر الصيانة', 'error');
        setIsSubmitting(false);
        setSubmitMode(null);
        return;
      }

      const roId = roRes.data.id;

      // Add labor tasks to RO
      for (const serv of services) {
        if (serv.description.trim()) {
          await garageApi.addLaborTask({
            repairOrderId: roId,
            description: serv.description.trim(),
            laborChargeBaisa: toBaisa(parseFloat(serv.laborChargeOmr) || 0),
            technicianId: serv.technicianId || selectedTechnicianId || undefined,
            hours: 1.0,
          });
        }
      }

      // If user chose "Complete & Issue Invoice immediately":
      if (mode === 'invoice') {
        // Build itemized invoice items
        const invoiceItems: InvoiceItemInput[] = [];

        // Add Labor items
        for (const serv of services) {
          if (serv.description.trim()) {
            const chargeBaisa = toBaisa(parseFloat(serv.laborChargeOmr) || 0);
            invoiceItems.push({
              itemType: 'LABOR',
              description: serv.description.trim(),
              quantity: 1,
              unit: 'خدمة',
              unitPriceBaisa: chargeBaisa,
              costPriceBaisa: 0,
              lineTotalBaisa: chargeBaisa,
            });
          }
        }

        // Add Part items (with inventory link, quantity, and unit)
        for (const part of allocatedParts) {
          const unitPriceBaisa = toBaisa(parseFloat(part.unitPriceOmr) || 0);
          const lineTotalBaisa = Math.round(unitPriceBaisa * part.quantity);
          invoiceItems.push({
            itemType: 'PART',
            sourceId: part.inventoryItemId,
            description: `${part.partName} (${part.partCode})`,
            quantity: part.quantity,
            unit: part.unit || 'قطعة',
            unitPriceBaisa,
            costPriceBaisa: part.costPriceBaisa || 0,
            lineTotalBaisa,
          });
        }

        // Create Invoice with itemized list - automatically decrements inventory exactly once!
        const invRes = await garageApi.createInvoice({
          customerId: customer.id,
          vehicleId: vehicle.id,
          repairOrderId: roId,
          subtotalPartsBaisa: totalPartsBaisa,
          subtotalLaborBaisa: totalLaborBaisa,
          discountBaisa: 0,
          taxRatePercent: 5.0,
          invoiceLanguage: 'ar',
          notes: reportedProblem.trim(),
          items: invoiceItems,
        });

        if (invRes.success && invRes.data) {
          showToast(`تم إتمام العملية وإصدار الفاتورة رقم ${invRes.data.invoiceNumber} بنجاح!`, 'success');
          if (onNavigate) {
            onNavigate('invoices');
          }
        } else {
          showToast(invRes.error || 'تم حفظ أمر الصيانة ولكن تعذر إصدار الفاتورة', 'error');
          if (onNavigate) {
            onNavigate('repairOrders');
          }
        }
      } else {
        // Mode 'ro' (Save Repair Order only): issue allocated parts to RO
        for (const part of allocatedParts) {
          await garageApi.issuePartToRO({
            repairOrderId: roId,
            itemId: part.inventoryItemId,
            quantity: part.quantity,
            unitPriceBaisa: toBaisa(parseFloat(part.unitPriceOmr) || 0),
          });
        }

        showToast(`تم تسجيل عملية الصيانة بنجاح برقم: ${roRes.data.roNumber}`, 'success');
        if (onNavigate) {
          onNavigate('repairOrders');
        }
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'خطأ أثناء حفظ عملية الصيانة', 'error');
    } finally {
      setIsSubmitting(false);
      setSubmitMode(null);
    }
  };

  const filteredInventory = inventory.filter((item) => {
    if (!inventorySearch.trim()) return true;
    const q = inventorySearch.toLowerCase().trim();
    return (
      item.name.toLowerCase().includes(q) ||
      item.partCode.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  return (
    <div dir="rtl" className="space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1c273a] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                تسجيل عملية صيانة جديدة
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                استقبال العميل (دائم أو مؤقت)، اختيار المركبة، تسعير البنود من المخزون، وإصدار الفاتورة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate && onNavigate('dashboard')}
          >
            إلغاء والعودة
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<CheckCircle2 className="w-4 h-4 text-sky-400" />}
            onClick={() => handleFinalSubmit('ro')}
            disabled={isSubmitting}
          >
            {isSubmitting && submitMode === 'ro' ? 'جارٍ الحفظ...' : 'حفظ كأمر صيانة'}
          </Button>
          <Button
            variant="gold"
            size="md"
            icon={<Receipt className="w-4 h-4" />}
            onClick={() => handleFinalSubmit('invoice')}
            disabled={isSubmitting}
          >
            {isSubmitting && submitMode === 'invoice' ? 'جارٍ إصدار الفاتورة...' : 'إتمام وإصدار الفاتورة فوراً'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Customer, Vehicle & Service Intake */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Customer Intake with Autocomplete & Optional Permanent Saving */}
          <Card className="bg-[#0f1522] border-[#1d273a]">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                  <User className="w-4 h-4 text-amber-400" />
                  <span>1. بيانات العميل (التعرف التلقائي أو إدخال مؤقت)</span>
                </div>
                {!selectedCustomer && (
                  <div className="flex items-center gap-2 text-xs">
                    {customerMode === 'search' ? (
                      <button
                        type="button"
                        onClick={handleSwitchToManualCustomer}
                        className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>إدخال عميل جديد / مؤقت مباشرة</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCustomerMode('search')}
                        className="text-slate-400 hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>الرجوع للبحث التلقائي</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Customer View */}
              {selectedCustomer ? (
                <div className="p-4 rounded-xl bg-[#141d2f] border border-amber-500/40 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {selectedCustomer.fullName}
                      </span>
                      <Badge variant={selectedCustomer.isPermanent ? 'emerald' : 'sky'}>
                        {selectedCustomer.isPermanent ? 'عميل دائم مسجل' : 'عميل زيارة مؤقتة'}
                      </Badge>
                    </div>
                    {selectedCustomer.phone && (
                      <div className="text-xs text-slate-300 font-mono flex items-center gap-1.5" dir="ltr">
                        <Phone className="w-3 h-3 text-amber-400" />
                        <span>{selectedCustomer.phone}</span>
                      </div>
                    )}
                    {selectedCustomer.address && (
                      <div className="text-xs text-slate-400">العنوان: {selectedCustomer.address}</div>
                    )}
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleClearCustomer}>
                    تغيير العميل
                  </Button>
                </div>
              ) : customerMode === 'manual' ? (
                /* Manual / Temporary Customer Entry (No forced pre-save) */
                <div className="p-4 rounded-xl bg-[#121927] border border-[#273752] space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400">
                      بيانات العميل لهذه العملية (يمكن المتابعة دون تسجيل دائم):
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        اسم العميل الكامل *
                      </label>
                      <Input
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        placeholder="مثال: سالم بن حمد الرواحي"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        رقم الهاتف
                      </label>
                      <Input
                        value={newCustPhone}
                        onChange={(e) => setNewCustPhone(e.target.value)}
                        placeholder="+968 91234567"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        هاتف إضافي (اختياري)
                      </label>
                      <Input
                        value={newCustAltPhone}
                        onChange={(e) => setNewCustAltPhone(e.target.value)}
                        placeholder="+968 98765432"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        العنوان / المنطقة
                      </label>
                      <Input
                        value={newCustAddress}
                        onChange={(e) => setNewCustAddress(e.target.value)}
                        placeholder="مسقط، السيب، الخوض..."
                      />
                    </div>
                  </div>

                  {/* Optional Permanent Customer Checkbox */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={saveAsPermanentCustomer}
                        onChange={(e) => setSaveAsPermanentCustomer(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="font-semibold text-amber-300">
                        حفظ كعميل دائم في سجلات الورشة (Save as permanent customer)
                      </span>
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {saveAsPermanentCustomer ? 'سيتم إدراجه بقائمة العملاء الدائمين' : 'سيتم الحساب كزيارة مؤقتة لهذه الفاتورة'}
                    </span>
                  </div>
                </div>
              ) : (
                /* Autocomplete Search Input with Recognition */
                <div ref={autocompleteRef} className="relative">
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    اكتب اسم العميل أو رقم الهاتف للتعرف التلقائي على ملفه:
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      placeholder="ابدأ بكتابة اسم العميل أو رقمه (مثال: سالم، 91234567)..."
                      className="w-full pl-3 pr-10 py-2.5 bg-[#141d2f] border border-[#273752] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    {isSearchingCustomers && (
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-amber-400">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Autocomplete Dropdown */}
                  {showCustomerDropdown && (
                    <div className="absolute top-full right-0 left-0 mt-1.5 bg-[#101726] border border-[#24344d] rounded-xl shadow-2xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-800/80">
                      {matchingCustomers.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          لم يتم العثور على عميل مطابق.{' '}
                          <button
                            type="button"
                            onClick={handleSwitchToManualCustomer}
                            className="text-amber-400 font-bold hover:underline ml-1"
                          >
                            المتابعة كعميل جديد / مؤقت؟
                          </button>
                        </div>
                      ) : (
                        matchingCustomers.map((cust) => (
                          <button
                            key={cust.id}
                            type="button"
                            onClick={() => handleSelectCustomer(cust)}
                            className="w-full p-3 text-right hover:bg-[#182337] flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <div>
                              <div className="font-bold text-white text-xs flex items-center gap-2">
                                <span>{cust.fullName}</span>
                                <Badge variant={cust.isPermanent ? 'emerald' : 'sky'} size="sm">
                                  {cust.isPermanent ? 'دائم' : 'مؤقت'}
                                </Badge>
                              </div>
                              {cust.address && (
                                <div className="text-[11px] text-slate-400">{cust.address}</div>
                              )}
                            </div>
                            <div className="text-left font-mono text-xs text-amber-300" dir="ltr">
                              {cust.phone || 'بدون هاتف'}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Vehicle Selection or Temporary Vehicle Intake */}
          <Card className="bg-[#0f1522] border-[#1d273a]">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                  <Car className="w-4 h-4 text-amber-400" />
                  <span>2. بيانات المركبة (Vehicle Selection)</span>
                </div>
                {selectedCustomer && customerVehicles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsEnteringNewVehicle(!isEnteringNewVehicle)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    {isEnteringNewVehicle ? 'عرض سيارات العميل المسجلة' : '+ تسجيل مركبة جديدة/مؤقتة'}
                  </button>
                )}
              </div>

              {/* Vehicle Options */}
              {isEnteringNewVehicle || !selectedCustomer || customerVehicles.length === 0 ? (
                /* New or Temporary Vehicle Form */
                <div className="p-4 rounded-xl bg-[#121927] border border-[#273752] space-y-4">
                  <div className="text-xs font-bold text-amber-400">
                    بيانات المركبة لهذه العملية (اللوحة، الطراز، وسنة الصنع):
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        رقم اللوحة * (مثال: 12345 A)
                      </label>
                      <Input
                        value={newPlate}
                        onChange={(e) => setNewPlate(e.target.value)}
                        placeholder="12345 A"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        الشركة الصانعة *
                      </label>
                      <Input
                        value={newMake}
                        onChange={(e) => setNewMake(e.target.value)}
                        placeholder="Toyota, Lexus, Nissan..."
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        الموديل *
                      </label>
                      <Input
                        value={newModel}
                        onChange={(e) => setNewModel(e.target.value)}
                        placeholder="Land Cruiser, Patrol..."
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        سنة الصنع
                      </label>
                      <Input
                        type="number"
                        value={newYear}
                        onChange={(e) => setNewYear(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        قراءة العداد (كم)
                      </label>
                      <Input
                        type="number"
                        value={newOdometer}
                        onChange={(e) => {
                          setNewOdometer(e.target.value);
                          setOdometerIn(e.target.value);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        رقم الشاصي (VIN) - اختياري
                      </label>
                      <Input
                        value={newVin}
                        onChange={(e) => setNewVin(e.target.value)}
                        placeholder="JTEBU5JR2N5..."
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Optional Permanent Vehicle Checkbox */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={saveAsPermanentVehicle}
                        onChange={(e) => setSaveAsPermanentVehicle(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-amber-500 cursor-pointer"
                      />
                      <span className="font-semibold text-amber-300">
                        حفظ المركبة بشكل دائم في السجلات (Save as permanent vehicle)
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                /* Select from existing customer vehicles */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {customerVehicles.map((v) => {
                    const isSelected = selectedVehicleId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVehicleId(v.id);
                          setOdometerIn(v.odometer.toString());
                          if (v.vin) {
                            setNewVin(v.vin);
                          }
                        }}
                        className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 shadow-md ring-1 ring-amber-500'
                            : 'bg-[#141d2f] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-amber-300 bg-black/60 px-2 py-0.5 rounded border border-amber-500/40 text-xs">
                            {v.plateNumber}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {v.odometer.toLocaleString()} كم
                          </span>
                        </div>
                        <div className="mt-2 text-xs font-semibold text-slate-100 flex items-center justify-between">
                          <span>{v.make} {v.model} ({v.year})</span>
                          {v.vin && (
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30" dir="ltr">
                              VIN: {v.vin}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Maintenance Diagnosis & Problem */}
          <Card className="bg-[#0f1522] border-[#1d273a]">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-100 border-b border-slate-800 pb-3">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>3. تشخيص العطل وبيانات الدخول</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    الفني المسؤول المشرف
                  </label>
                  <select
                    value={selectedTechnicianId}
                    onChange={(e) => setSelectedTechnicianId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#141d2f] border border-[#273752] rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">-- اختر الفني المشرف --</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name} ({tech.specialty || 'ميكانيكا'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    قراءة العداد عند الاستقبال (كم)
                  </label>
                  <Input
                    type="number"
                    value={odometerIn}
                    onChange={(e) => setOdometerIn(e.target.value)}
                    placeholder="45000"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    موعد التسليم المتوقع
                  </label>
                  <Input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  المشكلة المبلغ عنها / شكوى العميل *
                </label>
                <textarea
                  value={reportedProblem}
                  onChange={(e) => setReportedProblem(e.target.value)}
                  rows={2}
                  placeholder="وصف المشكلة (مثال: تبديل زيت وفلتر أصلي، فحص صوت طقطقة في الفرامل، ميزانية رودات...)"
                  className="w-full px-3 py-2 bg-[#141d2f] border border-[#273752] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  ملاحظات الفحص والمعاينة الأولية
                </label>
                <textarea
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  rows={2}
                  placeholder="ملاحظات إضافية (حالة الإطارات، وجود خدوش سابقة، سوائل المحرك...)"
                  className="w-full px-3 py-2 bg-[#141d2f] border border-[#273752] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Step 4: Services & Labor Tasks */}
          <Card className="bg-[#0f1522] border-[#1d273a]">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>4. بنود أجور اليد والخدمات المطلوبة</span>
                </div>
                <Button variant="ghost" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddService}>
                  إضافة خدمة أخرى
                </Button>
              </div>

              <div className="space-y-2.5">
                {services.map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row items-center gap-2 bg-[#141d2f] p-3 rounded-xl border border-slate-800"
                  >
                    <span className="text-xs font-mono text-slate-400 w-6 text-center">{idx + 1}</span>
                    <div className="flex-1 w-full">
                      <Input
                        value={s.description}
                        onChange={(e) => handleUpdateService(s.id, 'description', e.target.value)}
                        placeholder="بيان العمل / الخدمة (مثال: أجور يد تبديل زيت وفلتر، فك وتركيب فحمات...)"
                      />
                    </div>
                    <div className="w-full sm:w-36">
                      <Input
                        type="number"
                        step="0.500"
                        value={s.laborChargeOmr}
                        onChange={(e) => handleUpdateService(s.id, 'laborChargeOmr', e.target.value)}
                        placeholder="الأجر (ر.ع)"
                        dir="ltr"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveService(s.id)}
                      disabled={services.length <= 1}
                      className="p-2 text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Itemized Spare Parts Picker & Financial Summary */}
        <div className="space-y-6">
          {/* Detailed Itemized Spare Parts Allocation */}
          <Card className="bg-[#0f1522] border-[#1d273a]">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>قطع الغيار والمواد من المخزون</span>
                </div>
                <Badge variant="gold" size="sm">
                  {allocatedParts.length} {allocatedParts.length === 1 ? 'بند' : 'بنود'}
                </Badge>
              </div>

              {/* Selected Itemized Parts Table / Cards */}
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {allocatedParts.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    لم يتم اختيار قطع غيار بعد. اختر المنتجات من قائمة المستودع أدناه لتسعيرها كبنود تفصيلية.
                  </div>
                ) : (
                  allocatedParts.map((p) => {
                    const lineTotal = (parseFloat(p.unitPriceOmr) || 0) * (p.quantity || 1);
                    return (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-[#141d2f] border border-slate-800 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white text-xs">{p.partName}</span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              كود: {p.partCode} (المتوفر: {p.availableStock})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePart(p.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Editable Quantity, Unit, Unit Price, Line Total */}
                        <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-slate-800/60">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">الكمية</label>
                            <input
                              type="number"
                              min="1"
                              value={p.quantity}
                              onChange={(e) => handleUpdatePartQuantity(p.id, parseInt(e.target.value) || 1)}
                              className="w-full bg-[#0c121e] border border-slate-700 rounded px-1.5 py-1 text-xs text-white font-mono text-center"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">الوحدة</label>
                            <select
                              value={p.unit}
                              onChange={(e) => handleUpdatePartUnit(p.id, e.target.value)}
                              className="w-full bg-[#0c121e] border border-slate-700 rounded px-1 py-1 text-xs text-white"
                            >
                              {COMMON_UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">السعر (ر.ع)</label>
                            <input
                              type="number"
                              step="0.100"
                              value={p.unitPriceOmr}
                              onChange={(e) => handleUpdatePartPrice(p.id, e.target.value)}
                              className="w-full bg-[#0c121e] border border-slate-700 rounded px-1.5 py-1 text-xs text-amber-300 font-mono text-center"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">الإجمالي</label>
                            <div className="font-mono font-bold text-emerald-400 text-xs py-1 text-center bg-emerald-500/10 rounded border border-emerald-500/20">
                              {lineTotal.toFixed(3)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Inventory Quick Search & Picker */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                  <span>منتجات المستودع المتاحة:</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="ابحث برقم القطعة أو الاسم (مثال: فلتر، زيت...)"
                    className="w-full px-2.5 py-1.5 bg-[#141d2f] border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                  {filteredInventory.length === 0 ? (
                    <div className="text-center py-2 text-[11px] text-slate-500">لا توجد قطع مطابقة للبحث</div>
                  ) : (
                    filteredInventory.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAddPart(item)}
                        className="w-full p-2 rounded-lg bg-[#111827] hover:bg-[#182337] border border-slate-800 flex items-center justify-between text-xs text-right transition-colors cursor-pointer"
                      >
                        <div className="min-w-0 pr-1">
                          <div className="font-medium text-slate-200 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {item.partCode} • {item.unit || 'قطعة'}
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="font-mono font-bold text-amber-300">
                            {fromBaisa(item.sellingPriceBaisa).toFixed(3)} ر.ع
                          </div>
                          <div className="text-[10px] text-emerald-400">
                            متوفر: {item.quantityInStock}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Itemized Calculation Summary Card */}
          <Card className="bg-[#0f1522] border-[#1d273a]">
            <CardContent className="p-5 space-y-3">
              <div className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-3 flex items-center justify-between">
                <span>ملخص الحساب المالي المعتمد</span>
                <span className="text-[11px] text-amber-400 font-normal">دقة 3 خانات OMR</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>إجمالي أجور اليد ({services.length} بنود):</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {formatOMR(fromBaisa(totalLaborBaisa))}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>إجمالي قطع الغيار والمواد ({allocatedParts.length} بنود):</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {formatOMR(fromBaisa(totalPartsBaisa))}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-2">
                  <span>ضريبة القيمة المضافة (5% VAT):</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {formatOMR(fromBaisa(vatAmountBaisa))}
                  </span>
                </div>
                <div className="flex justify-between text-white font-bold text-sm border-t-2 border-slate-800 pt-2.5">
                  <span>المجموع النهائي المستحق:</span>
                  <span className="font-mono text-base text-amber-400">
                    {formatOMR(fromBaisa(grandEstimatedBaisa))}
                  </span>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <Button
                  variant="gold"
                  size="md"
                  className="w-full"
                  icon={<Receipt className="w-4 h-4" />}
                  onClick={() => handleFinalSubmit('invoice')}
                  disabled={isSubmitting}
                >
                  {isSubmitting && submitMode === 'invoice' ? 'جارٍ إصدار الفاتورة...' : 'إتمام العملية وإصدار الفاتورة فوراً'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-slate-300"
                  icon={<CheckCircle2 className="w-4 h-4 text-sky-400" />}
                  onClick={() => handleFinalSubmit('ro')}
                  disabled={isSubmitting}
                >
                  {isSubmitting && submitMode === 'ro' ? 'جارٍ الحفظ...' : 'حفظ كأمر صيانة للمتابعة لاحقاً'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
