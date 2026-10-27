/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Spare Parts & Fluids Suppliers Management View
 */

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  AlertCircle,
  Building,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { type RouteId } from '../i18n/translations.ts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { garageApi } from '../services/garageClient.ts';
import type { SupplierDTO, SupplierInput } from '../types/ipc.ts';

export function SuppliersView({ onNavigate: _onNavigate }: { onNavigate?: (route: RouteId) => void }) {
  const { lang, isRtl } = useLanguage();
  const isAr = lang === 'ar';

  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierDTO | null>(null);

  // Form State
  const [formData, setFormData] = useState<SupplierInput>({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const res = await garageApi.getSuppliers();
      if (res.success && res.data) {
        setSuppliers(res.data);
      }
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (sup: SupplierDTO) => {
    setEditingSupplier(sup);
    setFormData({
      name: sup.name,
      phone: sup.phone || '',
      email: sup.email || '',
      address: sup.address || '',
      notes: sup.notes || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError(isAr ? 'يرجى إدخال اسم المورد' : 'Supplier name is required');
      return;
    }
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingSupplier) {
        const res = await garageApi.updateSupplier(editingSupplier.id, formData);
        if (!res.success) throw new Error(res.error || 'Failed to update');
      } else {
        const res = await garageApi.createSupplier(formData);
        if (!res.success) throw new Error(res.error || 'Failed to create');
      }
      setIsModalOpen(false);
      loadSuppliers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        isAr
          ? `هل أنت متأكد من حذف المورد "${name}"؟`
          : `Are you sure you want to delete supplier "${name}"?`
      )
    ) {
      return;
    }
    try {
      const res = await garageApi.deleteSupplier(id);
      if (res.success) {
        loadSuppliers();
      } else {
        alert(res.error || 'Failed to delete');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone && s.phone.includes(searchTerm)) ||
      (s.address && s.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-400" />
            <span>{isAr ? 'الموردون وشركات قطع الغيار' : 'Suppliers & Parts Vendors'}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAr
              ? 'إدارة موزعي قطع الغيار والزيوت المعتمدين وسجل العناوين والتواصل'
              : 'Manage spare parts suppliers, wholesale vendors, and contact addresses'}
          </p>
        </div>

        <Button
          variant="gold"
          onClick={openCreateModal}
          icon={<Plus className="w-4 h-4" />}
        >
          <span>{isAr ? 'إضافة مورد جديد' : 'New Supplier'}</span>
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-slate-400">{isAr ? 'إجمالي الموردين المسجلين' : 'Registered Suppliers'}</p>
              <h3 className="text-2xl font-black text-white mt-1">{suppliers.length}</h3>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Building className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-slate-400">{isAr ? 'الشركات المعتمدة في النظام' : 'Verified Vendors'}</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">
                {suppliers.filter((s) => s.phone).length} {isAr ? 'جهة موثقة' : 'Verified'}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Truck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isAr ? 'البحث باسم المورد، الهاتف، أو العنوان...' : 'Search by name, phone, or address...'}
              className={`w-full bg-[#0c111a] border border-[#1e283d] rounded-lg py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 ${
                isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
              }`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle icon={<Truck className="w-4 h-4" />}>
            <span>{isAr ? 'دليل الموردين' : 'Suppliers Directory'}</span>
          </CardTitle>
          <span className="text-xs text-slate-400">
            {filtered.length} {isAr ? 'مورد' : 'Vendors'}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-[#1c2638] bg-[#0c121d] text-slate-400">
                  <th className="p-3 text-start font-semibold">{isAr ? 'اسم الشركة / المورد' : 'Supplier Name'}</th>
                  <th className="p-3 text-start font-semibold">{isAr ? 'بيانات التواصل' : 'Contact'}</th>
                  <th className="p-3 text-start font-semibold">{isAr ? 'العنوان' : 'Address'}</th>
                  <th className="p-3 text-start font-semibold">{isAr ? 'ملاحظات' : 'Notes'}</th>
                  <th className="p-3 text-end font-semibold">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172030]">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      {isAr ? 'جاري التحميل...' : 'Loading suppliers...'}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      {isAr ? 'لا يوجد موردون مسجلون' : 'No suppliers found'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((sup) => (
                    <tr key={sup.id} className="hover:bg-[#121927] transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{sup.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: {sup.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="p-3 text-slate-300">
                        <div className="space-y-0.5">
                          {sup.phone && (
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span>{sup.phone}</span>
                            </div>
                          )}
                          {sup.email && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Mail className="w-3 h-3 text-slate-500" />
                              <span>{sup.email}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-300">
                        {sup.address ? (
                          <div className="flex items-center gap-1 text-[11px]">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{sup.address}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 max-w-xs truncate">
                        {sup.notes || <span className="text-slate-600">-</span>}
                      </td>
                      <td className="p-3 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(sup)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                            title={isAr ? 'تعديل' : 'Edit'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(sup.id, sup.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                            title={isAr ? 'حذف' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            className="w-full max-w-lg bg-[#0f1522] border border-[#212d45] rounded-xl shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#1c2638] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                <span>
                  {editingSupplier
                    ? isAr
                      ? 'تعديل بيانات المورد'
                      : 'Edit Supplier'
                    : isAr
                    ? 'تسجيل مورد جديد'
                    : 'New Supplier'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? 'اسم الشركة أو المورد *' : 'Supplier / Company Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={isAr ? 'مثال: شركة مسقط لقطع الغيار' : 'e.g. Muscat Auto Parts LLC'}
                  className="w-full bg-[#0a0e17] border border-[#212d45] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isAr ? 'رقم الهاتف' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="968xxxxxxx"
                    className="w-full bg-[#0a0e17] border border-[#212d45] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isAr ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="info@autoparts.om"
                    className="w-full bg-[#0a0e17] border border-[#212d45] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? 'العنوان والموقع' : 'Address / Location'}
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={isAr ? 'المعبيلة الصناعية، مسقط' : 'Al Mabela Industrial Area, Muscat'}
                  className="w-full bg-[#0a0e17] border border-[#212d45] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? 'ملاحظات' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={isAr ? 'شروط الدفع، فترات التسليم، إلخ...' : 'Payment terms, discount agreements...'}
                  className="w-full bg-[#0a0e17] border border-[#212d45] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#1c2638]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  type="submit"
                  variant="gold"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? isAr
                      ? 'جاري الحفظ...'
                      : 'Saving...'
                    : editingSupplier
                    ? isAr
                      ? 'حفظ التعديلات'
                      : 'Save Changes'
                    : isAr
                    ? 'تسجيل المورد'
                    : 'Create Supplier'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
