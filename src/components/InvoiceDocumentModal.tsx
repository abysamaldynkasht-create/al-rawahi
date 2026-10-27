/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Official A4 Invoice Document Modal with Watermark & Print/PDF Engine
 */

import React, { useState } from 'react';
import {
  Printer,
  Download,
  X,
  CheckCircle2,
  Clock,
  Car,
  User,
  Phone,
  Calendar,
  FileText,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { Button } from './ui/Button.tsx';
import { Badge } from './ui/Badge.tsx';
import { garageApi } from '../services/garageClient.ts';
import type { InvoiceDTO } from '../types/ipc.ts';
import { formatOMR, fromBaisa } from '../core/currency.ts';
import { useToast } from './ui/Toast.tsx';

interface InvoiceDocumentModalProps {
  invoice: InvoiceDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentRecorded?: () => void;
}

export function InvoiceDocumentModal({ invoice, isOpen, onClose }: InvoiceDocumentModalProps) {
  const { showToast } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !invoice) return null;

  const isPaid = invoice.status === 'PAID' || invoice.balanceDueBaisa <= 0;
  const items = invoice.items || [];
  const partItems = items.filter((it) => it.itemType === 'PART');
  const laborItems = items.filter((it) => it.itemType === 'LABOR');

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const res = await garageApi.printInvoice(invoice.id, invoice.invoiceLanguage || 'ar');
      if (res.success) {
        showToast('تم إرسال أمر الطباعة بنجاح', 'success');
        // Trigger native window print for complete preview
        window.print();
      } else {
        showToast(res.error || 'تعذر الطباعة على الطابعة المحددة', 'error');
      }
    } catch {
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const res = await garageApi.exportInvoicePdf(invoice.id, invoice.invoiceLanguage || 'ar');
      if (res.success && res.data) {
        showToast(`تم تصدير ملف PDF بنجاح: ${res.data.filePath}`, 'success');
      } else {
        showToast(res.error || 'فشل تصدير الفاتورة كملف PDF', 'error');
      }
    } catch {
      showToast('تعذر تصدير الفاتورة كملف PDF', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-[#0f1624] border border-[#23324d] rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[95vh]">
        {/* Top Control Bar (Non-printable) */}
        <div className="print:hidden h-14 bg-[#0a0f18] border-b border-[#1c273a] px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-amber-400 text-sm">
              {invoice.invoiceNumber}
            </span>
            <Badge variant={isPaid ? 'emerald' : 'amber'}>
              {isPaid ? 'مدفوعة بالكامل' : 'بانتظار السداد'}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="gold"
              size="sm"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={handlePrint}
              disabled={isPrinting}
            >
              {isPrinting ? 'جارٍ الطباعة...' : 'طباعة الفاتورة'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleExportPdf}
              disabled={isExporting}
            >
              {isExporting ? 'جارٍ التصدير...' : 'تصدير PDF'}
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mr-2"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#ffffff] text-slate-900 relative print:p-0 print:overflow-visible">
          {/* Subtle Watermark (High transparency: 6%, centered, pointer-events-none) */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
            aria-hidden="true"
          >
            <img
              src="/garage_logo.jpg"
              alt="Watermark"
              className="w-[480px] h-[480px] object-contain opacity-[0.06] grayscale contrast-125"
            />
          </div>

          <div className="relative z-10 space-y-6">
            {/* Header: Garage Logo & Details */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
              <div className="flex items-center gap-4">
                <img
                  src="/garage_logo.jpg"
                  alt="كراج الرواحي"
                  className="w-20 h-20 object-contain rounded-xl border border-slate-200 shadow-sm"
                />
                <div>
                  <h1 className="text-xl font-black text-slate-950 tracking-tight">
                    كراج الرواحي للعناية بالسيارات
                  </h1>
                  <p className="text-xs text-slate-600 font-bold mt-0.5">
                    AL RAWAHI AUTO CARE GARAGE
                  </p>
                  <div className="text-[11px] text-slate-600 mt-1 space-y-0.5 font-medium">
                    <p>مسقط، سلطنة عُمان • هاتف: 91234567 • س.ت: 1092834</p>
                    <p className="font-mono text-[10px] text-slate-700">الرقم الضريبي (VAT IN): OM1100234567</p>
                  </div>
                </div>
              </div>

              {/* Invoice Meta Block */}
              <div className="text-left bg-slate-50 border border-slate-200 p-3 rounded-xl min-w-[200px]">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  فاتورة ضريبية رسمية
                </div>
                <div className="text-base font-black text-slate-900 font-mono mt-0.5" dir="ltr">
                  {invoice.invoiceNumber}
                </div>
                <div className="text-[11px] text-slate-600 mt-2 space-y-0.5">
                  <div className="flex justify-between gap-4">
                    <span>التاريخ:</span>
                    <span className="font-semibold text-slate-900">{invoice.invoiceDate}</span>
                  </div>
                  {invoice.repairOrderId && (
                    <div className="flex justify-between gap-4">
                      <span>أمر الصيانة:</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {invoice.repairOrderId.slice(0, 8)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span>الحالة:</span>
                    <span className={`font-bold ${isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {isPaid ? 'مدفوعة' : 'مستحقة'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer & Vehicle Info Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-700" />
                  <span>بيانات العميل (Customer):</span>
                </div>
                <div className="font-bold text-sm text-slate-950">
                  {invoice.customerName || 'عميل نقدي'}
                </div>
                {invoice.customerPhone && (
                  <div className="text-slate-600 font-mono flex items-center gap-1" dir="ltr">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{invoice.customerPhone}</span>
                  </div>
                )}
                <div className="text-[11px] text-slate-500">
                  نوع العميل: {invoice.isCustomerPermanent ? 'عميل دائم مسجل' : 'عميل زيارة فردية'}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-slate-700" />
                  <span>بيانات المركبة (Vehicle):</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono font-bold text-xs tracking-wider">
                    {invoice.vehiclePlate || '—'}
                  </span>
                </div>
                {invoice.notes && (
                  <div className="text-[11px] text-slate-600 mt-1">
                    ملاحظات: {invoice.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">النوع</th>
                    <th className="py-2.5 px-3">البيان / الخدمة / القطعة</th>
                    <th className="py-2.5 px-3 text-center">الكمية</th>
                    <th className="py-2.5 px-3 text-left">سعر الوحدة (ر.ع)</th>
                    <th className="py-2.5 px-3 text-left">الإجمالي (ر.ع)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    // Default fallback display from totals if detailed rows not stored
                    <>
                      {invoice.subtotalLaborBaisa > 0 && (
                        <tr>
                          <td className="py-2.5 px-3 text-center text-slate-400">1</td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                              أجور يد
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            أعمال وخدمات صيانة ميكانيكية وكهربائية معتمدة
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">1</td>
                          <td className="py-2.5 px-3 text-left font-mono">
                            {formatOMR(fromBaisa(invoice.subtotalLaborBaisa))}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900">
                            {formatOMR(fromBaisa(invoice.subtotalLaborBaisa))}
                          </td>
                        </tr>
                      )}
                      {invoice.subtotalPartsBaisa > 0 && (
                        <tr>
                          <td className="py-2.5 px-3 text-center text-slate-400">2</td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold">
                              قطع غيار
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            قطع غيار وزيوت مستهلكة في أمر الصيانة
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">1</td>
                          <td className="py-2.5 px-3 text-left font-mono">
                            {formatOMR(fromBaisa(invoice.subtotalPartsBaisa))}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900">
                            {formatOMR(fromBaisa(invoice.subtotalPartsBaisa))}
                          </td>
                        </tr>
                      )}
                    </>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              it.itemType === 'LABOR'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {it.itemType === 'LABOR' ? 'أجور يد' : 'قطع غيار'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {it.description}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">{it.quantity}</td>
                        <td className="py-2.5 px-3 text-left font-mono">
                          {formatOMR(fromBaisa(it.unitPriceBaisa))}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900">
                          {formatOMR(fromBaisa(it.lineTotalBaisa))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Calculation Table */}
            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-80 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>إجمالي قطع الغيار:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatOMR(fromBaisa(invoice.subtotalPartsBaisa))}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>إجمالي أجور اليد والخدمات:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatOMR(fromBaisa(invoice.subtotalLaborBaisa))}
                  </span>
                </div>
                {invoice.discountBaisa > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>الخصم الممنوح:</span>
                    <span className="font-mono font-bold">
                      - {formatOMR(fromBaisa(invoice.discountBaisa))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1.5">
                  <span>ضريبة القيمة المضافة ({invoice.taxRatePercent}% VAT):</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatOMR(fromBaisa(invoice.taxAmountBaisa))}
                  </span>
                </div>
                <div className="flex justify-between text-slate-950 font-black text-sm border-t-2 border-slate-900 pt-2">
                  <span>المبلغ الإجمالي المستحق:</span>
                  <span className="font-mono text-base text-amber-700">
                    {formatOMR(fromBaisa(invoice.grandTotalBaisa))}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold pt-1 border-t border-slate-200">
                  <span>المدفوع:</span>
                  <span className="font-mono">
                    {formatOMR(fromBaisa(invoice.paidAmountBaisa))}
                  </span>
                </div>
                <div className="flex justify-between text-slate-950 font-bold">
                  <span>المتبقي:</span>
                  <span
                    className={`font-mono text-sm ${
                      invoice.balanceDueBaisa > 0 ? 'text-red-700 font-black' : 'text-emerald-700'
                    }`}
                  >
                    {formatOMR(fromBaisa(invoice.balanceDueBaisa))}
                  </span>
                </div>
              </div>
            </div>

            {/* Terms & Footer Signature */}
            <div className="border-t border-slate-200 pt-4 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-700">شكرًا لاختياركم كراج الرواحي للعناية بالسيارات.</p>
                <p>الضمان يسري وفق الشروط المدونة في أمر الإصلاح. لا تُقبل أي مطالبات بدون إبراز أصل الفاتورة.</p>
              </div>
              <div className="text-center sm:text-left">
                <div className="w-36 h-12 border-b border-dashed border-slate-400 mb-1" />
                <span className="text-[10px] text-slate-400">توقيع المستلم / المحاسب</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
