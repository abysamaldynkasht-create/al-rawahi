/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Register New Maintenance Operation View
 * 
 * Core Workflows:
 * - Customer Autocomplete Search with Phone Disambiguation
 * - Explicit Customer Saving (No typing auto-save)
 * - Vehicle Selection / Inline Registration with Omani Plate Validation
 * - Labor & Services Addition with Technician Assignment
 * - Real Spare Parts Allocation from Inventory with Stock Verification
 * - Live Itemized Cost Breakdown in Integer Baisa
 * - Explicit Creation of Repair Order
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
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Phone,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input, SearchInput } from '../components/ui/Input.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { garageApi } from '../services/garageClient.ts';
import type {
  CustomerDTO,
  VehicleDTO,
  TechnicianDTO,
  InventoryItemDTO,
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
  unitPriceOmr: string;
  availableStock: number;
}

export function RegisterMaintenanceView({ onNavigate }: { onNavigate?: (route: RouteId) => void }) {
  const { showToast } = useToast();

  // Autocomplete & Customer State
  const [customerQuery, setCustomerQuery] = useState('');
  const [matchingCustomers, setMatchingCustomers] = useState<CustomerDTO[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // New Customer Inline Form (Explicit Save Required)
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAltPhone, setNewCustAltPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Vehicle Selection & Inline Form
  const [customerVehicles, setCustomerVehicles] = useState<VehicleDTO[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [isAddingNewVehicle, setIsAddingNewVehicle] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newMake, setNewMake] = useState('Toyota');
  const [newModel, setNewModel] = useState('');
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [newVin, setNewVin] = useState('');
  const [newOdometer, setNewOdometer] = useState('45000');
  const [newColor, setNewColor] = useState('');
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);

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

  // Spare Parts List
  const [allocatedParts, setAllocatedParts] = useState<PartItem[]>([]);

  // Catalogs
  const [technicians, setTechnicians] = useState<TechnicianDTO[]>([]);
  const [inventory, setInventory] = useState<InventoryItemDTO[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (selectedCustomer) return;
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
    }, 250);

    return () => clearTimeout(timer);
  }, [customerQuery, selectedCustomer]);

  // Load vehicles when customer is selected
  useEffect(() => {
    if (selectedCustomer) {
      garageApi.getVehicles({ customerId: selectedCustomer.id }).then((res) => {
        if (res.success && res.data) {
          setCustomerVehicles(res.data);
          if (res.data.length > 0) {
            setSelectedVehicleId(res.data[0].id);
            setOdometerIn(res.data[0].odometer.toString());
          } else {
            setSelectedVehicleId('');
            setIsAddingNewVehicle(true);
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
    setIsAddingNewCustomer(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
    setCustomerVehicles([]);
    setSelectedVehicleId('');
  };

  // Explicitly Save New Customer
  const handleSaveNewCustomer = async () => {
    if (!newCustName.trim() || newCustName.trim().length < 2) {
      showToast('يجب إدخال اسم العميل بشكل صحيح', 'error');
      return;
    }

    setIsSavingCustomer(true);
    try {
      const res = await garageApi.createCustomer({
        fullName: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        altPhone: newCustAltPhone.trim() || undefined,
        address: newCustAddress.trim() || undefined,
        isPermanent: true,
      });

      if (res.success && res.data) {
        showToast('تم حفظ العميل بنجاح في قاعدة البيانات', 'success');
        setSelectedCustomer(res.data);
        setCustomerQuery(res.data.fullName);
        setIsAddingNewCustomer(false);
      } else {
        showToast(res.error || 'تعذر حفظ العميل', 'error');
      }
    } catch {
      showToast('خطأ أثناء حفظ العميل', 'error');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Explicitly Save New Vehicle
  const handleSaveNewVehicle = async () => {
    if (!selectedCustomer) {
      showToast('يرجى تحديد العميل أولاً لربط المركبة به', 'error');
      return;
    }
    if (!newPlate.trim()) {
      showToast('يرجى إدخال رقم اللوحة', 'error');
      return;
    }

    setIsSavingVehicle(true);
    try {
      const dupCheck = await garageApi.checkVehicleDuplicates(newPlate.trim(), newVin.trim() || undefined);
      if (dupCheck.success && dupCheck.data?.plateExists) {
        showToast('رقم اللوحة هذا مسجل بالفعل لمركبة أخرى في الكراج', 'error');
        setIsSavingVehicle(false);
        return;
      }

      const res = await garageApi.createVehicle({
        customerId: selectedCustomer.id,
        plateNumber: newPlate.trim(),
        make: newMake.trim(),
        model: newModel.trim() || 'صالون',
        year: parseInt(newYear) || new Date().getFullYear(),
        vin: newVin.trim() || undefined,
        odometer: parseInt(newOdometer) || 0,
        color: newColor.trim() || undefined,
      });

      if (res.success && res.data) {
        showToast('تم حفظ المركبة وربطها بالعميل بنجاح', 'success');
        setCustomerVehicles((prev) => [...prev, res.data!]);
        setSelectedVehicleId(res.data.id);
        setOdometerIn(res.data.odometer.toString());
        setIsAddingNewVehicle(false);
      } else {
        showToast(res.error || 'تعذر حفظ المركبة', 'error');
      }
    } catch {
      showToast('خطأ أثناء حفظ المركبة', 'error');
    } finally {
      setIsSavingVehicle(false);
    }
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

  // Parts Allocation
  const handleAddPart = (item: InventoryItemDTO) => {
    const existing = allocatedParts.find((p) => p.inventoryItemId === item.id);
    if (existing) {
      if (existing.quantity >= item.quantityInStock) {
        showToast(`لا يتوفر رصيد كافٍ من "${item.name}". المتوفر حالياً: ${item.quantityInStock}`, 'error');
        return;
      }
      setAllocatedParts((prev) =>
        prev.map((p) =>
          p.inventoryItemId === item.id ? { ...p, quantity: p.quantity + 1 } : p
        )
      );
    } else {
      if (item.quantityInStock <= 0) {
        showToast(`هذه القطعة نفدت من المستودع`, 'error');
        return;
      }
      setAllocatedParts((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          inventoryItemId: item.id,
          partName: item.name,
          partCode: item.partCode,
          quantity: 1,
          unitPriceOmr: fromBaisa(item.sellingPriceBaisa).toFixed(3),
          availableStock: item.quantityInStock,
        },
      ]);
    }
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
    (sum, p) => sum + Math.round(toBaisa(parseFloat(p.unitPriceOmr) || 0) * p.quantity),
    0
  );
  const subtotalBaisa = totalLaborBaisa + totalPartsBaisa;
  const vatAmountBaisa = Math.round((subtotalBaisa * 5) / 100);
  const grandEstimatedBaisa = subtotalBaisa + vatAmountBaisa;

  // Submit Final Maintenance Operation
  const handleSubmitMaintenance = async () => {
    if (!selectedCustomer) {
      showToast('يرجى اختيار أو تسجيل العميل', 'error');
      return;
    }
    if (!selectedVehicleId) {
      showToast('يرجى اختيار أو تسجيل مركبة لأمر الصيانة', 'error');
      return;
    }
    if (!reportedProblem.trim()) {
      showToast('يرجى كتابة المشكلة المبلغ عنها من قبل العميل', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedTechObj = technicians.find((t) => t.id === selectedTechnicianId);
      const roRes = await garageApi.createRepairOrder({
        customerId: selectedCustomer.id,
        vehicleId: selectedVehicleId,
        reportedProblem: reportedProblem.trim(),
        inspectionNotes: inspectionNotes.trim() || undefined,
        odometerIn: parseInt(odometerIn) || 0,
        estimatedCostBaisa: grandEstimatedBaisa,
        assignedTechnicianId: selectedTechnicianId || undefined,
        assignedTechnicianName: selectedTechObj?.name,
        expectedAt: expectedDate,
      });

      if (!roRes.success || !roRes.data) {
        showToast(roRes.error || 'تعذر إنشاء أمر الصيانة', 'error');
        setIsSubmitting(false);
        return;
      }

      const roId = roRes.data.id;

      // Add labor tasks
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

      // Issue allocated parts to repair order
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
    } catch {
      showToast('خطأ أثناء حفظ عملية الصيانة', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                استقبال المركبة، تشخيص المشاكل، تعيين الفني، وإدراج قطع الغيار المطلوبة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate && onNavigate('dashboard')}
          >
            إلغاء والعودة
          </Button>
          <Button
            variant="gold"
            size="md"
            icon={<CheckCircle2 className="w-4 h-4" />}
            onClick={handleSubmitMaintenance}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'جارٍ الحفظ والترحيل...' : 'حفظ عملية الصيانة المعتمدة'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Customer, Vehicle & Service Intake */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Customer Autocomplete / Selection */}
          <Card className="bg-[#0f1522] border-[#1d273a]">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                  <User className="w-4 h-4 text-amber-400" />
                  <span>1. تحديد العميل (Customer Selection)</span>
                </div>
                {!selectedCustomer && !isAddingNewCustomer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<UserPlus className="w-3.5 h-3.5" />}
                    onClick={() => setIsAddingNewCustomer(true)}
                  >
                    تسجيل عميل جديد
                  </Button>
                )}
              </div>

              {/* Selected Customer Card or Search Autocomplete */}
              {selectedCustomer ? (
                <div className="p-4 rounded-xl bg-[#141d2f] border border-amber-500/40 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {selectedCustomer.fullName}
                      </span>
                      <Badge variant={selectedCustomer.isPermanent ? 'emerald' : 'sky'}>
                        {selectedCustomer.isPermanent ? 'عميل دائم' : 'زيارة فردية'}
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
              ) : isAddingNewCustomer ? (
                /* Inline New Customer Form with Explicit Save */
                <div className="p-4 rounded-xl bg-[#121927] border border-[#273752] space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                    <span>إدخال بيانات عميل جديد (حفظ صريح مطلوب):</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCustomer(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      إلغاء
                    </button>
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
                        رقم الهاتف *
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

                  <div className="flex justify-end pt-2">
                    <Button
                      variant="gold"
                      size="sm"
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      onClick={handleSaveNewCustomer}
                      disabled={isSavingCustomer}
                    >
                      {isSavingCustomer ? 'جارٍ الحفظ...' : 'حفظ العميل / Save Customer'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Autocomplete Search Input */
                <div ref={autocompleteRef} className="relative">
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    ابحث بالاسم أو رقم الهاتف لاسترجاع ملف العميل الحالي:
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

                  {/* Dropdown Results */}
                  {showCustomerDropdown && (
                    <div className="absolute top-full right-0 left-0 mt-1.5 bg-[#101726] border border-[#24344d] rounded-xl shadow-2xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-800/80">
                      {matchingCustomers.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          لا يوجد عميل بهذا الاسم.{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setNewCustName(customerQuery);
                              setIsAddingNewCustomer(true);
                              setShowCustomerDropdown(false);
                            }}
                            className="text-amber-400 font-bold hover:underline ml-1"
                          >
                            تسجيل كعميل جديد الآن؟
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
                              <div className="font-bold text-white text-xs">{cust.fullName}</div>
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

          {/* Step 2: Vehicle Selection or Inline Registration */}
          <Card className="bg-[#0f1522] border-[#1d273a]">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                  <Car className="w-4 h-4 text-amber-400" />
                  <span>2. اختيار المركبة (Vehicle Selection)</span>
                </div>
                {selectedCustomer && !isAddingNewVehicle && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setIsAddingNewVehicle(true)}
                  >
                    إضافة مركبة للعميل
                  </Button>
                )}
              </div>

              {!selectedCustomer ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  يرجى تحديد العميل أولاً لعرض مركباته المسجلة
                </div>
              ) : isAddingNewVehicle ? (
                /* Inline Vehicle Registration Form */
                <div className="p-4 rounded-xl bg-[#121927] border border-[#273752] space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                    <span>تسجيل مركبة جديدة للعميل {selectedCustomer.fullName}:</span>
                    {customerVehicles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsAddingNewVehicle(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        العودة للمركبات المسجلة
                      </button>
                    )}
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
                        قراءة العداد الحالية (كم)
                      </label>
                      <Input
                        type="number"
                        value={newOdometer}
                        onChange={(e) => setNewOdometer(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        رقم الشاصي (VIN)
                      </label>
                      <Input
                        value={newVin}
                        onChange={(e) => setNewVin(e.target.value)}
                        placeholder="JTEBU5JR2N5..."
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      variant="gold"
                      size="sm"
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      onClick={handleSaveNewVehicle}
                      disabled={isSavingVehicle}
                    >
                      {isSavingVehicle ? 'جارٍ الحفظ...' : 'حفظ المركبة وربطها'}
                    </Button>
                  </div>
                </div>
              ) : customerVehicles.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between">
                  <span>لا توجد سيارات مسجلة لهذا العميل حالياً.</span>
                  <Button variant="gold" size="sm" onClick={() => setIsAddingNewVehicle(true)}>
                    تسجيل سيارة الآن
                  </Button>
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
                        <div className="mt-2 text-xs font-semibold text-slate-100">
                          {v.make} {v.model} ({v.year})
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
                  placeholder="وصف المشكلة (مثال: صوت طقطقة عند الضغط على الفرامل، ضعف في عزم المحرك، صيانة دورية 50 ألف كم...)"
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
                        placeholder="بيان العمل / الخدمة (مثال: فك وتركيب فحمات، تبديل زيت وفلتر، ميزانية رودات...)"
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
                      className="p-2 text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Spare Parts Picker & Financial Summary */}
        <div className="space-y-6">
          {/* Spare Parts Allocation from Real Inventory */}
          <Card className="bg-[#0f1522] border-[#1d273a]">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-100 border-b border-slate-800 pb-3">
                <Package className="w-4 h-4 text-amber-400" />
                <span>قطع الغيار المطلوبة</span>
              </div>

              {/* Allocated Parts */}
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {allocatedParts.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500">
                    لم يتم اختيار قطع غيار بعد. انقر على أي قطعة أدناه لإضافتها.
                  </div>
                ) : (
                  allocatedParts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#141d2f] border border-slate-800 text-xs"
                    >
                      <div className="min-w-0 pr-1">
                        <div className="font-semibold text-white truncate">{p.partName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {p.quantity} × {p.unitPriceOmr} ر.ع
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-amber-300">
                          {(parseFloat(p.unitPriceOmr) * p.quantity).toFixed(3)} ر.ع
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePart(p.id)}
                          className="text-slate-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Inventory Quick Picker */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 block">
                  قطع الغيار المتوفرة في المستودع:
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {inventory.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAddPart(item)}
                      className="w-full p-2 rounded-lg bg-[#111827] hover:bg-[#182337] border border-slate-800 flex items-center justify-between text-xs text-right transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 pr-1">
                        <div className="font-medium text-slate-200 truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.partCode}</div>
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
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estimated Itemized Summary Card */}
          <Card className="bg-[#0f1522] border-[#1d273a]">
            <CardContent className="p-5 space-y-3">
              <div className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-3">
                الحساب التقديري للعملية
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>إجمالي أجور اليد ({services.length} بنود):</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {formatOMR(fromBaisa(totalLaborBaisa))}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>إجمالي قطع الغيار ({allocatedParts.length} قطع):</span>
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
                  <span>المجموع التقديري:</span>
                  <span className="font-mono text-base text-amber-400">
                    {formatOMR(fromBaisa(grandEstimatedBaisa))}
                  </span>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  variant="gold"
                  size="md"
                  className="w-full"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={handleSubmitMaintenance}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'جارٍ الحفظ...' : 'تأكيد وحفظ عملية الصيانة'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
