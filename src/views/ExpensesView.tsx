/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Workshop Operational Expenses Management View
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
  Plus,
  Search,
  Building,
  Wrench,
  Users,
  Zap,
  Trash2,
  AlertCircle,
  FileText,
  DollarSign,
  Tag,
  CreditCard,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { type RouteId } from '../i18n/translations.ts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { garageApi } from '../services/garageClient.ts';
import type { ExpenseDTO, ExpenseInput, ExpenseCategory, PaymentMethod } from '../types/ipc.ts';
import { formatOMR, fromBaisa, toBaisa } from '../core/currency.ts';

const EXPENSE_CATEGORIES: Array<{ id: ExpenseCategory; ar: string; en: string }> = [
  { id: 'RENT', ar: 'إيجار الورشة', en: 'Workshop Rent' },
  { id: 'ELECTRICITY_WATER', ar: 'كهرباء ومياه وانترنت', en: 'Utilities & Telecom' },
  { id: 'SALARIES', ar: 'رواتب وأجور الفنيين', en: 'Salaries & Wages' },
  { id: 'TOOLS_EQUIPMENT', ar: 'معدات وأدوات صيانة', en: 'Tools & Equipment' },
  { id: 'SUPPLIES', ar: 'مستلزمات وزيوت استهلاكية', en: 'Consumables & Supplies' },
  { id: 'GARAGE_MAINTENANCE', ar: 'صيانة الآلات والرافعات', en: 'Equipment Maintenance' },
  { id: 'OTHER', ar: 'مصاريف تشغيلية أخرى', en: 'Other Operating Expenses' },
];

export function ExpensesView({ onNavigate: _onNavigate }: { onNavigate?: (route: RouteId) => void }) {
  const { lang, isRtl } = useLanguage();
  const isAr = lang === 'ar';

  const [expenses, setExpenses] = useState<ExpenseDTO[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<ExpenseInput>({
    category: 'ELECTRICITY_WATER',
    amountBaisa: 15000,
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    payee: '',
    receiptRef: '',
    description: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      const res = await garageApi.getExpenses();
      if (res.success && res.data) {
        setExpenses(res.data);
      }
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const openCreateModal = () => {
    setFormData({
      category: 'ELECTRICITY_WATER',
      amountBaisa: 15000,
      expenseDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'CASH',
      payee: '',
      receiptRef: '',
      description: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amountBaisa || formData.amountBaisa <= 0) {
      setFormError(isAr ? 'يرجى إدخال مبلغ المصروف بصورة صحيحة' : 'Expense amount must be greater than zero');
      return;
    }
    if (!formData.payee.trim()) {
      setFormError(isAr ? 'يرجى تحديد اسم المستلم أو المدفوع له' : 'Payee name is required');
      return;
    }
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await garageApi.createExpense(formData);
      if (!res.success) throw new Error(res.error || 'Failed to create expense');
      setIsModalOpen(false);
      loadExpenses();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        isAr
          ? 'هل أنت متأكد من حذف هذا المصروف؟'
          : 'Are you sure you want to delete this expense record?'
      )
    ) {
      return;
    }
    try {
      const res = await garageApi.deleteExpense(id);
      if (res.success) {
        loadExpenses();
      } else {
        alert(res.error || 'Failed to delete expense');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const filtered = expenses.filter((exp) => {
    const matchesCategory = selectedCategory === 'ALL' || exp.category === selectedCategory;
    const matchesSearch =
      (exp.payee && exp.payee.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (exp.receiptRef && exp.receiptRef.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (exp.description && exp.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      exp.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalExpenseBaisa = filtered.reduce((acc, exp) => acc + exp.amountBaisa, 0);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-amber-400" />
            <span>{isAr ? 'المصروفات والنفقات التشغيلية' : 'Operating Expenses Ledger'}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAr
              ? 'تسجيل نفقات الجراج، الإيجارات، الفواتير، رواتب العمال، والمشتريات'
              : 'Record garage operational costs, workshop rent, utilities, and wages'}
          </p>
        </div>

        <Button
          variant="gold"
          onClick={openCreateModal}
          icon={<Plus className="w-4 h-4" />}
        >
          <span>{isAr ? 'تسجيل مصروف جديد' : 'Record Expense'}</span>
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-slate-400">{isAr ? 'إجمالي المصروفات المعروضة' : 'Total Expenses'}</p>
              <h3 className="text-xl font-bold font-mono text-rose-400 mt-1">
                {formatOMR(fromBaisa(totalExpenseBaisa), { arabicLabel: isAr, useThousandsSeparator: true })}
              </h3>
            </div>
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <TrendingDown className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-slate-400">{isAr ? 'عدد القيود المسجلة' : 'Recorded Vouchers'}</p>
              <h3 className="text-2xl font-black text-white mt-1">{filtered.length}</h3>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-slate-400">{isAr ? 'الخزينة ومصدر الدفع' : 'Payment Source'}</p>
              <h3 className="text-lg font-bold text-slate-200 mt-1">
                {isAr ? 'الصندوق الرئيسي (كاش)' : 'Main Cash Register'}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isAr ? 'البحث بالمدفوع له، رقم الإيصال، البيان...' : 'Search by payee, receipt ref, notes...'}
                className={`w-full bg-[#0c111a] border border-[#1e283d] rounded-lg py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 ${
                  isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
                }`}
              />
            </div>

            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-[#0c111a] border border-[#1e283d] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">{isAr ? 'جميع بنود المصروفات' : 'All Categories'}</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isAr ? c.ar : c.en}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle icon={<TrendingDown className="w-4 h-4" />}>
            <span>{isAr ? 'سجل المصروفات وسندات الصرف' : 'Expense Vouchers Ledger'}</span>
          </CardTitle>
          <span className="text-xs text-slate-400">
            {filtered.length} {isAr ? 'سند صرف' : 'Vouchers'}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-[#1c2638] bg-[#0c121d] text-slate-400">
                  <th className="p-3 text-start font-semibold">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="p-3 text-start font-semibold">{isAr ? 'البند / الفئة' : 'Category'}</th>
                  <th className="p-3 text-start font-semibold">{isAr ? 'المدفوع له' : 'Payee / Recipient'}</th>
                  <th className="p-3 text-start font-semibold">{isAr ? 'طريقة الدفع والرمز' : 'Method & Ref'}</th>
                  <th className="p-3 text-start font-semibold">{isAr ? 'البيان' : 'Description'}</th>
                  <th className="p-3 text-start font-semibold">{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className="p-3 text-end font-semibold">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172030]">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      {isAr ? 'جاري التحميل...' : 'Loading expenses...'}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      {isAr ? 'لا توجد سندات صرف مسجلة' : 'No expense records found'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((exp) => {
                    const catDef = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
                    return (
                      <tr key={exp.id} className="hover:bg-[#121927] transition-colors">
                        <td className="p-3 font-mono text-slate-300">
                          {new Date(exp.expenseDate).toLocaleDateString(isAr ? 'ar-OM' : 'en-GB')}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-[#182234] border border-[#233148] text-amber-300 font-medium text-[11px]">
                            {catDef ? (isAr ? catDef.ar : catDef.en) : exp.category}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-white">
                          {exp.payee || <span className="text-slate-600">-</span>}
                        </td>
                        <td className="p-3 text-slate-300">
                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <CreditCard className="w-3 h-3 text-slate-500" />
                            <span>{exp.paymentMethod}</span>
                          </div>
                          {exp.receiptRef && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              #{exp.receiptRef}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-400 max-w-xs truncate">
                          {exp.description || <span className="text-slate-600">-</span>}
                        </td>
                        <td className="p-3 font-mono font-bold text-rose-400">
                          {formatOMR(fromBaisa(exp.amountBaisa), { arabicLabel: isAr, useThousandsSeparator: true })}
                        </td>
                        <td className="p-3 text-end">
                          <button
                            type="button"
                            onClick={() => handleDelete(exp.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                            title={isAr ? 'حذف' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Record Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            className="w-full max-w-lg bg-[#0f1522] border border-[#212d45] rounded-xl shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#1c2638] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-amber-400" />
                <span>{isAr ? 'تسجيل سند صرف / مصروف جديد' : 'New Expense Voucher'}</span>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isAr ? 'بند المصروف *' : 'Expense Category *'}
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                    className="w-full bg-[#0a0e17] border border-[#212d45] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {isAr ? cat.ar : cat.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isAr ? 'المبلغ (ريال عُماني OMR) *' : 'Amount (OMR) *'}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={fromBaisa(formData.amountBaisa)}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        amountBaisa: toBaisa(parseFloat(e.target.value) || 0),
                      })
                    }
                    className="w-full bg-[#0a0e17] border border-[#212d45] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isAr ? 'تاريخ الصرف' : 'Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-[#212d45] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isAr ? 'طريقة الدفع' : 'Payment Method'}
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                    className="w-full bg-[#0a0e17] border border-[#212d45] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="CASH">{isAr ? 'نقدي (كاش)' : 'Cash'}</option>
                    <option value="CARD">{isAr ? 'بطاقة بنكية (POS)' : 'Debit/Credit Card'}</option>
                    <option value="BANK_TRANSFER">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                    <option value="CHEQUE">{isAr ? 'شيك' : 'Cheque'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isAr ? 'المدفوع له (المستلم) *' : 'Payee / Recipient *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.payee}
                    onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                    placeholder={isAr ? 'مثال: شركة مسقط لتوزيع الكهرباء' : 'e.g. Muscat Electricity Co.'}
                    className="w-full bg-[#0a0e17] border border-[#212d45] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isAr ? 'رقم الإيصال / المرجع' : 'Receipt / Reference #'}
                  </label>
                  <input
                    type="text"
                    value={formData.receiptRef || ''}
                    onChange={(e) => setFormData({ ...formData, receiptRef: e.target.value })}
                    placeholder="REC-9821"
                    className="w-full bg-[#0a0e17] border border-[#212d45] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? 'البيان والملاحظات' : 'Notes / Description'}
                </label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={isAr ? 'شرح تفاصيل المصروف...' : 'Detailed description of the expense...'}
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
                    : isAr
                    ? 'تسجيل السند'
                    : 'Save Voucher'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
