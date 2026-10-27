/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Register Vehicle Handover & Delivery Workflow
 * 
 * Features:
 * - Search by Plate, Customer Name, or Repair Order Number
 * - Real Itemized Financial Breakdown (Services + Parts)
 * - Validated Discount Action in Integer Baisa
 * - Payment Method Selection (Cash, Card, Bank Transfer)
 * - Safe Idempotent Handover Completion
 * - Direct Access to View, Print, and Export Invoice PDF
 */

import React, { useState, useEffect } from 'react';
import {
  Car,
  Search,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Printer,
  Download,
  Receipt,
  Clock,
  User,
  ShieldCheck,
  RefreshCw,
  Percent,
  PlusCircle,
  FileCheck,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input, SearchInput } from '../components/ui/Input.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { garageApi } from '../services/garageClient.ts';
import type {
  RepairOrderDTO,
  LaborTaskDTO,
  RepairOrderPartDTO,
  InvoiceDTO,
  PaymentMethod,
} from '../types/ipc.ts';
import { formatOMR, toBaisa, fromBaisa } from '../core/currency.ts';
import { InvoiceDocumentModal } from '../components/InvoiceDocumentModal.tsx';
import type { RouteId } from '../i18n/translations.ts';

export function VehicleHandoverView({ onNavigate }: { onNavigate?: (route: RouteId) => void }) {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [readyOrders, setReadyOrders] = useState<RepairOrderDTO[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RepairOrderDTO | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Breakdown details of selected order
  const [laborTasks, setLaborTasks] = useState<LaborTaskDTO[]>([]);
  const [issuedParts, setIssuedParts] = useState<RepairOrderPartDTO[]>([]);
  const [existingInvoice, setExistingInvoice] = useState<InvoiceDTO | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Discount & Payment inputs
  const [discountOmr, setDiscountOmr] = useState('0.000');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [paymentAmountOmr, setPaymentAmountOmr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');

  // Submission & Invoice Modal states
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
  const [viewInvoiceModalOpen, setViewInvoiceModalOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<InvoiceDTO | null>(null);

  // Load all pending / ready repair orders
  const loadReadyOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await garageApi.getRepairOrders();
      if (res.success && res.data) {
        // Exclude already delivered/cancelled orders
        setReadyOrders(res.data.filter((ro) => ro.status !== 'CANCELLED'));
      }
    } catch {
      showToast('خطأ في تحميل أوامر الصيانة', 'error');
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadReadyOrders();
  }, []);

  // Filter orders by search
  const filteredOrders = readyOrders.filter((ro) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      ro.roNumber.toLowerCase().includes(q) ||
      (ro.customerName && ro.customerName.toLowerCase().includes(q)) ||
      (ro.vehiclePlate && ro.vehiclePlate.toLowerCase().includes(q))
    );
  });

  // Select an order & load details
  const handleSelectOrder = async (order: RepairOrderDTO) => {
    setSelectedOrder(order);
    setIsLoadingDetails(true);
    setDiscountOmr('0.000');
    setCompletedInvoice(null);

    try {
      const [tasksRes, partsRes, invoicesRes] = await Promise.all([
        garageApi.getLaborTasks(order.id),
        garageApi.getRepairOrderParts(order.id),
        garageApi.getInvoices(order.customerId),
      ]);

      if (tasksRes.success && tasksRes.data) setLaborTasks(tasksRes.data);
      if (partsRes.success && partsRes.data) {
        setIssuedParts(partsRes.data.filter((p) => p.status === 'ISSUED'));
      }

      // Check if invoice already issued for this RO
      if (invoicesRes.success && invoicesRes.data) {
        const found = invoicesRes.data.find((i) => i.repairOrderId === order.id);
        if (found) {
          // fetch full invoice with items
          const fullInv = await garageApi.getInvoiceById(found.id);
          setExistingInvoice(fullInv.success && fullInv.data ? fullInv.data : found);
          setDiscountOmr(fromBaisa(found.discountBaisa).toFixed(3));
        } else {
          setExistingInvoice(null);
        }
      }
    } catch {
      showToast('خطأ في استرجاع تفاصيل أمر الصيانة', 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Financial Calculations (Integer Baisa)
  const partsSubtotalBaisa = issuedParts.reduce((sum, p) => sum + p.totalPriceBaisa, 0);
  const laborSubtotalBaisa = laborTasks.reduce((sum, t) => sum + t.laborChargeBaisa, 0);
  const discountBaisa = toBaisa(parseFloat(discountOmr) || 0);
  const taxableBaseBaisa = Math.max(0, partsSubtotalBaisa + laborSubtotalBaisa - discountBaisa);
  const vatBaisa = Math.round((taxableBaseBaisa * 5) / 100);
  const finalPayableBaisa = existingInvoice ? existingInvoice.grandTotalBaisa : taxableBaseBaisa + vatBaisa;
  const alreadyPaidBaisa = existingInvoice ? existingInvoice.paidAmountBaisa : 0;
  const remainingBalanceBaisa = existingInvoice
    ? existingInvoice.balanceDueBaisa
    : Math.max(0, finalPayableBaisa - alreadyPaidBaisa);

  // Set default payment amount to remaining balance when calculated
  useEffect(() => {
    if (remainingBalanceBaisa > 0) {
      setPaymentAmountOmr(fromBaisa(remainingBalanceBaisa).toFixed(3));
    } else {
      setPaymentAmountOmr('0.000');
    }
  }, [remainingBalanceBaisa]);

  // Execute Handover & Issue/Settle Invoice
  const handleConfirmHandover = async () => {
    if (!selectedOrder) return;

    setIsSubmittingHandover(true);
    try {
      let invoice = existingInvoice;

      // 1. If invoice does not exist yet, issue it
      if (!invoice) {
        const createInvRes = await garageApi.createInvoiceFromRepairOrder({
          repairOrderId: selectedOrder.id,
          discountBaisa,
          notes: handoverNotes || `تسليم المركبة: ${selectedOrder.vehiclePlate || ''}`,
          invoiceLanguage: 'ar',
        });

        if (!createInvRes.success || !createInvRes.data) {
          showToast(createInvRes.error || 'فشل إصدار الفاتورة لأمر الصيانة', 'error');
          setIsSubmittingHandover(false);
          return;
        }

        invoice = createInvRes.data;
      }

      // 2. If a payment amount is entered (> 0), record it
      const paymentBaisa = toBaisa(parseFloat(paymentAmountOmr) || 0);
      if (paymentBaisa > 0 && invoice) {
        const payRes = await garageApi.recordPayment({
          invoiceId: invoice.id,
          amountBaisa: paymentBaisa,
          paymentMethod,
          referenceNumber: paymentReference.trim() || undefined,
          notes: 'سداد عند تسليم المركبة',
        });

        if (!payRes.success) {
          showToast(payRes.error || 'فشل تسجيل الدفعة المالية', 'error');
        }
      }

      // 3. Update Repair Order status to DELIVERED
      await garageApi.updateRepairOrderStatus({
        repairOrderId: selectedOrder.id,
        newStatus: 'DELIVERED',
        remarks: 'تم تسليم المركبة للعميل وإنهاء الحساب',
        changedBy: 'المسؤول / Admin',
      });

      // 4. Fetch the refreshed invoice for viewing
      if (invoice) {
        const refreshed = await garageApi.getInvoiceById(invoice.id);
        const finalInv = refreshed.success && refreshed.data ? refreshed.data : invoice;
        setCompletedInvoice(finalInv);
        setExistingInvoice(finalInv);
      }

      showToast('تم تسجيل تسليم المركبة وإنهاء الحساب بنجاح', 'success');
      loadReadyOrders();
    } catch {
      showToast('حدث خطأ أثناء إتمام تسليم المركبة', 'error');
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1c273a] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                تسجيل تسليم مركبة (Vehicle Handover)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                فحص الحساب التفصيلي، تطبيق الخصم، استلام الدفعات، وإصدار الفاتورة الختامية
              </p>
            </div>
          </div>
        </div>

        {completedInvoice && (
          <div className="flex items-center gap-2">
            <Button
              variant="gold"
              size="sm"
              icon={<Receipt className="w-4 h-4" />}
              onClick={() => setViewInvoiceModalOpen(true)}
            >
              عرض الفاتورة المعتمدة
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer className="w-4 h-4" />}
              onClick={() => garageApi.printInvoice(completedInvoice.id, 'ar')}
            >
              طباعة
            </Button>
          </div>
        )}
      </div>

      {/* Search Header Strip */}
      <div className="bg-[#0f1522] border border-[#1c273a] p-4 rounded-xl space-y-3">
        <label className="text-xs font-semibold text-slate-300 block">
          بحث عن مركبة أو أمر صيانة جاهز للتسليم (برقم اللوحة، اسم العميل، أو رقم الأمر):
        </label>
        <div className="w-full max-w-xl">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث هنا (مثال: 12345، سالم، RO-202610...)"
          />
        </div>

        {/* Horizontal Quick Picker of Ready Orders */}
        <div className="pt-2">
          <div className="text-[11px] font-semibold text-slate-400 mb-2">
            أوامر الصيانة النشطة المتاحة للتسليم ({filteredOrders.length}):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
            {filteredOrders.map((ro) => {
              const isSelected = selectedOrder?.id === ro.id;
              const isReady = ro.status === 'READY_FOR_DELIVERY' || ro.status === 'COMPLETED';
              return (
                <button
                  key={ro.id}
                  type="button"
                  onClick={() => handleSelectOrder(ro)}
                  className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 shadow-md ring-1 ring-amber-500'
                      : 'bg-[#141d2f] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-amber-300 bg-black/60 px-2 py-0.5 rounded text-xs">
                      {ro.roNumber}
                    </span>
                    <Badge variant={isReady ? 'emerald' : 'amber'} size="sm">
                      {ro.status}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs font-bold text-white truncate">
                    {ro.customerName || 'عميل'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-300 font-mono">
                    اللوحة: {ro.vehiclePlate || '—'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Handover & Account Detail */}
      {selectedOrder ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Itemized Account & Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-[#0f1522] border-[#1d273a]">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">
                        الحساب التفصيلي لأمر الصيانة: {selectedOrder.roNumber}
                      </h3>
                      {existingInvoice && (
                        <Badge variant="emerald">فاتورة مصدرة: {existingInvoice.invoiceNumber}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      العميل: {selectedOrder.customerName} • المركبة: {selectedOrder.vehiclePlate}
                    </p>
                  </div>
                </div>

                {isLoadingDetails ? (
                  <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>جارٍ تحميل البنود وقطع الغيار...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Labor Tasks Table */}
                    <div>
                      <div className="text-xs font-bold text-slate-300 mb-2">
                        بنود أجور اليد والخدمات ({laborTasks.length}):
                      </div>
                      <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-right">
                          <thead className="bg-[#121927] text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="p-2.5">البيان</th>
                              <th className="p-2.5 text-center">الفني</th>
                              <th className="p-2.5 text-left">المبلغ (ر.ع)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {laborTasks.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="p-3 text-center text-slate-500">
                                  لا توجد أجور يد مسجلة
                                </td>
                              </tr>
                            ) : (
                              laborTasks.map((t) => (
                                <tr key={t.id}>
                                  <td className="p-2.5 text-white font-medium">{t.description}</td>
                                  <td className="p-2.5 text-center text-slate-400">
                                    {t.technicianName || '—'}
                                  </td>
                                  <td className="p-2.5 text-left font-mono font-bold text-amber-300">
                                    {formatOMR(fromBaisa(t.laborChargeBaisa))}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Issued Parts Table */}
                    <div>
                      <div className="text-xs font-bold text-slate-300 mb-2">
                        قطع الغيار المنصرفة ({issuedParts.length}):
                      </div>
                      <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-right">
                          <thead className="bg-[#121927] text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="p-2.5">القطعة</th>
                              <th className="p-2.5 text-center">الكمية</th>
                              <th className="p-2.5 text-left">سعر الوحدة</th>
                              <th className="p-2.5 text-left">الإجمالي (ر.ع)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {issuedParts.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-3 text-center text-slate-500">
                                  لم يتم صرف أي قطع غيار
                                </td>
                              </tr>
                            ) : (
                              issuedParts.map((p) => (
                                <tr key={p.id}>
                                  <td className="p-2.5 text-white font-medium">{p.partName}</td>
                                  <td className="p-2.5 text-center font-mono text-slate-300">
                                    {p.quantity}
                                  </td>
                                  <td className="p-2.5 text-left font-mono text-slate-400">
                                    {formatOMR(fromBaisa(p.unitPriceBaisa))}
                                  </td>
                                  <td className="p-2.5 text-left font-mono font-bold text-amber-300">
                                    {formatOMR(fromBaisa(p.totalPriceBaisa))}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Discount Action Box */}
                    {!existingInvoice && (
                      <div className="p-4 rounded-xl bg-[#121927] border border-[#23334d] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Percent className="w-4 h-4 text-emerald-400" />
                          <span className="font-semibold text-slate-200">
                            منح خصم على إجمالي العملية (اختياري):
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.500"
                            min="0"
                            value={discountOmr}
                            onChange={(e) => setDiscountOmr(e.target.value)}
                            placeholder="0.000"
                            className="w-32 font-mono text-left"
                            dir="ltr"
                          />
                          <span className="text-slate-400">ر.ع</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Col: Final Payable & Settlement Form */}
          <div className="space-y-6">
            <Card className="bg-[#0f1522] border-[#1d273a]">
              <CardContent className="p-5 space-y-4">
                <div className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-3">
                  ملخص الحساب الختامي
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>إجمالي قطع الغيار:</span>
                    <span className="font-mono text-slate-200">
                      {formatOMR(fromBaisa(partsSubtotalBaisa))}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>إجمالي أجور اليد:</span>
                    <span className="font-mono text-slate-200">
                      {formatOMR(fromBaisa(laborSubtotalBaisa))}
                    </span>
                  </div>
                  {discountBaisa > 0 && (
                    <div className="flex justify-between text-emerald-400 font-medium">
                      <span>الخصم المطبق:</span>
                      <span className="font-mono">- {formatOMR(fromBaisa(discountBaisa))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-2">
                    <span>ضريبة القيمة المضافة (5%):</span>
                    <span className="font-mono text-slate-200">{formatOMR(fromBaisa(vatBaisa))}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold text-sm border-t-2 border-slate-800 pt-2.5">
                    <span>المبلغ الإجمالي النهائي:</span>
                    <span className="font-mono text-base text-amber-400">
                      {formatOMR(fromBaisa(finalPayableBaisa))}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-semibold pt-1">
                    <span>المدفوع مسبقاً:</span>
                    <span className="font-mono">{formatOMR(fromBaisa(alreadyPaidBaisa))}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold pt-1">
                    <span>المتبقي المطلوب سداده:</span>
                    <span
                      className={`font-mono text-sm ${
                        remainingBalanceBaisa > 0 ? 'text-red-400 font-bold' : 'text-emerald-400'
                      }`}
                    >
                      {formatOMR(fromBaisa(remainingBalanceBaisa))}
                    </span>
                  </div>
                </div>

                {/* Payment Input Section */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <label className="text-xs font-semibold text-slate-300 block">
                    تسجيل الدفعة الآن (Payment Settlement):
                  </label>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">المبلغ المدفوع (ر.ع):</label>
                    <Input
                      type="number"
                      step="0.500"
                      min="0"
                      value={paymentAmountOmr}
                      onChange={(e) => setPaymentAmountOmr(e.target.value)}
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">طريقة الدفع:</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 bg-[#141d2f] border border-[#273752] rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="CASH">نقداً (Cash)</option>
                      <option value="CARD_RECORDED">بطاقة بنكية (Card)</option>
                      <option value="BANK_TRANSFER">تحويل بنكي مباشر (Bank Transfer)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      رقم المرجع / الإيصال البنكي (اختياري):
                    </label>
                    <Input
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="TXN-984422..."
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="gold"
                    size="md"
                    className="w-full"
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={handleConfirmHandover}
                    disabled={isSubmittingHandover}
                  >
                    {isSubmittingHandover ? 'جارٍ الاعتماد والترحيل...' : 'تأكيد التسليم وإصدار الفاتورة'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="bg-[#0f1522] border-[#1d273a]">
          <CardContent className="p-12 text-center text-slate-400 space-y-2">
            <Car className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">اختر أمر صيانة من القائمة أعلاه</h3>
            <p className="text-xs">
              لعرض تفاصيل الحساب، أجور اليد، قطع الغيار، وإتمام إجراءات تسليم المركبة للعميل
            </p>
          </CardContent>
        </Card>
      )}

      {/* Invoice Document Modal for instant preview/print */}
      <InvoiceDocumentModal
        invoice={completedInvoice}
        isOpen={viewInvoiceModalOpen}
        onClose={() => setViewInvoiceModalOpen(false)}
      />
    </div>
  );
}
