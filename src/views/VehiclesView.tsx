/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Master Vehicle Fleet Management View (Phase 3)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Car,
  Plus,
  Search,
  Phone,
  User,
  UserCheck,
  UserPlus,
  X,
  Gauge,
  Calendar,
  Tag,
  Edit2,
  Archive,
  RotateCcw,
  Trash2,
  Eye,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { type RouteId } from '../i18n/translations.ts';
import { Card, CardContent } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input, SearchInput } from '../components/ui/Input.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { garageApi } from '../services/garageClient.ts';
import type { VehicleDTO, VehicleInput, CustomerDTO } from '../types/ipc.ts';
import { CustomerProfileModal } from './CustomerProfileModal.tsx';

interface VehiclesViewProps {
  onNavigate?: (route: RouteId) => void;
  initialCustomerId?: string;
}

export function VehiclesView({ onNavigate, initialCustomerId }: VehiclesViewProps) {
  const { lang, t } = useLanguage();
  const isAr = lang === 'ar';
  const { showToast } = useToast();

  const [vehicles, setVehicles] = useState<VehicleDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleDTO | null>(null);
  const [viewingVehicle, setViewingVehicle] = useState<VehicleDTO | null>(null);
  const [profileCustomer, setProfileCustomer] = useState<CustomerDTO | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Customer Autocomplete & Free-Text State
  const [customerInputValue, setCustomerInputValue] = useState('');
  const [customerPhoneValue, setCustomerPhoneValue] = useState('');
  const [selectedExistingCustomer, setSelectedExistingCustomer] = useState<CustomerDTO | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isPermanentCustomer, setIsPermanentCustomer] = useState(false);

  // Form State
  const [formData, setFormData] = useState<VehicleInput>({
    customerId: initialCustomerId || '',
    plateNumber: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    odometer: 0,
    vin: '',
    color: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Confirm Action
  const [confirmAction, setConfirmAction] = useState<{
    type: 'archive' | 'restore' | 'delete';
    vehicle: VehicleDTO;
  } | null>(null);

  // Load Customers for dropdown
  const loadCustomers = async () => {
    try {
      const res = await garageApi.getCustomers(undefined, true);
      if (res.success && res.data) {
        setCustomers(res.data);
      }
    } catch {
      console.warn('Failed to load customers dropdown');
    }
  };

  // Load Vehicles
  const loadVehicles = async () => {
    setIsLoading(true);
    try {
      const res = await garageApi.getVehicles({
        customerId: selectedCustomerId || undefined,
        searchQuery: searchQuery || undefined,
        includeArchived,
      });
      if (res.success && res.data) {
        setVehicles(res.data);
      } else {
        showToast(res.error || 'Failed to load vehicles', 'error');
      }
    } catch {
      showToast('Error connecting to database', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadVehicles();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCustomerId, includeArchived]);

  // Real-time Duplicate Check
  useEffect(() => {
    if (!isFormModalOpen || !formData.plateNumber.trim()) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await garageApi.checkVehicleDuplicates(
          formData.plateNumber,
          formData.vin || undefined,
          editingVehicle ? editingVehicle.id : undefined
        );
        if (res.success && res.data) {
          if (res.data.plateExists) {
            setDuplicateWarning(t('duplicatePlateWarning'));
          } else if (res.data.vinExists) {
            setDuplicateWarning(t('duplicateVinWarning'));
          } else {
            setDuplicateWarning(null);
          }
        }
      } catch {
        // ignore duplicate check transient error
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.plateNumber, formData.vin, isFormModalOpen, editingVehicle]);

  // Customer Map for fast, resilient relational resolution
  const customerMap = useMemo(() => {
    const map: Record<string, CustomerDTO> = {};
    for (const c of customers) {
      map[c.id] = c;
    }
    return map;
  }, [customers]);

  // Statistics
  const stats = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter((v) => v.isActive !== false).length;
    const archived = vehicles.filter((v) => v.isActive === false).length;
    return { total, active, archived };
  }, [vehicles]);

  // Autocomplete Suggestions for Owner
  const customerSuggestions = useMemo(() => {
    const q = customerInputValue.trim().toLowerCase();
    if (!q || selectedExistingCustomer) return [];
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [customerInputValue, customers, selectedExistingCustomer]);

  // Open Create
  const handleOpenCreate = () => {
    setEditingVehicle(null);
    setDuplicateWarning(null);
    setShowSuggestions(false);

    if (initialCustomerId) {
      const initCust = customers.find((c) => c.id === initialCustomerId);
      setSelectedExistingCustomer(initCust || null);
      setCustomerInputValue(initCust ? initCust.fullName : '');
      setCustomerPhoneValue(initCust?.phone || '');
    } else {
      setSelectedExistingCustomer(null);
      setCustomerInputValue('');
      setCustomerPhoneValue('');
    }

    setFormData({
      customerId: initialCustomerId || '',
      plateNumber: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      odometer: 0,
      vin: '',
      color: '',
      notes: '',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Open Edit
  const handleOpenEdit = (v: VehicleDTO) => {
    setEditingVehicle(v);
    setDuplicateWarning(null);
    setShowSuggestions(false);
    const owner = customers.find((c) => c.id === v.customerId);
    setSelectedExistingCustomer(owner || null);
    setCustomerInputValue(v.customerName || (owner ? owner.fullName : ''));
    setCustomerPhoneValue(v.customerPhone || (owner?.phone || ''));

    setFormData({
      customerId: v.customerId,
      plateNumber: v.plateNumber,
      make: v.make,
      model: v.model,
      year: v.year,
      odometer: v.odometer,
      vin: v.vin || '',
      color: v.color || '',
      notes: v.notes || '',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Validate Form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const nameTrimmed = customerInputValue.trim();
    if (!selectedExistingCustomer && nameTrimmed.length < 2) {
      errors.customer = isAr
        ? 'يجب إدخال اسم العميل (حرفين على الأقل) أو اختيار عميل مسجل'
        : 'Customer name is required (at least 2 characters)';
    }
    if (!formData.plateNumber.trim()) {
      errors.plateNumber = isAr ? 'يجب إدخال رقم اللوحة' : 'Plate number is required';
    }
    if (!formData.make.trim()) {
      errors.make = isAr ? 'يجب إدخال الشركة المصنعة' : 'Vehicle make is required';
    }
    if (!formData.model.trim()) {
      errors.model = isAr ? 'يجب إدخال الموديل' : 'Vehicle model is required';
    }
    if (!formData.year || formData.year < 1950 || formData.year > new Date().getFullYear() + 2) {
      errors.year = isAr ? 'سنة الصنع غير صحيحة' : 'Invalid model year';
    }
    if (formData.odometer === undefined || formData.odometer < 0) {
      errors.odometer = isAr ? 'قراءة العداد غير صحيحة' : 'Odometer cannot be negative';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    const payload: VehicleInput = {
      customerId: selectedExistingCustomer ? selectedExistingCustomer.id : undefined,
      customerName: !selectedExistingCustomer ? customerInputValue.trim() : undefined,
      customerPhone: !selectedExistingCustomer ? (customerPhoneValue.trim() || undefined) : undefined,
      isPermanentCustomer: !selectedExistingCustomer ? isPermanentCustomer : undefined,
      plateNumber: formData.plateNumber.trim(),
      make: formData.make.trim(),
      model: formData.model.trim(),
      year: formData.year,
      odometer: formData.odometer,
      vin: formData.vin?.trim() || undefined,
      color: formData.color?.trim() || undefined,
      notes: formData.notes?.trim() || undefined,
    };

    try {
      if (editingVehicle) {
        const res = await garageApi.updateVehicle(editingVehicle.id, payload);
        if (res.success) {
          showToast(t('vehicleUpdated'), 'success');
          setIsFormModalOpen(false);
          loadVehicles();
          loadCustomers();
        } else {
          showToast(res.error || 'Failed to update vehicle', 'error');
        }
      } else {
        const res = await garageApi.createVehicle(payload);
        if (res.success) {
          showToast(t('vehicleCreated'), 'success');
          setIsFormModalOpen(false);
          loadVehicles();
          loadCustomers();
        } else {
          showToast(res.error || 'Failed to create vehicle', 'error');
        }
      }
    } catch {
      showToast('Error saving vehicle', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm Action Handler
  const handleExecuteConfirm = async () => {
    if (!confirmAction) return;

    const { type, vehicle } = confirmAction;
    try {
      if (type === 'archive') {
        const res = await garageApi.archiveVehicle(vehicle.id);
        if (res.success) {
          showToast(t('vehicleArchived'), 'success');
          loadVehicles();
        } else {
          showToast(res.error || 'Failed to archive vehicle', 'error');
        }
      } else if (type === 'restore') {
        const res = await garageApi.restoreVehicle(vehicle.id);
        if (res.success) {
          showToast(t('vehicleRestored'), 'success');
          loadVehicles();
        } else {
          showToast(res.error || 'Failed to restore vehicle', 'error');
        }
      } else if (type === 'delete') {
        const res = await garageApi.deleteVehicle(vehicle.id);
        if (res.success) {
          showToast(t('vehicleDeleted'), 'success');
          loadVehicles();
        } else {
          showToast(res.error || 'Cannot delete vehicle with repair history', 'error');
        }
      }
    } catch {
      showToast('Operation failed', 'error');
    } finally {
      setConfirmAction(null);
    }
  };

  // Open Owner Profile
  const handleOpenOwnerProfile = async (customerId: string) => {
    try {
      const res = await garageApi.getCustomerById(customerId);
      if (res.success && res.data) {
        setProfileCustomer(res.data);
        setIsProfileOpen(true);
      }
    } catch {
      showToast('Could not load customer profile', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f2a3f] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">{t('vehiclesTitle')}</h2>
              <p className="text-xs text-slate-400">{t('vehiclesSubtitle')}</p>
            </div>
          </div>
        </div>

        {/* Header Right Stats & Add Button */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#223049] bg-[#0d1422] text-xs">
            <span className="text-slate-400">{t('totalCount')}</span>
            <span className="font-bold text-amber-400 font-mono">{stats.total}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">{t('active')}:</span>
            <span className="font-bold text-emerald-400 font-mono">{stats.active}</span>
          </div>

          <Button
            variant="gold"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreate}
          >
            {t('addVehicle')}
          </Button>
        </div>
      </div>

      {/* Control Strip (Search, Customer Filter, Archive Toggle, Refresh) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search Input */}
        <div className="md:col-span-5">
          <SearchInput
            placeholder={isAr ? 'بحث برقم اللوحة، الماركة، رقم الهيكل، المالك...' : 'Search plate, make, model, VIN, owner...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Customer Filter Dropdown */}
        <div className="md:col-span-4">
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full bg-[#111827] text-slate-200 text-xs rounded-lg border border-[#243048] px-3 py-2 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-colors shadow-inner truncate"
          >
            <option value="">{isAr ? '— جميع العملاء والسيارات —' : '— All Customers / Vehicles —'}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} ({c.phone})
              </option>
            ))}
          </select>
        </div>

        {/* Action Toggles */}
        <div className="md:col-span-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setIncludeArchived(!includeArchived)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              includeArchived
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-[#121927] border-[#223049] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{includeArchived ? t('hideArchived') : t('showArchived')}</span>
          </button>

          <Button
            variant="secondary"
            size="md"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={loadVehicles}
            title={t('refresh')}
          >
            <span className="hidden sm:inline">{t('refresh')}</span>
          </Button>
        </div>
      </div>

      {/* Vehicle Data Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && vehicles.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400" />
              <div>{t('loading')}</div>
            </div>
          ) : vehicles.length === 0 ? (
            <EmptyState
              icon={<Car className="w-10 h-10 text-slate-500" />}
              title={isAr ? 'لا توجد سيارات مسجلة' : 'No vehicles found'}
              description={
                searchQuery || selectedCustomerId
                  ? isAr ? 'لا توجد مركبات مطابقة لمعايير البحث الحالية.' : 'No vehicles match your current search filters.'
                  : isAr ? 'سجل أول مركبة في أسطول كراج الرواحي الآن.' : 'Register the first vehicle in Al Rawahi Garage fleet.'
              }
              action={
                <Button variant="gold" icon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate}>
                  {t('addVehicle')}
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="border-b border-[#223049] bg-[#0c121e] text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-4 text-start">{t('plateNumber')}</th>
                    <th className="py-3 px-4 text-start">{isAr ? 'المركبة والموديل' : 'Vehicle & Model'}</th>
                    <th className="py-3 px-4 text-start">{t('vehicleOwner')}</th>
                    <th className="py-3 px-4 text-start hidden md:table-cell">{t('odometer')}</th>
                    <th className="py-3 px-4 text-start hidden lg:table-cell">{t('vin')}</th>
                    <th className="py-3 px-4 text-center">{t('customerStatus')}</th>
                    <th className="py-3 px-4 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#182337]">
                  {vehicles.map((v) => {
                    const isArchived = v.isActive === false;

                    return (
                      <tr
                        key={v.id}
                        className={`hover:bg-[#131b2c] transition-colors ${
                          isArchived ? 'opacity-60 bg-black/20' : ''
                        }`}
                      >
                        {/* Omani License Plate Badge */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setViewingVehicle(v)}
                            className="group text-start"
                          >
                            <span className="inline-block px-2.5 py-1 rounded bg-black/70 border border-amber-500/50 group-hover:border-amber-400 text-amber-300 font-mono font-bold text-xs tracking-wider shadow-inner transition-colors">
                              {v.plateNumber}
                            </span>
                          </button>
                        </td>

                        {/* Make & Model */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <span>{v.make}</span>
                            <span>{v.model}</span>
                            <span className="text-slate-400 font-normal">({v.year})</span>
                          </div>
                          {v.color && (
                            <div className="text-[11px] text-slate-400">
                              {v.color}
                            </div>
                          )}
                        </td>

                        {/* Owner & Phone */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleOpenOwnerProfile(v.customerId)}
                            className="text-start group"
                          >
                            <div className="font-medium text-slate-200 group-hover:text-amber-400 transition-colors flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-500 group-hover:text-amber-400" />
                              <span>{customerMap[v.customerId]?.fullName || v.customerName || (isAr ? 'غير محدد' : 'Unknown')}</span>
                            </div>
                            {(customerMap[v.customerId]?.phone || v.customerPhone) && (
                              <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                                {customerMap[v.customerId]?.phone || v.customerPhone}
                              </div>
                            )}
                          </button>
                        </td>

                        {/* Odometer */}
                        <td className="py-3 px-4 font-mono text-slate-300 hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <Gauge className="w-3 h-3 text-slate-500" />
                            <span>{v.odometer.toLocaleString()} {isAr ? 'كم' : 'KM'}</span>
                          </div>
                        </td>

                        {/* VIN */}
                        <td className="py-3 px-4 font-mono text-slate-400 hidden lg:table-cell max-w-xs truncate">
                          {v.vin ? (
                            <span className="text-[11px]">{v.vin}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <Badge variant={!isArchived ? 'emerald' : 'slate'} size="sm">
                            {!isArchived ? t('active') : t('archived')}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-end">
                          <div className="flex items-center justify-end gap-1">
                            {/* View Vehicle Specs Modal */}
                            <button
                              type="button"
                              onClick={() => setViewingVehicle(v)}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                              title={t('viewDetails')}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(v)}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                              title={t('editVehicle')}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Archive / Restore */}
                            {!isArchived ? (
                              <button
                                type="button"
                                onClick={() => setConfirmAction({ type: 'archive', vehicle: v })}
                                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                                title={t('archiveVehicle')}
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmAction({ type: 'restore', vehicle: v })}
                                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                                title={t('restoreVehicle')}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ type: 'delete', vehicle: v })}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
                              title={t('deleteVehicle')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Vehicle Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingVehicle ? t('editVehicle') : t('addVehicle')}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFormModalOpen(false)}
              disabled={isSaving}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="gold"
              size="sm"
              onClick={handleSubmitForm}
              disabled={isSaving}
              icon={isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : undefined}
            >
              {isSaving ? t('loading') : t('save')}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {/* Owner Selection */}
          {/* Customer / Owner Free-Text & Autocomplete Selection */}
          <div className="space-y-2 text-start">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-300">
                {t('customerInputLabel')} *
              </label>
              {selectedExistingCustomer && (
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  {t('existingCustomerSelected')}
                </span>
              )}
            </div>

            {selectedExistingCustomer ? (
              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-100 truncate">
                      {selectedExistingCustomer.fullName}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {selectedExistingCustomer.phone || (isAr ? 'بدون هاتف' : 'No phone')} {selectedExistingCustomer.address ? `• ${selectedExistingCustomer.address}` : ''}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedExistingCustomer(null);
                    setShowSuggestions(false);
                  }}
                  className="text-slate-400 hover:text-amber-400 text-xs shrink-0"
                >
                  <Edit2 className="w-3 h-3 me-1" />
                  {t('changeCustomer')}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    value={customerInputValue}
                    onChange={(e) => {
                      setCustomerInputValue(e.target.value);
                      setShowSuggestions(true);
                      if (formErrors.customer) {
                        setFormErrors({ ...formErrors, customer: '' });
                      }
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder={t('customerInputPlaceholder')}
                    error={formErrors.customer}
                    icon={<User className="w-3.5 h-3.5 text-slate-400" />}
                  />

                  {/* Suggestions Popover */}
                  {showSuggestions && customerInputValue.trim().length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-[#162032] border border-[#2e3e5c] rounded-lg shadow-2xl overflow-hidden divide-y divide-[#222e44]">
                      {customerSuggestions.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 bg-[#0f172a] text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {t('existingCustomersFound')}
                          </div>
                          {customerSuggestions.map((cust) => (
                            <button
                              key={cust.id}
                              type="button"
                              onClick={() => {
                                setSelectedExistingCustomer(cust);
                                setCustomerInputValue(cust.fullName);
                                setCustomerPhoneValue(cust.phone || '');
                                setShowSuggestions(false);
                              }}
                              className="w-full px-3 py-2 text-start hover:bg-amber-500/10 flex items-center justify-between transition-colors group"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-200 group-hover:text-amber-400">
                                  {cust.fullName}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {cust.phone || (isAr ? 'بدون هاتف' : 'No phone')}
                                </p>
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium shrink-0">
                                {isAr ? 'عميل مسجل' : 'Registered'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Explicit Create as New Customer option */}
                      <button
                        type="button"
                        onClick={() => setShowSuggestions(false)}
                        className="w-full px-3 py-2 text-start hover:bg-slate-700/40 flex items-center gap-2 text-amber-400 text-xs font-medium transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {t('registerAsNewCustomer')} <strong className="text-white">"{customerInputValue.trim()}"</strong>
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* New Customer Indicator & Optional Phone Input */}
                <div className="p-2.5 rounded-lg bg-[#111827] border border-[#243048] space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90">
                    <UserPlus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{t('newCustomerWillBeCreated')}</span>
                  </div>
                  <div>
                    <Input
                      label={t('customerPhoneOptional')}
                      value={customerPhoneValue}
                      onChange={(e) => setCustomerPhoneValue(e.target.value)}
                      placeholder={t('customerPhoneHint')}
                      icon={<Phone className="w-3.5 h-3.5 text-slate-400" />}
                      dir="ltr"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={isPermanentCustomer}
                      onChange={(e) => setIsPermanentCustomer(e.target.checked)}
                      className="rounded bg-[#162032] border-[#2e3e5c] text-amber-500 focus:ring-amber-500"
                    />
                    <span>{t('permanentOption')}</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Plate Number with Hint and Duplicate Warning */}
          <div>
            <Input
              label={t('plateNumber') + ' *'}
              value={formData.plateNumber}
              onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
              placeholder={t('plateNumberHint')}
              error={formErrors.plateNumber}
              dir="ltr"
            />
            {duplicateWarning && (
              <div className="mt-1.5 p-2 rounded bg-amber-950/40 border border-amber-500/40 text-amber-300 text-[11px] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>{duplicateWarning}</span>
              </div>
            )}
          </div>

          {/* Make, Model, Year */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={t('make') + ' *'}
              value={formData.make}
              onChange={(e) => setFormData({ ...formData, make: e.target.value })}
              placeholder={isAr ? 'تويوتا، نيسان...' : 'Toyota, Nissan...'}
              error={formErrors.make}
            />

            <Input
              label={t('model') + ' *'}
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              placeholder={isAr ? 'لاندكروزر، باترول...' : 'Prado, Patrol...'}
              error={formErrors.model}
            />

            <Input
              label={t('year') + ' *'}
              type="number"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value, 10) || 0 })}
              error={formErrors.year}
              min={1950}
              max={new Date().getFullYear() + 2}
            />
          </div>

          {/* Odometer, VIN, Color */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={t('odometer') + ' *'}
              type="number"
              value={formData.odometer}
              onChange={(e) => setFormData({ ...formData, odometer: parseInt(e.target.value, 10) || 0 })}
              error={formErrors.odometer}
              min={0}
            />

            <Input
              label={t('color')}
              value={formData.color || ''}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              placeholder={isAr ? 'أبيض، أسود...' : 'White, Black...'}
            />

            <Input
              label={t('vin')}
              value={formData.vin || ''}
              onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
              placeholder="JTEBU5JR2N..."
              dir="ltr"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5 text-start">
            <label className="block text-xs font-medium text-slate-300">
              {t('vehicleNotes')}
            </label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={isAr ? 'ملاحظات الصيانة، عيوب سابقة أو إكسسوارات...' : 'Maintenance history or previous defects...'}
              className="w-full bg-[#111827] text-slate-100 placeholder-slate-500 text-xs rounded-lg border border-[#243048] p-3 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-colors shadow-inner"
            />
          </div>
        </form>
      </Modal>

      {/* Vehicle Technical Details Modal */}
      {viewingVehicle && (
        <Modal
          isOpen={Boolean(viewingVehicle)}
          onClose={() => setViewingVehicle(null)}
          title={`${t('vehicleDetails')}: ${viewingVehicle.plateNumber}`}
          maxWidth="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const target = viewingVehicle;
                  setViewingVehicle(null);
                  handleOpenEdit(target);
                }}
                icon={<Edit2 className="w-3.5 h-3.5" />}
              >
                {t('editVehicle')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setViewingVehicle(null)}>
                {t('close')}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Header Plate Display */}
            <div className="p-4 rounded-xl border border-amber-500/30 bg-[#0e1524] flex items-center justify-between">
              <div>
                <span className="inline-block px-3 py-1.5 rounded bg-black/80 border border-amber-400 text-amber-300 font-mono font-bold text-sm tracking-wider shadow-inner">
                  {viewingVehicle.plateNumber}
                </span>
                <div className="mt-2 text-base font-bold text-slate-100">
                  {viewingVehicle.make} {viewingVehicle.model} ({viewingVehicle.year})
                </div>
              </div>
              <Badge variant={viewingVehicle.isActive ? 'emerald' : 'slate'}>
                {viewingVehicle.isActive ? t('active') : t('archived')}
              </Badge>
            </div>

            {/* Specs Grid */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-[#202d44] bg-[#0c121e] text-xs">
              <div>
                <span className="text-slate-400">{t('odometer')}:</span>
                <div className="font-mono font-bold text-slate-100 mt-0.5">
                  {viewingVehicle.odometer.toLocaleString()} {isAr ? 'كم' : 'KM'}
                </div>
              </div>
              <div>
                <span className="text-slate-400">{t('color')}:</span>
                <div className="font-medium text-slate-200 mt-0.5">
                  {viewingVehicle.color || '—'}
                </div>
              </div>
              <div className="col-span-2 border-t border-slate-800 pt-2">
                <span className="text-slate-400">{t('vin')}:</span>
                <div className="font-mono text-slate-100 mt-0.5 select-all truncate">
                  {viewingVehicle.vin || '—'}
                </div>
              </div>
            </div>

            {/* Owner Details Card */}
            <div className="p-3.5 rounded-xl border border-[#202d44] bg-[#0c121e] flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400">{t('vehicleOwner')}:</span>
                <div className="font-bold text-slate-100 mt-0.5">
                  {customerMap[viewingVehicle.customerId]?.fullName || viewingVehicle.customerName || (isAr ? 'غير محدد' : 'Unknown')}
                </div>
                {(customerMap[viewingVehicle.customerId]?.phone || viewingVehicle.customerPhone) && (
                  <div className="text-slate-400 font-mono mt-0.5" dir="ltr">
                    {customerMap[viewingVehicle.customerId]?.phone || viewingVehicle.customerPhone}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                onClick={() => {
                  const custId = viewingVehicle.customerId;
                  setViewingVehicle(null);
                  handleOpenOwnerProfile(custId);
                }}
              >
                {t('viewCustomerProfile')}
              </Button>
            </div>

            {viewingVehicle.notes && (
              <div className="p-3 rounded-lg bg-[#141d2e] border border-slate-800 text-xs text-slate-300">
                <span className="text-slate-400 font-medium">{t('vehicleNotes')}: </span>
                <span>{viewingVehicle.notes}</span>
              </div>
            )}

            {/* Honest Placeholder for Phase 4 Repair History */}
            <div className="p-4 rounded-xl border border-dashed border-slate-700/80 bg-[#0e1422] text-center space-y-1.5">
              <Clock className="w-6 h-6 text-amber-400/70 mx-auto" />
              <div className="text-xs font-bold text-slate-200">{t('futureRepairOrders')}</div>
              <p className="text-[11px] text-slate-400">
                {t('futureNotice')}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <Modal
          isOpen={Boolean(confirmAction)}
          onClose={() => setConfirmAction(null)}
          title={
            confirmAction.type === 'archive'
              ? t('archiveVehicle')
              : confirmAction.type === 'restore'
              ? t('restoreVehicle')
              : t('deleteVehicle')
          }
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant={confirmAction.type === 'delete' ? 'danger' : 'gold'}
                size="sm"
                onClick={handleExecuteConfirm}
              >
                {t('confirm')}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 py-1 text-xs text-slate-300">
            <div className="flex items-start gap-3">
              {confirmAction.type === 'delete' ? (
                <ShieldAlert className="w-8 h-8 text-rose-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
              )}
              <div className="space-y-1">
                <div className="font-bold text-slate-100 font-mono">
                  {confirmAction.vehicle.plateNumber} ({confirmAction.vehicle.make} {confirmAction.vehicle.model})
                </div>
                <p className="text-slate-400">
                  {confirmAction.type === 'archive'
                    ? t('archiveVehicleConfirm')
                    : confirmAction.type === 'restore'
                    ? t('restoreVehicleConfirm')
                    : t('deleteVehicleConfirm')}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Linked Customer Profile Modal */}
      <CustomerProfileModal
        customer={profileCustomer}
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          setProfileCustomer(null);
        }}
      />
    </div>
  );
}
