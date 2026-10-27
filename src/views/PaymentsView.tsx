/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Payments & Official Receipts Management View
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  Plus,
  Receipt,
  Printer,
  Calendar,
  CheckCircle2,
  DollarSign,
  ArrowUpRight,
  User,
  Car,
  FileText,
  Clock,
  X,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Card, CardContent } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { garageApi } from '../services/garageClient.ts';
import type { PaymentDTO, InvoiceDTO, PaymentMethod } from '../types/ipc.ts';
import { formatOMR } from '../core/currency.ts';

export function PaymentsView({ onNavigate }: { onNavigate?: (route: any) => void }) {
  const { lang, t } = useLanguage();
  const isAr = lang === 'ar';
  const { showToast } = useToast();

  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Modals
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [paymentAmountOmr, setPaymentAmountOmr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [refNumber, setRefNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Print voucher preview modal
  const [voucherPayment, setVoucherPayment] = useState<PaymentDTO | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [payRes, invRes] = await Promise.all([
        garageApi.getPayments(),
        garageApi.getInvoices(),
      ]);
      if (payRes.success && payRes.data) setPayments(payRes.data);
      if (invRes.success && invRes.data) setInvoices(invRes.data);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesMethod = methodFilter === 'ALL' || p.paymentMethod === methodFilter;
      const matchesDate = !dateFilter || p.paymentDate === dateFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.paymentNumber.toLowerCase().includes(q) ||
        (p.customerName && p.customerName.toLowerCase().includes(q)) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q)) ||
        (p.vehiclePlate && p.vehiclePlate.toLowerCase().includes(q)) ||
        (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q));

      return matchesMethod && matchesDate && matchesSearch;
    });
  }, [payments, methodFilter, dateFilter, searchQuery]);

  const unpaidInvoices = useMemo(() => {
    return invoices.filter((i) => i.balanceDueBaisa > 0 && i.status !== 'CANCELLED');
  }, [invoices]);

  const selectedInvoice = useMemo(() => {
    return invoices.find((i) => i.id === selectedInvoiceId);
  }, [invoices, selectedInvoiceId]);

  const totalCollectedBaisa = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + p.amountBaisa, 0);
  }, [filteredPayments]);

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoiceId) {
      showToast(isAr ? 'يرجى اختيار الفاتورة المستحقة' : 'Please select an invoice', 'error');
      return;
    }

    const amountFloat = parseFloat(paymentAmountOmr);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      showToast(isAr ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount', 'error');
      return;
    }

    const amountBaisa = Math.round(amountFloat * 1000);
    if (selectedInvoice && amountBaisa > selectedInvoice.balanceDueBaisa) {
      showToast(
        isAr
          ? `المبلغ المدخل يتجاوز الرصيد المستحق (${formatOMR(selectedInvoice.balanceDueBaisa)})`
          : `Amount exceeds balance due (${formatOMR(selectedInvoice.balanceDueBaisa)})`,
        'error'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await garageApi.recordPayment({
        invoiceId: selectedInvoiceId,
        amountBaisa,
        paymentMethod,
        referenceNumber: refNumber || undefined,
        notes: notes || undefined,
      });

      if (res.success) {
        showToast(isAr ? 'تم تسجيل سند القبض بنجاح' : 'Payment recorded successfully', 'success');
        setShowRecordModal(false);
        setSelectedInvoiceId('');
        setPaymentAmountOmr('');
        setRefNumber('');
        setNotes('');
        await loadData();
      } else {
        showToast(res.error || (isAr ? 'فشل تسجيل الدفعة' : 'Failed to record payment'), 'error');
      }
    } catch (err) {
      showToast(isAr ? 'خطأ أثناء تسجيل الدفعة' : 'Error recording payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function getMethodBadge(method: PaymentMethod) {
    switch (method) {
      case 'CASH':
        return <Badge variant="emerald" size="sm">{isAr ? 'نقداً (Cash)' : 'Cash'}</Badge>;
      case 'CARD_RECORDED':
        return <Badge variant="gold" size="sm">{isAr ? 'بطاقة بنكية (Card)' : 'Card'}</Badge>;
      case 'BANK_TRANSFER':
        return <Badge variant="sky" size="sm">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</Badge>;
      default:
        return <Badge variant="slate" size="sm">{method}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#1f2b40]">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span className="text-amber-400">
              <CreditCard className="w-5 h-5" />
            </span>
            <span>{isAr ? 'المدفوعات وسندات القبض' : 'Payments & Receipts'}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isAr
              ? 'سجل سندات القبض المعتمدة، متابعة تحصيل فواتير الصيانة نقداً وبطاقات وتحويلات بنكية'
              : 'Receipt vouchers ledger, invoice settlement tracking, and payment voucher printing'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="gold"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              if (unpaidInvoices.length > 0) {
                setSelectedInvoiceId(unpaidInvoices[0].id);
                setPaymentAmountOmr((unpaidInvoices[0].balanceDueBaisa / 1000).toFixed(3));
              }
              setShowRecordModal(true);
            }}
          >
            {isAr ? 'تسجيل سند قبض جديد' : 'Record New Payment'}
          </Button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">{isAr ? 'إجمالي المقبوضات المعروضة' : 'Total Filtered Receipts'}</p>
              <p className="text-xl font-black text-amber-400 mt-1 font-mono">
                {formatOMR(totalCollectedBaisa)}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">{isAr ? 'عدد السندات المسجلة' : 'Total Receipts Count'}</p>
              <p className="text-xl font-black text-white mt-1">
                {filteredPayments.length}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Receipt className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">{isAr ? 'فواتير قيد التحصيل' : 'Invoices Pending Payment'}</p>
              <p className="text-xl font-black text-sky-400 mt-1">
                {unpaidInvoices.length}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute top-3 start-3" />
            <input
              type="text"
              placeholder={
                isAr
                  ? 'بحث برقم السند، اسم العميل، رقم الفاتورة، اللوحة...'
                  : 'Search by receipt #, customer, invoice, plate...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ps-9 pe-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as any)}
              className="px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">{isAr ? 'جميع طرق الدفع' : 'All Payment Methods'}</option>
              <option value="CASH">{isAr ? 'نقداً (Cash)' : 'Cash'}</option>
              <option value="CARD_RECORDED">{isAr ? 'بطاقة (Card)' : 'Card'}</option>
              <option value="BANK_TRANSFER">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
            />

            {(searchQuery || methodFilter !== 'ALL' || dateFilter) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setMethodFilter('ALL');
                  setDateFilter('');
                }}
              >
                {isAr ? 'إعادة ضبط' : 'Reset'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#121927] border-b border-[#1f2b40] text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">{isAr ? 'رقم السند' : 'Receipt #'}</th>
                  <th className="px-4 py-3 text-start font-semibold">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="px-4 py-3 text-start font-semibold">{isAr ? 'العميل' : 'Customer'}</th>
                  <th className="px-4 py-3 text-start font-semibold">{isAr ? 'المركبة' : 'Vehicle'}</th>
                  <th className="px-4 py-3 text-start font-semibold">{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                  <th className="px-4 py-3 text-start font-semibold">{isAr ? 'طريقة السداد' : 'Method'}</th>
                  <th className="px-4 py-3 text-start font-semibold">{isAr ? 'المبلغ المحصل' : 'Amount Paid'}</th>
                  <th className="px-4 py-3 text-center font-semibold">{isAr ? 'سند القبض' : 'Voucher'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182335]">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      {isAr ? 'لا توجد سندات قبض تطابق الفلترة المحددة.' : 'No payment receipts found.'}
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-[#121927]/60 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-amber-400">
                        {p.paymentNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {p.paymentDate}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-100">
                        {p.customerName || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-mono">
                        {p.vehiclePlate || '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {p.invoiceNumber || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {getMethodBadge(p.paymentMethod)}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                        {formatOMR(p.amountBaisa)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Printer className="w-3.5 h-3.5 text-amber-400" />}
                          onClick={() => setVoucherPayment(p)}
                        >
                          {isAr ? 'طباعة' : 'Print'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Record Payment Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#23324d] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1f2b40]">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>{isAr ? 'تسجيل سند قبض وتحصيل فاتورة' : 'Record Payment Receipt'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRecordModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {isAr ? 'اختر الفاتورة المستحقة' : 'Select Invoice'}
                </label>
                {unpaidInvoices.length === 0 ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    {isAr ? 'لا توجد فواتير عليها رصيد مستحق حالياً.' : 'No invoices with outstanding balance.'}
                  </div>
                ) : (
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedInvoiceId(id);
                      const inv = invoices.find((i) => i.id === id);
                      if (inv) {
                        setPaymentAmountOmr((inv.balanceDueBaisa / 1000).toFixed(3));
                      }
                    }}
                    required
                    className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500 font-mono"
                  >
                    {unpaidInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} - {inv.customerName} - {formatOMR(inv.balanceDueBaisa)} {isAr ? 'مستحق' : 'due'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedInvoice && (
                <div className="p-3 rounded-lg bg-[#0c121e] border border-[#1b2537] space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isAr ? 'إجمالي الفاتورة:' : 'Grand Total:'}</span>
                    <span className="font-mono text-white">{formatOMR(selectedInvoice.grandTotalBaisa)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isAr ? 'المسدد سابقاً:' : 'Previously Paid:'}</span>
                    <span className="font-mono text-emerald-400">{formatOMR(selectedInvoice.paidAmountBaisa)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-[#1b2537] pt-1">
                    <span className="text-amber-400">{isAr ? 'الرصيد المستحق:' : 'Balance Due:'}</span>
                    <span className="font-mono text-amber-400">{formatOMR(selectedInvoice.balanceDueBaisa)}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {isAr ? 'المبلغ المراد تحصيله (ر.ع.)' : 'Amount (OMR)'}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={paymentAmountOmr}
                    onChange={(e) => setPaymentAmountOmr(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {isAr ? 'طريقة الدفع' : 'Payment Method'}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="CASH">{isAr ? 'نقداً (Cash)' : 'Cash'}</option>
                    <option value="CARD_RECORDED">{isAr ? 'بطاقة بنكية (Card)' : 'Card'}</option>
                    <option value="BANK_TRANSFER">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {isAr ? 'رقم الإيصال البنكي / المرجع (اختياري)' : 'Bank Reference # (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. POS-98214 or TRF-12003"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {isAr ? 'ملاحظات السند' : 'Receipt Notes'}
                </label>
                <input
                  type="text"
                  placeholder={isAr ? 'ملاحظات إضافية...' : 'Optional notes...'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1f2b40]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRecordModal(false)}
                  disabled={isSubmitting}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  type="submit"
                  variant="gold"
                  size="sm"
                  disabled={isSubmitting || unpaidInvoices.length === 0}
                >
                  {isSubmitting
                    ? (isAr ? 'جاري التسجيل...' : 'Recording...')
                    : (isAr ? 'حفظ سند القبض' : 'Record Payment')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Receipt Voucher Modal (Print View) */}
      {voucherPayment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl font-sans">
            {/* Header */}
            <div className="text-center pb-3 border-b-2 border-slate-900">
              <h2 className="text-lg font-black tracking-tight">AL RAWAHI GARAGE</h2>
              <p className="text-xs text-slate-600 font-semibold">كراج الرواحي لصيانة المركبات</p>
              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 mt-1 font-mono">
                <span>CR: 1498231</span>
                <span>•</span>
                <span>VAT: OM1100234567</span>
              </div>
              <div className="mt-2 inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded">
                {isAr ? 'سند قبض رسمي - OFFICIAL RECEIPT VOUCHER' : 'OFFICIAL RECEIPT VOUCHER'}
              </div>
            </div>

            {/* Voucher Details */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">{isAr ? 'رقم السند:' : 'Receipt No:'}</span>
                <span className="font-mono font-bold">{voucherPayment.paymentNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">{isAr ? 'التاريخ:' : 'Date:'}</span>
                <span>{voucherPayment.paymentDate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">{isAr ? 'استلمنا من الفاضل/ة:' : 'Received From:'}</span>
                <span className="font-bold">{voucherPayment.customerName || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">{isAr ? 'رقم الفاتورة:' : 'Invoice No:'}</span>
                <span className="font-mono font-semibold">{voucherPayment.invoiceNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">{isAr ? 'رقم المركبة:' : 'Vehicle Plate:'}</span>
                <span className="font-mono font-bold">{voucherPayment.vehiclePlate || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">{isAr ? 'طريقة السداد:' : 'Payment Method:'}</span>
                <span className="font-bold">{voucherPayment.paymentMethod}</span>
              </div>
              {voucherPayment.referenceNumber && (
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">{isAr ? 'المرجع البنكي:' : 'Reference #:'}</span>
                  <span className="font-mono">{voucherPayment.referenceNumber}</span>
                </div>
              )}
            </div>

            {/* Amount Box */}
            <div className="p-3 bg-slate-100 rounded-lg border border-slate-300 text-center space-y-1">
              <p className="text-[11px] text-slate-500 font-medium">{isAr ? 'المبلغ المستلم' : 'Amount Received'}</p>
              <p className="text-2xl font-black text-slate-950 font-mono">
                {formatOMR(voucherPayment.amountBaisa)}
              </p>
            </div>

            {/* Signatures */}
            <div className="pt-4 border-t border-slate-200 flex justify-between text-[11px] text-slate-600">
              <div className="text-center">
                <p>{isAr ? 'توقيع المحاسب / المشرف' : 'Cashier Signature'}</p>
                <div className="h-8 border-b border-slate-400 mt-1"></div>
              </div>
              <div className="text-center">
                <p>{isAr ? 'ختم الكراج' : 'Garage Stamp'}</p>
                <div className="h-8 border-b border-slate-400 mt-1"></div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setVoucherPayment(null)}
              >
                {isAr ? 'إغلاق' : 'Close'}
              </Button>
              <Button
                variant="gold"
                size="sm"
                icon={<Printer className="w-3.5 h-3.5" />}
                onClick={() => window.print()}
              >
                {isAr ? 'طباعة السند' : 'Print Voucher'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
