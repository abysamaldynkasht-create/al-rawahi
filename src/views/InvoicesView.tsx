/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Invoices & Visit Settlement View with Customer Retention Integration
 */

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Printer,
  CreditCard,
  UserCheck,
  UserPlus,
  Car,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  RefreshCw,
  Eye,
  Filter,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import type { RouteId } from '../i18n/translations.ts';
import { Card, CardContent } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { SearchInput, Input } from '../components/ui/Input.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { garageApi } from '../services/garageClient.ts';
import type { InvoiceDTO, CustomerDTO, VehicleDTO, PaymentMethod } from '../types/ipc.ts';
import { formatOMR, toBaisa, fromBaisa } from '../core/currency.ts';
import { CustomerRetentionModal } from '../components/CustomerRetentionModal.tsx';
import { InvoiceDocumentModal } from '../components/InvoiceDocumentModal.tsx';

export function InvoicesView({ onNavigate }: { onNavigate?: (route: RouteId) => void }) {
  const { lang, isRtl, t } = useLanguage();
  const isAr = lang === 'ar';
  const { showToast } = useToast();

  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [vehicles, setVehicles] = useState<VehicleDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUED' | 'PAID'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceDTO | null>(null);

  // Retention Dialog Trigger State
  const [retentionTarget, setRetentionTarget] = useState<{
    customer: CustomerDTO;
    invoice: InvoiceDTO;
  } | null>(null);

  // Payment Modal State
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<InvoiceDTO | null>(null);
  const [paymentAmountOmr, setPaymentAmountOmr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // New Invoice Modal State
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [partsAmountOmr, setPartsAmountOmr] = useState('15.000');
  const [laborAmountOmr, setLaborAmountOmr] = useState('10.000');
  const [discountOmr, setDiscountOmr] = useState('0.000');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  // Load Invoices
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invRes, custRes, vehRes] = await Promise.all([
        garageApi.getInvoices(),
        garageApi.getCustomers(undefined, true, true), // include temporary customers
        garageApi.getVehicles(),
      ]);

      if (invRes.success && invRes.data) {
        setInvoices(invRes.data);
      }
      if (custRes.success && custRes.data) {
        setCustomers(custRes.data);
      }
      if (vehRes.success && vehRes.data) {
        setVehicles(vehRes.data);
      }
    } catch {
      showToast('Error loading invoices', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
      (inv.vehiclePlate && inv.vehiclePlate.toLowerCase().includes(q))
    );
  });

  // Handle Print Invoice
  const handlePrint = async (invoice: InvoiceDTO) => {
    try {
      const res = await garageApi.printInvoice(invoice.id, 'ar');
      if (res.success && res.data) {
        showToast(t('printSuccess'), 'success');
        await loadData();

        // Check if retention dialog should appear
        if (res.data.promptEligible && res.data.customer) {
          setRetentionTarget({
            customer: res.data.customer,
            invoice,
          });
        }
      } else {
        showToast(res.error || 'Print failed', 'error');
      }
    } catch {
      showToast('Print communication error', 'error');
    }
  };

  // Open Payment Modal
  const openPaymentModal = (invoice: InvoiceDTO) => {
    setPaymentModalInvoice(invoice);
    setPaymentAmountOmr((invoice.balanceDueBaisa / 1000).toFixed(3));
    setPaymentMethod('CASH');
    setPaymentReference('');
  };

  // Submit Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;

    const baisa = toBaisa(paymentAmountOmr);
    if (baisa <= 0) {
      showToast('Payment amount must be greater than zero', 'error');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await garageApi.recordPayment({
        invoiceId: paymentModalInvoice.id,
        amountBaisa: baisa,
        paymentMethod,
        referenceNumber: paymentReference.trim() || undefined,
      });

      if (res.success && res.data) {
        showToast(t('paymentSuccess'), 'success');
        setPaymentModalInvoice(null);
        await loadData();

        // Check retention prompt eligibility
        if (res.data.promptEligible && res.data.customer) {
          setRetentionTarget({
            customer: res.data.customer,
            invoice: res.data.invoice,
          });
        }
      } else {
        showToast(res.error || 'Payment failed', 'error');
      }
    } catch {
      showToast('Payment error', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Handle Manual Promote
  const handleManualPromote = async (customerId: string) => {
    try {
      const res = await garageApi.promoteCustomer(customerId);
      if (res.success) {
        showToast(t('retentionSuccessPermanent'), 'success');
        await loadData();
      }
    } catch {
      showToast('Promotion failed', 'error');
    }
  };

  // Submit New Invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      showToast('Please select a customer', 'error');
      return;
    }

    setIsCreatingInvoice(true);
    try {
      const res = await garageApi.createInvoice({
        customerId: selectedCustomerId,
        vehicleId: selectedVehicleId || undefined,
        subtotalPartsBaisa: toBaisa(partsAmountOmr),
        subtotalLaborBaisa: toBaisa(laborAmountOmr),
        discountBaisa: toBaisa(discountOmr),
        taxRatePercent: 5.0,
        notes: invoiceNotes.trim() || undefined,
        invoiceLanguage: 'ar',
      });

      if (res.success && res.data) {
        showToast('Invoice created successfully', 'success');
        setIsNewInvoiceOpen(false);
        await loadData();
      } else {
        showToast(res.error || 'Invoice creation failed', 'error');
      }
    } catch {
      showToast('Error creating invoice', 'error');
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  // Statistics
  const totalInvoices = invoices.length;
  const paidInvoices = invoices.filter((i) => i.status === 'PAID').length;
  const pendingInvoices = invoices.filter((i) => i.status !== 'PAID').length;
  const temporaryVisitsCount = invoices.filter((i) => i.isCustomerPermanent === false).length;

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#1f2b40]">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Receipt className="w-5 h-5" />
            </span>
            <span>{isAr ? 'الفواتير والزيارات ومتابعة السداد' : 'Invoices & Service Settlements'}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isAr
              ? 'إدارة فواتير الصيانة، سداد الدفعات، طباعة الفواتير، ونظام استبقاء العملاء التلقائي.'
              : 'Service invoices, payment recordings, invoice printing, and automated retention prompts.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            {t('refresh')}
          </Button>

          <Button
            variant="gold"
            size="sm"
            onClick={() => {
              setIsNewInvoiceOpen(true);
              if (customers.length > 0) setSelectedCustomerId(customers[0].id);
            }}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            {t('newInvoiceAction')}
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-[#0f1624] border-[#1d273a]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{isAr ? 'إجمالي الفواتير' : 'Total Invoices'}</p>
              <p className="text-xl font-bold text-white mt-1">{totalInvoices}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Receipt className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f1624] border-[#1d273a]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{isAr ? 'مدفوعة بالكامل' : 'Paid In Full'}</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">{paidInvoices}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f1624] border-[#1d273a]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{isAr ? 'بانتظار السداد' : 'Pending Balance'}</p>
              <p className="text-xl font-bold text-amber-400 mt-1">{pendingInvoices}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f1624] border-[#1d273a]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{isAr ? 'فواتير الزيارات المؤقتة' : 'Temporary Visit Visits'}</p>
              <p className="text-xl font-bold text-sky-400 mt-1">{temporaryVisitsCount}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0d131f] p-3 rounded-xl border border-[#1a2436]">
        <div className="w-full sm:w-80">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث برقم الفاتورة، اسم العميل، رقم اللوحة...' : 'Search by invoice #, customer, plate...'}
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs">
          <span className="text-slate-400 hidden md:inline flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            {isAr ? 'الحالة:' : 'Filter:'}
          </span>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            {isAr ? 'الكل' : 'All'}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PAID')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'PAID'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            {isAr ? 'مدفوعة' : 'Paid'}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ISSUED')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'ISSUED'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            {isAr ? 'بانتظار السداد' : 'Pending'}
          </button>
        </div>
      </div>

      {/* Invoices List / Table */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-8 h-8" />}
          title={isAr ? 'لا توجد فواتير مطابقة' : 'No matching invoices'}
          description={isAr ? 'لم يتم العثور على فواتير تطابق معايير البحث الحالية.' : 'No invoices found matching your search filter.'}
          action={
            <Button variant="gold" size="sm" onClick={() => setIsNewInvoiceOpen(true)}>
              {t('newInvoiceAction')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((invoice) => {
            const isPaid = invoice.status === 'PAID' || invoice.balanceDueBaisa <= 0;
            const isPrinted = Boolean(invoice.printedAt);
            const isPermanent = invoice.isCustomerPermanent !== false;

            return (
              <div
                key={invoice.id}
                className="bg-[#0f1522] border border-[#1b2538] hover:border-[#27364f] rounded-xl p-4 transition-all shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                {/* Left Info Column */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {invoice.invoiceNumber}
                    </span>

                    {/* Status Badge */}
                    <Badge variant={isPaid ? 'emerald' : 'amber'}>
                      {isPaid ? t('invoicePaid') : t('invoiceIssued')}
                    </Badge>

                    {/* Customer Status Badge */}
                    <Badge variant={isPermanent ? 'slate' : 'sky'}>
                      {isPermanent ? (
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-emerald-400" />
                          {t('permanentCustomer')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <UserPlus className="w-3 h-3 text-sky-400" />
                          {t('temporaryCustomer')}
                        </span>
                      )}
                    </Badge>

                    {/* Print Status Badge */}
                    <Badge variant={isPrinted ? 'emerald' : 'slate'}>
                      <span className="flex items-center gap-1">
                        <Printer className="w-3 h-3" />
                        {isPrinted ? t('printedStatus') : t('notPrintedStatus')}
                      </span>
                    </Badge>
                  </div>

                  {/* Customer and Vehicle Details */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">{t('customerInputLabel')}:</span>
                      <span className="font-semibold text-slate-100">{invoice.customerName || '—'}</span>
                    </div>

                    {invoice.vehiclePlate && (
                      <div className="flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-mono text-amber-300 bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-500/20">
                          {invoice.vehiclePlate}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{invoice.invoiceDate}</span>
                    </div>
                  </div>
                </div>

                {/* Right Financial & Actions Column */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                  {/* Financial amounts */}
                  <div className="text-start sm:text-end">
                    <div className="text-xs text-slate-400">{t('grandTotal')}</div>
                    <div className="text-base font-bold text-white">
                      {formatOMR(fromBaisa(invoice.grandTotalBaisa), { arabicLabel: isAr })}
                    </div>
                    {invoice.balanceDueBaisa > 0 ? (
                      <div className="text-[11px] text-amber-400 font-medium">
                        {t('balanceDue')}: {formatOMR(fromBaisa(invoice.balanceDueBaisa), { arabicLabel: isAr })}
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-400 font-medium">
                        {isAr ? 'تم السداد بالكامل' : 'Paid in full'}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isPaid && (
                      <Button
                        variant="gold"
                        size="sm"
                        onClick={() => openPaymentModal(invoice)}
                        icon={<CreditCard className="w-3.5 h-3.5" />}
                      >
                        {t('recordPaymentAction')}
                      </Button>
                    )}

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        const fullInv = await garageApi.getInvoiceById(invoice.id);
                        setViewingInvoice(fullInv.success && fullInv.data ? fullInv.data : invoice);
                      }}
                      icon={<Eye className="w-3.5 h-3.5" />}
                    >
                      {isAr ? 'عرض الفاتورة' : 'View'}
                    </Button>

                    <Button
                      variant={isPrinted ? 'secondary' : 'gold'}
                      size="sm"
                      onClick={() => handlePrint(invoice)}
                      icon={<Printer className="w-3.5 h-3.5" />}
                    >
                      {t('printInvoiceAction')}
                    </Button>

                    {!isPermanent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleManualPromote(invoice.customerId)}
                        className="text-amber-400 hover:text-amber-300 hover:bg-amber-950/30 border border-amber-500/20"
                        icon={<UserCheck className="w-3.5 h-3.5" />}
                      >
                        {t('saveAsPermanent')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setPaymentModalInvoice(null)}
          title={isAr ? 'تسجيل دفعة للفاتورة' : 'Record Invoice Payment'}
          maxWidth="md"
        >
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            <div className="bg-[#121927] p-3 rounded-lg border border-[#1e2a3f] text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">{t('invoiceNumber')}:</span>
                <span className="font-mono font-bold text-white">{paymentModalInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('customerInputLabel')}:</span>
                <span className="font-semibold text-slate-200">{paymentModalInvoice.customerName}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1 text-sm">
                <span className="text-slate-400">{t('balanceDue')}:</span>
                <span className="font-bold text-amber-400">
                  {formatOMR(fromBaisa(paymentModalInvoice.balanceDueBaisa), { arabicLabel: isAr })}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                {isAr ? 'المبلغ المسدد (ر.ع.)' : 'Amount to Pay (OMR)'}
              </label>
              <Input
                type="number"
                step="0.001"
                min="0.001"
                value={paymentAmountOmr}
                onChange={(e) => setPaymentAmountOmr(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                {isAr ? 'طريقة السداد' : 'Payment Method'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-[#121927] border border-[#233047] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="CASH">{isAr ? 'نقداً (Cash)' : 'Cash'}</option>
                <option value="CARD_RECORDED">{isAr ? 'بطاقة بنكية مسجلة (Card)' : 'Card Recorded'}</option>
                <option value="BANK_TRANSFER">{isAr ? 'تحويل بنكي (Bank Transfer)' : 'Bank Transfer'}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                {isAr ? 'رقم الإيصال / المرجع البنكي (اختياري)' : 'Reference / Receipt Number (Optional)'}
              </label>
              <Input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={isAr ? 'مثال: TXN-987654' : 'e.g. TXN-987654'}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPaymentModalInvoice(null)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="gold" size="sm" disabled={isSubmittingPayment}>
                {isSubmittingPayment ? t('loading') : isAr ? 'تأكيد وقبض الدفعة' : 'Confirm Payment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* New Invoice Modal */}
      {isNewInvoiceOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsNewInvoiceOpen(false)}
          title={isAr ? 'إصدار فاتورة خدمة / زيارة جديدة' : 'Create Service Visit Invoice'}
          maxWidth="md"
        >
          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                {t('customerInputLabel')}
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-[#121927] border border-[#233047] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} {c.isPermanent === false ? (isAr ? '(زيارة مؤقتة)' : '(Temporary)') : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                {t('vehiclesTitle')} (اختياري)
              </label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full bg-[#121927] border border-[#233047] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">{isAr ? '— بدون ربط مركبة —' : '— No vehicle linked —'}</option>
                {vehicles
                  .filter((v) => !selectedCustomerId || v.customerId === selectedCustomerId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plateNumber} ({v.make} {v.model})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  {t('subtotalParts')} (ر.ع.)
                </label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={partsAmountOmr}
                  onChange={(e) => setPartsAmountOmr(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  {t('subtotalLabor')} (ر.ع.)
                </label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={laborAmountOmr}
                  onChange={(e) => setLaborAmountOmr(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                {isAr ? 'الملاحظات والخدمات المنفذة' : 'Notes & Performed Services'}
              </label>
              <textarea
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                rows={2}
                className="w-full bg-[#121927] border border-[#233047] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder={isAr ? 'مثال: فحص دوري، تغيير زيت وفلتر أصلي...' : 'e.g. Periodic inspection, engine oil and OEM filter...'}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsNewInvoiceOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="gold" size="sm" disabled={isCreatingInvoice}>
                {isCreatingInvoice ? t('loading') : t('save')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Customer Retention Modal Dialog */}
      {retentionTarget && (
        <CustomerRetentionModal
          isOpen={true}
          onClose={() => setRetentionTarget(null)}
          customer={retentionTarget.customer}
          invoice={retentionTarget.invoice}
          onCustomerRetained={async () => {
            await loadData();
          }}
          onDismissed={async () => {
            await loadData();
          }}
        />
      )}

      {/* Official Invoice Document Modal */}
      <InvoiceDocumentModal
        invoice={viewingInvoice}
        isOpen={Boolean(viewingInvoice)}
        onClose={() => setViewingInvoice(null)}
        onPaymentRecorded={loadData}
      />
    </div>
  );
}
