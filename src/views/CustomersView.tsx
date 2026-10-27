/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Master Customer Management View (Phase 3)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  MapPin,
  Car,
  Edit2,
  Archive,
  RotateCcw,
  Trash2,
  Eye,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  MoreVertical,
  ShieldAlert,
  UserCheck,
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
import type { CustomerDTO, CustomerInput, VehicleDTO } from '../types/ipc.ts';
import { CustomerProfileModal } from './CustomerProfileModal.tsx';

interface CustomersViewProps {
  onNavigate?: (route: RouteId) => void;
  onSelectCustomerForVehicle?: (customer: CustomerDTO) => void;
}

export function CustomersView({ onNavigate, onSelectCustomerForVehicle }: CustomersViewProps) {
  const { lang, t } = useLanguage();
  const isAr = lang === 'ar';
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [viewTab, setViewTab] = useState<'permanent' | 'temporary'>('permanent');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDTO | null>(null);
  const [profileCustomer, setProfileCustomer] = useState<CustomerDTO | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CustomerInput>({
    fullName: '',
    phone: '',
    altPhone: '',
    email: '',
    address: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Dirty Form Detection for explicit saving safeguard
  const isFormDirty = (): boolean => {
    if (!editingCustomer) {
      return Boolean(
        (formData.fullName || '').trim() ||
        (formData.phone || '').trim() ||
        (formData.altPhone && formData.altPhone.trim()) ||
        (formData.email && formData.email.trim()) ||
        (formData.address && formData.address.trim()) ||
        (formData.notes && formData.notes.trim())
      );
    }
    return (
      (formData.fullName || '').trim() !== (editingCustomer.fullName || '').trim() ||
      (formData.phone || '').trim() !== (editingCustomer.phone || '').trim() ||
      (formData.altPhone || '').trim() !== (editingCustomer.altPhone || '').trim() ||
      (formData.email || '').trim() !== (editingCustomer.email || '').trim() ||
      (formData.address || '').trim() !== (editingCustomer.address || '').trim() ||
      (formData.notes || '').trim() !== (editingCustomer.notes || '').trim()
    );
  };

  const handleRequestCloseModal = () => {
    if (isFormDirty()) {
      setShowUnsavedWarning(true);
    } else {
      setIsFormModalOpen(false);
    }
  };

  const handleForceDiscard = () => {
    setShowUnsavedWarning(false);
    setIsFormModalOpen(false);
  };

  // Confirmation Dialog State
  const [confirmAction, setConfirmAction] = useState<{
    type: 'archive' | 'restore' | 'delete';
    customer: CustomerDTO;
  } | null>(null);

  // Load Customers
  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await garageApi.getCustomers(searchQuery, includeArchived, viewTab === 'temporary');
      if (res.success && res.data) {
        if (viewTab === 'temporary') {
          setCustomers(res.data.filter((c) => c.isPermanent === false));
        } else {
          setCustomers(res.data.filter((c) => c.isPermanent !== false));
        }
      } else {
        showToast(res.error || 'Failed to load customers', 'error');
      }
    } catch {
      showToast('Error connecting to database', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromote = async (id: string) => {
    try {
      const res = await garageApi.promoteCustomer(id);
      if (res.success) {
        showToast(t('retentionSuccessPermanent'), 'success');
        loadCustomers();
      } else {
        showToast(res.error || 'Promotion failed', 'error');
      }
    } catch {
      showToast('Error promoting customer', 'error');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, includeArchived, viewTab]);

  // Statistics
  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.isActive !== false).length;
    const archived = customers.filter((c) => c.isActive === false).length;
    const totalVehicles = customers.reduce((sum, c) => sum + (c.vehicleCount || 0), 0);
    return { total, active, archived, totalVehicles };
  }, [customers]);

  // Open Form for Create
  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormData({
      fullName: '',
      phone: '',
      altPhone: '',
      email: '',
      address: '',
      notes: '',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Open Form for Edit
  const handleOpenEdit = (customer: CustomerDTO) => {
    setEditingCustomer(customer);
    setFormData({
      fullName: customer.fullName,
      phone: customer.phone,
      altPhone: customer.altPhone || '',
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Form Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      errors.fullName = isAr ? 'يجب إدخال اسم العميل (حرفين على الأقل)' : 'Name must be at least 2 characters';
    }
    if (formData.phone && formData.phone.trim().length > 0 && formData.phone.trim().length < 7) {
      errors.phone = isAr ? 'يجب إدخال رقم هاتف صحيح (7 أرقام على الأقل)' : 'Phone must be at least 7 digits';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = isAr ? 'صيغة البريد الإلكتروني غير صحيحة' : 'Invalid email address';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Form (Create or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (editingCustomer) {
        const res = await garageApi.updateCustomer(editingCustomer.id, formData);
        if (res.success) {
          showToast(t('customerUpdated'), 'success');
          setIsFormModalOpen(false);
          loadCustomers();
        } else {
          showToast(res.error || 'Failed to update customer', 'error');
        }
      } else {
        const res = await garageApi.createCustomer(formData);
        if (res.success) {
          showToast(t('customerCreated'), 'success');
          setIsFormModalOpen(false);
          loadCustomers();
        } else {
          showToast(res.error || 'Failed to create customer', 'error');
        }
      }
    } catch {
      showToast('Error saving customer', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Execute Archive / Restore / Delete
  const handleExecuteConfirm = async () => {
    if (!confirmAction) return;

    const { type, customer } = confirmAction;
    try {
      if (type === 'archive') {
        const res = await garageApi.archiveCustomer(customer.id);
        if (res.success) {
          showToast(t('customerArchived'), 'success');
          loadCustomers();
        } else {
          showToast(res.error || 'Failed to archive customer', 'error');
        }
      } else if (type === 'restore') {
        const res = await garageApi.restoreCustomer(customer.id);
        if (res.success) {
          showToast(t('customerRestored'), 'success');
          loadCustomers();
        } else {
          showToast(res.error || 'Failed to restore customer', 'error');
        }
      } else if (type === 'delete') {
        const res = await garageApi.deleteCustomer(customer.id);
        if (res.success) {
          showToast(t('customerDeleted'), 'success');
          loadCustomers();
        } else {
          showToast(res.error || t('cannotDeleteCustomerHasVehicles'), 'error');
        }
      }
    } catch {
      showToast('Operation failed', 'error');
    } finally {
      setConfirmAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f2a3f] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">{t('customersTitle')}</h2>
              <p className="text-xs text-slate-400">{t('customersSubtitle')}</p>
            </div>
          </div>
        </div>

        {/* Header Right Stats & Add Button */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#223049] bg-[#0d1422] text-xs">
            <span className="text-slate-400">{t('totalCount')}</span>
            <span className="font-bold text-amber-400 font-mono">{stats.total}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">{t('registeredVehicles')}:</span>
            <span className="font-bold text-slate-200 font-mono">{stats.totalVehicles}</span>
          </div>

          <Button
            variant="gold"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={handleOpenCreate}
          >
            {t('addCustomer')}
          </Button>
        </div>
      </div>

      {/* Directory Mode Switcher (Permanent Directory vs Temporary Visits) */}
      <div className="flex items-center gap-2 border-b border-[#1f2a3f] pb-3">
        <button
          type="button"
          onClick={() => setViewTab('permanent')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            viewTab === 'permanent'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/30'
              : 'bg-[#121927] border border-[#223049] text-slate-300 hover:bg-[#182337]'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>{t('permanentDirectory')}</span>
        </button>

        <button
          type="button"
          onClick={() => setViewTab('temporary')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            viewTab === 'temporary'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-950/30'
              : 'bg-[#121927] border border-[#223049] text-slate-300 hover:bg-[#182337]'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>{t('temporaryVisits')}</span>
        </button>
      </div>

      {/* Control Strip (Search, Archive Toggle, Refresh) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder={isAr ? 'بحث بالاسم، رقم الهاتف...' : 'Search by name, phone...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2.5">
          {/* Toggle Archived */}
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
            {stats.archived > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                {stats.archived}
              </span>
            )}
          </button>

          {/* Refresh Button */}
          <Button
            variant="secondary"
            size="md"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={loadCustomers}
            title={t('refresh')}
          >
            <span className="hidden sm:inline">{t('refresh')}</span>
          </Button>
        </div>
      </div>

      {/* Customer Data Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && customers.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400" />
              <div>{t('loading')}</div>
            </div>
          ) : customers.length === 0 ? (
            <EmptyState
              icon={<Users className="w-10 h-10 text-slate-500" />}
              title={isAr ? 'لم يتم العثور على عملاء' : 'No customers found'}
              description={
                searchQuery
                  ? isAr ? 'لا توجد نتائج مطابقة لبحثك الحالي. جرب البحث برقم هاتف أو اسم آخر.' : 'No results matching your query. Try another name or phone number.'
                  : isAr ? 'ابدأ بإضافة أول عميل مسجل في كراج الرواحي الآن.' : 'Get started by adding the first customer in Al Rawahi Garage.'
              }
              action={
                <Button variant="gold" icon={<UserPlus className="w-4 h-4" />} onClick={handleOpenCreate}>
                  {t('addCustomer')}
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="border-b border-[#223049] bg-[#0c121e] text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-4 text-start">{t('customerName')}</th>
                    <th className="py-3 px-4 text-start">{t('customerPhone')}</th>
                    <th className="py-3 px-4 text-start hidden md:table-cell">{t('customerAltPhone')}</th>
                    <th className="py-3 px-4 text-start hidden lg:table-cell">{t('customerAddress')}</th>
                    <th className="py-3 px-4 text-center">{t('vehicleCount')}</th>
                    <th className="py-3 px-4 text-center">{t('customerStatus')}</th>
                    <th className="py-3 px-4 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#182337]">
                  {customers.map((c) => {
                    const isArchived = c.isActive === false;

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-[#131b2c] transition-colors ${
                          isArchived ? 'opacity-60 bg-black/20' : ''
                        }`}
                      >
                        {/* Name & ID */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileCustomer(c);
                              setIsProfileOpen(true);
                            }}
                            className="text-start group"
                          >
                            <div className="font-bold text-slate-100 group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                              <span>{c.fullName}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              ID: {c.id.slice(0, 8)}
                            </div>
                          </button>
                        </td>

                        {/* Primary Phone */}
                        <td className="py-3 px-4 font-mono text-slate-200">
                          <div className="flex items-center gap-1.5" dir="ltr">
                            <Phone className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>{c.phone}</span>
                          </div>
                        </td>

                        {/* Alt Phone */}
                        <td className="py-3 px-4 font-mono text-slate-400 hidden md:table-cell">
                          {c.altPhone ? (
                            <span dir="ltr">{c.altPhone}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Address */}
                        <td className="py-3 px-4 text-slate-300 hidden lg:table-cell max-w-xs truncate">
                          {c.address ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">{c.address}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Vehicles Count Badge */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileCustomer(c);
                              setIsProfileOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 font-mono font-bold transition-colors"
                            title={t('registeredVehicles')}
                          >
                            <Car className="w-3 h-3" />
                            <span>{c.vehicleCount || 0}</span>
                          </button>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <Badge variant={!isArchived ? 'emerald' : 'slate'} size="sm">
                            {!isArchived ? t('active') : t('archived')}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-end">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Promote to Permanent Directory if Temporary */}
                            {c.isPermanent === false && (
                              <button
                                type="button"
                                onClick={() => handlePromote(c.id)}
                                className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                                title={t('saveAsPermanent')}
                              >
                                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                                <span className="hidden sm:inline">{t('saveAsPermanent')}</span>
                              </button>
                            )}

                            {/* View Profile */}
                            <button
                              type="button"
                              onClick={() => {
                                setProfileCustomer(c);
                                setIsProfileOpen(true);
                              }}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                              title={t('customerDetails')}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(c)}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                              title={t('editCustomer')}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Archive / Restore */}
                            {!isArchived ? (
                              <button
                                type="button"
                                onClick={() => setConfirmAction({ type: 'archive', customer: c })}
                                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                                title={t('archiveCustomer')}
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmAction({ type: 'restore', customer: c })}
                                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                                title={t('restoreCustomer')}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete (if safe) */}
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ type: 'delete', customer: c })}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
                              title={t('deleteCustomer')}
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

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={handleRequestCloseModal}
        title={editingCustomer ? t('editCustomer') : t('addCustomer')}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRequestCloseModal}
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
              {isSaving ? t('loading') : (editingCustomer ? t('save') : t('saveCustomer'))}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <Input
            label={t('customerName') + ' *'}
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder={isAr ? 'مثال: سالم بن حمد الرواحي' : 'e.g., Salim Al Rawahi'}
            error={formErrors.fullName}
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t('customerPhone') + ' *'}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder={isAr ? 'مثال: +968 91234567' : '+968 91234567'}
              error={formErrors.phone}
              dir="ltr"
            />

            <Input
              label={t('customerAltPhone')}
              value={formData.altPhone || ''}
              onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })}
              placeholder={isAr ? 'مثال: +968 24567890' : '+968 24567890'}
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t('customerEmail')}
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="customer@example.om"
              error={formErrors.email}
              dir="ltr"
            />

            <Input
              label={t('customerAddress')}
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder={isAr ? 'مسقط، السيب' : 'Muscat, Seeb'}
            />
          </div>

          <div className="space-y-1.5 text-start">
            <label className="block text-xs font-medium text-slate-300">
              {t('customerNotes')}
            </label>
            <textarea
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={isAr ? 'ملاحظات وتفضيلات خاصة بالعميل...' : 'Special instructions or notes...'}
              className="w-full bg-[#111827] text-slate-100 placeholder-slate-500 text-xs rounded-lg border border-[#243048] p-3 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-colors shadow-inner"
            />
          </div>
        </form>
      </Modal>

      {/* Customer Profile & Fleet Modal */}
      <CustomerProfileModal
        customer={profileCustomer}
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          setProfileCustomer(null);
        }}
        onAddVehicleForCustomer={(customer) => {
          if (onSelectCustomerForVehicle) {
            onSelectCustomerForVehicle(customer);
          } else if (onNavigate) {
            onNavigate('vehicles');
          }
        }}
      />

      {/* Confirmation Modal for Archive / Restore / Delete */}
      {confirmAction && (
        <Modal
          isOpen={Boolean(confirmAction)}
          onClose={() => setConfirmAction(null)}
          title={
            confirmAction.type === 'archive'
              ? t('archiveCustomer')
              : confirmAction.type === 'restore'
              ? t('restoreCustomer')
              : t('deleteCustomer')
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
                <div className="font-bold text-slate-100">
                  {confirmAction.customer.fullName}
                </div>
                <p className="text-slate-400">
                  {confirmAction.type === 'archive'
                    ? t('archiveCustomerConfirm')
                    : confirmAction.type === 'restore'
                    ? t('restoreCustomerConfirm')
                    : t('deleteCustomerConfirm')}
                </p>
                {confirmAction.type === 'delete' && (confirmAction.customer.vehicleCount || 0) > 0 && (
                  <div className="p-2 mt-2 rounded bg-rose-950/40 border border-rose-500/40 text-rose-300 font-medium">
                    {t('cannotDeleteCustomerHasVehicles')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal for Unsaved Form Changes */}
      {showUnsavedWarning && (
        <Modal
          isOpen={showUnsavedWarning}
          onClose={() => setShowUnsavedWarning(false)}
          title={t('unsavedCustomerTitle')}
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnsavedWarning(false)}
              >
                {t('keepEditing')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleForceDiscard}
              >
                {t('discardChanges')}
              </Button>
            </div>
          }
        >
          <div className="flex items-start gap-3 py-2 text-xs text-slate-300">
            <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-slate-200 font-medium">
                {t('unsavedCustomerMessage')}
              </p>
              <p className="text-slate-400">
                {isAr
                  ? 'لم يتم حفظ البيانات المدخلة بعد، وسيتم فقدانها نهائياً إذا تابعت الإلغاء.'
                  : 'All entered inputs will be permanently discarded if you leave without clicking Save.'}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
