/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Official Quotation & Invoice Document Engine
 * - Clean RTL Column Alignment with exact 3-decimal OMR formatting (e.g. 10.500 ر.ع)
 * - Full Interactive Editing: Edit descriptions, quantities, unit prices, discounts, VAT, notes
 * - Instant Live Recalculations: Line Total = Qty × Unit Price, Subtotals, VAT 5%, Grand Total
 * - Document Mode Toggle: Official Quotation (عرض سعر) vs Tax Invoice (فاتورة ضريبية)
 * - Revision Protection for Approved Documents
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  Download,
  X,
  Car,
  User,
  Phone,
  Pencil,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  FileText,
  RotateCcw,
  Package,
  Wrench,
  HelpCircle,
} from 'lucide-react';
import { Button } from './ui/Button.tsx';
import { Badge } from './ui/Badge.tsx';
import { Input } from './ui/Input.tsx';
import { garageApi } from '../services/garageClient.ts';
import type { InvoiceDTO, InvoiceItemDTO, InventoryItemDTO } from '../types/ipc.ts';
import { toBaisa, fromBaisa } from '../core/currency.ts';
import { useToast } from './ui/Toast.tsx';

interface EditableRow {
  id: string;
  itemType: 'PART' | 'LABOR';
  sourceId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceOmr: string;
}

interface InvoiceDocumentModalProps {
  invoice: InvoiceDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentRecorded?: () => void;
  onInvoiceUpdated?: (updated: InvoiceDTO) => void;
  initialEditMode?: boolean;
}

export function InvoiceDocumentModal({
  invoice,
  isOpen,
  onClose,
  onPaymentRecorded,
  onInvoiceUpdated,
  initialEditMode = false,
}: InvoiceDocumentModalProps) {
  const { showToast } = useToast();
  const [currentInvoice, setCurrentInvoice] = useState<InvoiceDTO | null>(invoice);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [docViewMode, setDocViewMode] = useState<'AUTO' | 'QUOTATION' | 'INVOICE'>('AUTO');
  const [confirmRevision, setConfirmRevision] = useState(false);

  // Editable Form State
  const [editItems, setEditItems] = useState<EditableRow[]>([]);
  const [editDiscountOmr, setEditDiscountOmr] = useState('0.000');
  const [editTaxRatePercent, setEditTaxRatePercent] = useState<number>(5.0);
  const [editStatus, setEditStatus] = useState<'DRAFT' | 'ISSUED'>('ISSUED');
  const [editNotes, setEditNotes] = useState('');
  const [inventoryList, setInventoryList] = useState<InventoryItemDTO[]>([]);

  // Synchronize when invoice prop changes or modal opens
  useEffect(() => {
    if (invoice) {
      setCurrentInvoice(invoice);
      setIsEditing(initialEditMode);
      setEditDiscountOmr(fromBaisa(invoice.discountBaisa || 0).toFixed(3));
      setEditTaxRatePercent(invoice.taxRatePercent ?? 5.0);
      setEditStatus(invoice.status === 'DRAFT' ? 'DRAFT' : 'ISSUED');
      setEditNotes(invoice.notes || '');

      const initialRows: EditableRow[] = (invoice.items || []).map((it, idx) => ({
        id: it.id || `row-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        itemType: it.itemType,
        sourceId: it.sourceId,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit || (it.itemType === 'LABOR' ? 'خدمة' : 'قطعة'),
        unitPriceOmr: fromBaisa(it.unitPriceBaisa).toFixed(3),
      }));

      setEditItems(initialRows);
    }
  }, [invoice, initialEditMode, isOpen]);

  // Load inventory catalog when entering edit mode
  useEffect(() => {
    if (isOpen) {
      garageApi.getInventory().then((res) => {
        if (res.success && res.data) {
          setInventoryList(res.data.filter((i) => i.isActive));
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  const liveTotals = useMemo(() => {
    let subtotalPartsOmr = 0;
    let subtotalLaborOmr = 0;

    const rowDetails = editItems.map((item) => {
      const price = parseFloat(item.unitPriceOmr) || 0;
      const qty = item.quantity || 1;
      const lineTotal = price * qty;
      if (item.itemType === 'PART') {
        subtotalPartsOmr += lineTotal;
      } else {
        subtotalLaborOmr += lineTotal;
      }
      return { ...item, lineTotal };
    });

    const discountOmr = Math.max(0, parseFloat(editDiscountOmr) || 0);
    const subtotalCombined = subtotalPartsOmr + subtotalLaborOmr;
    const preTaxOmr = Math.max(0, subtotalCombined - discountOmr);
    const taxAmountOmr = (preTaxOmr * editTaxRatePercent) / 100;
    const grandTotalOmr = preTaxOmr + taxAmountOmr;

    return {
      rowDetails,
      subtotalPartsOmr,
      subtotalLaborOmr,
      subtotalCombined,
      discountOmr,
      preTaxOmr,
      taxAmountOmr,
      grandTotalOmr,
    };
  }, [editItems, editDiscountOmr, editTaxRatePercent]);

  // Early return after all hooks are defined
  if (!isOpen || !currentInvoice) return null;

  const isQuotation = docViewMode === 'QUOTATION' || (docViewMode === 'AUTO' && currentInvoice.status === 'DRAFT');
  const isPaid = currentInvoice.status === 'PAID' || currentInvoice.balanceDueBaisa <= 0;
  const isApprovedOrPaid = currentInvoice.status === 'PAID' || currentInvoice.paidAmountBaisa > 0;

  // Handle direct print
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const res = await garageApi.printInvoice(currentInvoice.id, currentInvoice.invoiceLanguage || 'ar');
      if (res.success) {
        showToast(isQuotation ? 'تم إرسال عرض السعر إلى الطابعة بنجاح' : 'تم إرسال الفاتورة إلى الطابعة بنجاح', 'success');
        if (onPaymentRecorded) onPaymentRecorded();
      } else {
        showToast(res.error || 'تعذر الطباعة على الطابعة المحددة', 'error');
      }
    } catch {
      showToast('خطأ أثناء التواصل مع محرك الطباعة', 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  // Handle PDF export
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const res = await garageApi.exportInvoicePdf(currentInvoice.id, currentInvoice.invoiceLanguage || 'ar');
      if (res.success && res.data) {
        showToast(`تم تصدير ملف PDF بنجاح: ${res.data.filePath}`, 'success');
      } else {
        showToast(res.error || 'فشل تصدير المستند كملف PDF', 'error');
      }
    } catch {
      showToast('تعذر تصدير المستند كملف PDF', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Save edits
  const handleSaveEdits = async () => {
    if (editItems.length === 0) {
      showToast('يجب أن يحتوي المستند على بند واحد على الأقل', 'error');
      return;
    }

    if (isApprovedOrPaid && !confirmRevision) {
      setConfirmRevision(true);
      return;
    }

    setIsSaving(true);
    try {
      const payloadItems = editItems.map((it) => {
        const unitPriceBaisa = toBaisa(parseFloat(it.unitPriceOmr) || 0);
        const qty = it.quantity || 1;
        const lineTotalBaisa = Math.round(unitPriceBaisa * qty);
        return {
          itemType: it.itemType,
          sourceId: it.sourceId,
          description: it.description.trim() || (it.itemType === 'LABOR' ? 'أجور يد' : 'قطعة غيار'),
          quantity: qty,
          unit: it.unit.trim() || (it.itemType === 'LABOR' ? 'خدمة' : 'قطعة'),
          unitPriceBaisa,
          lineTotalBaisa,
        };
      });

      const res = await garageApi.updateInvoice(currentInvoice.id, {
        status: editStatus,
        discountBaisa: toBaisa(parseFloat(editDiscountOmr) || 0),
        taxRatePercent: editTaxRatePercent,
        notes: editNotes.trim(),
        items: payloadItems,
      });

      if (res.success && res.data) {
        setCurrentInvoice(res.data);
        setIsEditing(false);
        setConfirmRevision(false);
        showToast(
          res.data.status === 'DRAFT'
            ? 'تم حفظ وتحديث عرض السعر وإعادة احتساب المجاميع بنجاح'
            : 'تم حفظ وتحديث الفاتورة وإعادة احتساب المجاميع بنجاح',
          'success'
        );
        if (onInvoiceUpdated) onInvoiceUpdated(res.data);
        if (onPaymentRecorded) onPaymentRecorded();
      } else {
        showToast(res.error || 'فشل تحديث المستند', 'error');
      }
    } catch {
      showToast('خطأ أثناء حفظ التعديلات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdits = () => {
    // Revert form state back to currentInvoice
    setEditDiscountOmr(fromBaisa(currentInvoice.discountBaisa || 0).toFixed(3));
    setEditTaxRatePercent(currentInvoice.taxRatePercent ?? 5.0);
    setEditStatus(currentInvoice.status === 'DRAFT' ? 'DRAFT' : 'ISSUED');
    setEditNotes(currentInvoice.notes || '');
    const rows: EditableRow[] = (currentInvoice.items || []).map((it, idx) => ({
      id: it.id || `row-${idx}`,
      itemType: it.itemType,
      sourceId: it.sourceId,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit || (it.itemType === 'LABOR' ? 'خدمة' : 'قطعة'),
      unitPriceOmr: fromBaisa(it.unitPriceBaisa).toFixed(3),
    }));
    setEditItems(rows);
    setIsEditing(false);
    setConfirmRevision(false);
  };

  const formatOmrTag = (amount: number) => (
    <span className="inline-flex items-baseline gap-1 font-mono font-bold" dir="ltr">
      <span>{amount.toFixed(3)}</span>
      <span className="font-sans text-[11px] font-normal text-slate-600">ر.ع</span>
    </span>
  );

  const formatBaisaTag = (baisa: number) => formatOmrTag(fromBaisa(baisa));

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-[#0f1624] border border-[#23324d] rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[96vh]">
        {/* Top Control Bar (Non-printable) */}
        <div className="print:hidden h-14 bg-[#0a0f18] border-b border-[#1c273a] px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-amber-400 text-sm">
              {currentInvoice.invoiceNumber}
            </span>
            <Badge variant={isQuotation ? 'amber' : isPaid ? 'emerald' : 'sky'}>
              {isQuotation ? 'عرض سعر (Quotation)' : isPaid ? 'فاتورة مدفوعة' : 'فاتورة معتمدة'}
            </Badge>
            {isEditing && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold animate-pulse">
                وضع التحرير النشط
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                {/* View Mode Toggle: Quotation vs Invoice */}
                <div className="hidden sm:flex items-center bg-[#141d2f] border border-[#23324d] rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setDocViewMode('QUOTATION')}
                    className={`px-2.5 py-1 rounded transition-colors text-[11px] font-semibold ${
                      isQuotation ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    عرض سعر
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocViewMode('INVOICE')}
                    className={`px-2.5 py-1 rounded transition-colors text-[11px] font-semibold ${
                      !isQuotation ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    فاتورة رسمية
                  </button>
                </div>

                {/* Edit Button */}
                <Button
                  variant="gold"
                  size="sm"
                  icon={<Pencil className="w-3.5 h-3.5" />}
                  onClick={() => setIsEditing(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
                >
                  تعديل عرض السعر
                </Button>

                {/* Direct Print */}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Printer className="w-3.5 h-3.5" />}
                  onClick={handlePrint}
                  disabled={isPrinting}
                >
                  {isPrinting ? 'جارٍ الطباعة...' : 'طباعة مباشرة'}
                </Button>

                {/* Export PDF */}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={handleExportPdf}
                  disabled={isExporting}
                >
                  {isExporting ? 'جارٍ التصدير...' : 'تصدير PDF'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<X className="w-3.5 h-3.5" />}
                  onClick={handleCancelEdits}
                  disabled={isSaving}
                >
                  إلغاء التعديل
                </Button>
                <Button
                  variant="gold"
                  size="sm"
                  icon={<Save className="w-3.5 h-3.5" />}
                  onClick={handleSaveEdits}
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {isSaving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                </Button>
              </>
            )}

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

        {/* Warning Banner if editing an approved/paid invoice */}
        {isEditing && isApprovedOrPaid && (
          <div className="bg-amber-950/60 border-b border-amber-600/40 px-4 py-2 text-xs text-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>تنبيه:</strong> هذا المستند مدفوع أو معتمد مسبقاً. تعديل الأسعار أو البنود سيحدث مبالغ المطالبة وسينشئ مراجعة جديدة.
              </span>
            </div>
            {confirmRevision && (
              <span className="text-amber-300 font-bold underline">
                اضغط «حفظ التعديلات» مرة أخرى للتأكيد النهائي.
              </span>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* BODY: VIEW MODE OR EDIT MODE */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#ffffff] text-slate-900 relative print:p-0 print:overflow-visible">
          {/* Subtle Watermark */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
            aria-hidden="true"
          >
            <div className="text-center opacity-[0.05] select-none">
              <img
                src="/garage_logo.jpg"
                alt="Watermark"
                className="w-[420px] h-[420px] object-contain mx-auto grayscale contrast-125 mb-4"
              />
              <div className="text-6xl font-black tracking-widest text-slate-900 uppercase">
                {isQuotation ? 'عرض سعر' : 'الرواحي'}
              </div>
            </div>
          </div>

          <div className="relative z-10 space-y-6">
            {/* Header: Garage Logo & Details */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
              <div className="flex items-center gap-4">
                <img
                  src="/garage_logo.jpg"
                  alt="الرواحي للعناية بالسيارات"
                  className="w-20 h-20 object-contain rounded-xl border border-slate-200 shadow-sm"
                />
                <div>
                  <h1 className="text-xl font-black text-slate-950 tracking-tight">
                    الرواحي للعناية بالسيارات
                  </h1>
                  <p className="text-xs text-slate-600 font-bold mt-0.5">
                    AL RAWAHI AUTO CARE
                  </p>
                  <div className="text-[11px] text-slate-600 mt-1 space-y-0.5 font-medium">
                    <p>مسقط، سلطنة عُمان • هاتف: 91234567 • س.ت: 1092834</p>
                    <p className="font-mono text-[10px] text-slate-700">الرقم الضريبي (VAT IN): OM1100234567</p>
                  </div>
                </div>
              </div>

              {/* Meta Block */}
              <div className="text-left bg-slate-50 border border-slate-200 p-3 rounded-xl min-w-[220px]">
                <div className={`text-xs font-black uppercase tracking-wider ${isQuotation ? 'text-amber-700' : 'text-slate-700'}`}>
                  {isQuotation ? 'عرض سعر رسمي (QUOTATION)' : 'فاتورة ضريبية رسمية (TAX INVOICE)'}
                </div>
                <div className="text-base font-black text-slate-900 font-mono mt-0.5" dir="ltr">
                  {currentInvoice.invoiceNumber}
                </div>
                <div className="text-[11px] text-slate-600 mt-2 space-y-0.5">
                  <div className="flex justify-between gap-4">
                    <span>التاريخ:</span>
                    <span className="font-semibold text-slate-900 font-mono">{currentInvoice.invoiceDate}</span>
                  </div>
                  {currentInvoice.repairOrderId && (
                    <div className="flex justify-between gap-4">
                      <span>أمر الصيانة:</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {currentInvoice.repairOrderId.slice(0, 10)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span>الحالة:</span>
                    <span className={`font-bold ${isQuotation ? 'text-amber-700' : isPaid ? 'text-emerald-700' : 'text-blue-700'}`}>
                      {isQuotation ? 'عرض سعر مسودة' : isPaid ? 'مدفوعة بالكامل' : 'مستحقة السداد'}
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
                  <span>بيانات العميل (Customer Details):</span>
                </div>
                <div className="font-bold text-sm text-slate-950">
                  {currentInvoice.customerName || 'عميل نقدي'}
                </div>
                {currentInvoice.customerPhone && (
                  <div className="text-slate-600 font-mono flex items-center gap-1" dir="ltr">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{currentInvoice.customerPhone}</span>
                  </div>
                )}
                <div className="text-[11px] text-slate-500">
                  نوع العميل: {currentInvoice.isCustomerPermanent ? 'عميل دائم مسجل' : 'عميل زيارة فردية / مؤقت'}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-slate-700" />
                  <span>بيانات المركبة (Vehicle Details):</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono font-bold text-xs tracking-wider">
                    {currentInvoice.vehiclePlate || '—'}
                  </span>
                  {(currentInvoice.vehicleMake || currentInvoice.vehicleModel) && (
                    <span className="text-xs text-slate-800 font-semibold">
                      {[currentInvoice.vehicleMake, currentInvoice.vehicleModel, currentInvoice.vehicleYear].filter(Boolean).join(' ')}
                    </span>
                  )}
                </div>
                {currentInvoice.vehicleVin && (
                  <div className="text-[11px] text-slate-700 flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                    <span className="font-bold text-slate-600">رقم الشاصي (VIN):</span>
                    <span className="font-mono font-bold text-slate-950 tracking-wider" dir="ltr">{currentInvoice.vehicleVin}</span>
                  </div>
                )}
                {currentInvoice.notes && !isEditing && (
                  <div className="text-[11px] text-slate-600 mt-1">
                    ملاحظات: {currentInvoice.notes}
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* VIEW MODE: ITEM TABLE WITH PERFECT ALIGNMENT & 3 DECIMALS */}
            {/* ========================================================================= */}
            {!isEditing ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-right text-xs table-fixed border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b-2 border-slate-300">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 w-20 text-center">النوع</th>
                      <th className="py-2.5 px-3 text-start">البيان / الخدمة / الصنف</th>
                      <th className="py-2.5 px-3 w-24 text-center">الكمية</th>
                      <th className="py-2.5 px-3 w-32 text-end">سعر الوحدة</th>
                      <th className="py-2.5 px-3 w-32 text-end">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(currentInvoice.items || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500 text-sm">لا توجد بنود مسجلة في هذه الفاتورة</td>
                      </tr>
                    ) : (
                      currentInvoice.items!.map((it, idx) => (
                        <tr key={it.id || idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                it.itemType === 'LABOR'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {it.itemType === 'LABOR' ? 'أجور' : 'قطع'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 text-start">
                            {it.description}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                            {it.quantity} {it.unit || ''}
                          </td>
                          <td className="py-2.5 px-3 text-end font-mono">
                            {formatBaisaTag(it.unitPriceBaisa)}
                          </td>
                          <td className="py-2.5 px-3 text-end font-mono font-bold text-slate-900">
                            {formatBaisaTag(it.lineTotalBaisa)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ========================================================================= */
              /* EDIT MODE: INTERACTIVE EDITABLE TABLE & TOOLBAR */
              /* ========================================================================= */
              <div className="space-y-3 border-2 border-amber-400/80 rounded-xl p-4 bg-slate-50/90 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Pencil className="w-4 h-4 text-amber-600" />
                      تحرير بنود عرض السعر والأسعار والكميات
                    </span>
                    <span className="text-[11px] text-slate-500">
                      (يتم احتساب المجاميع والضريبة فورياً)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Add from inventory dropdown */}
                    <select
                      onChange={(e) => {
                        const selectedPart = inventoryList.find((p) => p.id === e.target.value);
                        if (selectedPart) {
                          setEditItems((prev) => [
                            ...prev,
                            {
                              id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                              itemType: 'PART',
                              sourceId: selectedPart.id,
                              description: selectedPart.name,
                              quantity: 1,
                              unit: selectedPart.unit || 'قطعة',
                              unitPriceOmr: fromBaisa(selectedPart.sellingPriceBaisa).toFixed(3),
                            },
                          ]);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                      className="bg-amber-100 border border-amber-300 text-amber-900 font-bold rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-sm"
                    >
                      <option value="" disabled>+ إدراج قطعة من المخزون</option>
                      {inventoryList.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({fromBaisa(item.sellingPriceBaisa).toFixed(3)} ر.ع / {item.unit || 'قطعة'})
                        </option>
                      ))}
                    </select>

                    {/* Add Labor Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditItems((prev) => [
                          ...prev,
                          {
                            id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                            itemType: 'LABOR',
                            description: 'أجور يد وفحص فني',
                            quantity: 1,
                            unit: 'خدمة',
                            unitPriceOmr: '5.000',
                          },
                        ]);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold border border-blue-300 text-xs flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ إضافة خدمة / يد</span>
                    </button>

                    {/* Add Custom Row Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditItems((prev) => [
                          ...prev,
                          {
                            id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                            itemType: 'PART',
                            description: 'بند جديد مخصص',
                            quantity: 1,
                            unit: 'قطعة',
                            unitPriceOmr: '0.000',
                          },
                        ]);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ بند مخصص</span>
                    </button>
                  </div>
                </div>

                {/* Editable Table Header & Rows */}
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                  <div className="grid grid-cols-12 gap-2 bg-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 items-center">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-2 text-center">النوع</div>
                    <div className="col-span-4 text-start">البيان / الخدمة / الصنف</div>
                    <div className="col-span-1 text-center">الكمية</div>
                    <div className="col-span-1 text-center">الوحدة</div>
                    <div className="col-span-2 text-end">سعر الوحدة (ر.ع)</div>
                    <div className="col-span-1 text-center">حذف</div>
                  </div>

                  <div className="divide-y divide-slate-200 max-h-72 overflow-y-auto">
                    {editItems.map((item, idx) => {
                      const lineTotal = (parseFloat(item.unitPriceOmr) || 0) * (item.quantity || 1);
                      return (
                        <div
                          key={item.id}
                          className="grid grid-cols-12 gap-2 px-3 py-2 text-xs items-center hover:bg-amber-50/40"
                        >
                          <div className="col-span-1 text-center font-mono text-slate-500 font-bold">
                            {idx + 1}
                          </div>

                          <div className="col-span-2 text-center">
                            <select
                              value={item.itemType}
                              onChange={(e) => {
                                const val = e.target.value as 'PART' | 'LABOR';
                                setEditItems((prev) =>
                                  prev.map((r) =>
                                    r.id === item.id
                                      ? {
                                          ...r,
                                          itemType: val,
                                          unit: val === 'LABOR' ? 'خدمة' : 'قطعة',
                                        }
                                      : r
                                  )
                                );
                              }}
                              className={`w-full text-[11px] font-bold py-1 px-1.5 rounded border focus:outline-none ${
                                item.itemType === 'LABOR'
                                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}
                            >
                              <option value="LABOR">أجور يد / خدمة</option>
                              <option value="PART">قطع غيار / مادة</option>
                            </select>
                          </div>

                          <div className="col-span-4">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditItems((prev) =>
                                  prev.map((r) => (r.id === item.id ? { ...r, description: val } : r))
                                );
                              }}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                              placeholder="بيان الخدمة أو القطعة"
                            />
                          </div>

                          <div className="col-span-1">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const q = Math.max(1, parseInt(e.target.value) || 1);
                                setEditItems((prev) =>
                                  prev.map((r) => (r.id === item.id ? { ...r, quantity: q } : r))
                                );
                              }}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-center font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              dir="ltr"
                            />
                          </div>

                          <div className="col-span-1">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => {
                                const u = e.target.value;
                                setEditItems((prev) =>
                                  prev.map((r) => (r.id === item.id ? { ...r, unit: u } : r))
                                );
                              }}
                              className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              placeholder="الوحدة"
                            />
                          </div>

                          <div className="col-span-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="0.100"
                                value={item.unitPriceOmr}
                                onChange={(e) => {
                                  const p = e.target.value;
                                  setEditItems((prev) =>
                                    prev.map((r) => (r.id === item.id ? { ...r, unitPriceOmr: p } : r))
                                  );
                                }}
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 text-end focus:outline-none focus:ring-1 focus:ring-amber-500"
                                dir="ltr"
                              />
                              <span className="text-[10px] text-slate-500 font-bold shrink-0">ر.ع</span>
                            </div>
                            <div className="text-[10px] text-slate-500 text-end mt-0.5">
                              المجموع: <strong className="font-mono text-slate-900" dir="ltr">{lineTotal.toFixed(3)}</strong> ر.ع
                            </div>
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setEditItems((prev) => prev.filter((r) => r.id !== item.id));
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                              title="حذف هذا البند"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Edit Form Controls: Discount, VAT, Status, Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      الخصم التجاري الممنوح (ر.ع):
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.500"
                        value={editDiscountOmr}
                        onChange={(e) => setEditDiscountOmr(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        dir="ltr"
                      />
                      <span className="text-xs text-slate-600 font-bold">ر.ع</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      نسبة ضريبة القيمة المضافة (VAT):
                    </label>
                    <select
                      value={editTaxRatePercent}
                      onChange={(e) => setEditTaxRatePercent(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value={5.0}>5% ضريبة القيمة المضافة القياسية (عُمان)</option>
                      <option value={0}>0% معفى من الضريبة (Tax Exempt)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      حالة المستند بعد الحفظ:
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as 'DRAFT' | 'ISSUED')}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="DRAFT">عرض سعر مسودة (DRAFT QUOTATION)</option>
                      <option value="ISSUED">فاتورة معتمدة رسمية (ISSUED INVOICE)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    ملاحظات وشروط عرض السعر / الفاتورة:
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="ملاحظات الصيانة والضمان وسريان عرض السعر..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FINANCIAL SUMMARY RECALCULATION TABLE (OMR WITH EXACT 3 DECIMALS) */}
            {/* ========================================================================= */}
            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-96 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs shadow-sm">
                <div className="flex justify-between items-center text-slate-600">
                  <span>إجمالي قطع الغيار والمواد:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {isEditing
                      ? formatOmrTag(liveTotals.subtotalPartsOmr)
                      : formatBaisaTag(currentInvoice.subtotalPartsBaisa)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-600">
                  <span>إجمالي أجور اليد والخدمات:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {isEditing
                      ? formatOmrTag(liveTotals.subtotalLaborOmr)
                      : formatBaisaTag(currentInvoice.subtotalLaborBaisa)}
                  </span>
                </div>

                {(isEditing ? liveTotals.discountOmr > 0 : currentInvoice.discountBaisa > 0) && (
                  <div className="flex justify-between items-center text-emerald-700 font-medium">
                    <span>الخصم التجاري الممنوح:</span>
                    <span className="font-mono font-bold">
                      - {isEditing
                          ? formatOmrTag(liveTotals.discountOmr)
                          : formatBaisaTag(currentInvoice.discountBaisa)}
                    </span>
                  </div>
                )}

                {/* Explicit Pre-tax Amount */}
                <div className="flex justify-between items-center text-slate-900 font-bold border-t border-slate-300 pt-2 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                  <span>السعر قبل الضريبة (المجموع الخالي من الضريبة):</span>
                  <span className="font-mono">
                    {isEditing
                      ? formatOmrTag(liveTotals.preTaxOmr)
                      : formatOmrTag(Math.max(0, fromBaisa(currentInvoice.subtotalPartsBaisa + currentInvoice.subtotalLaborBaisa - currentInvoice.discountBaisa)))}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-600 pt-0.5">
                  <span>
                    ضريبة القيمة المضافة ({isEditing ? editTaxRatePercent : currentInvoice.taxRatePercent}% VAT):
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {isEditing
                      ? formatOmrTag(liveTotals.taxAmountOmr)
                      : formatBaisaTag(currentInvoice.taxAmountBaisa)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-950 font-black text-sm border-t-2 border-slate-900 pt-2.5">
                  <span>
                    {isQuotation ? 'المجموع الإجمالي لعرض السعر:' : 'المجموع الإجمالي شامل الضريبة:'}
                  </span>
                  <span className="font-mono text-base text-amber-700">
                    {isEditing
                      ? formatOmrTag(liveTotals.grandTotalOmr)
                      : formatBaisaTag(currentInvoice.grandTotalBaisa)}
                  </span>
                </div>

                {!isQuotation && !isEditing && (
                  <>
                    <div className="flex justify-between items-center text-emerald-700 font-semibold pt-1 border-t border-slate-200">
                      <span>المدفوع:</span>
                      <span className="font-mono">
                        {formatBaisaTag(currentInvoice.paidAmountBaisa)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-950 font-bold">
                      <span>المتبقي:</span>
                      <span
                        className={`font-mono text-sm ${
                          currentInvoice.balanceDueBaisa > 0 ? 'text-red-700 font-black' : 'text-emerald-700'
                        }`}
                      >
                        {formatBaisaTag(currentInvoice.balanceDueBaisa)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Terms & Footer Signature */}
            <div className="border-t border-slate-200 pt-4 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-700">شكرًا لاختياركم الرواحي للعناية بالسيارات.</p>
                <p>
                  {isQuotation
                    ? 'عرض السعر سارٍ لمدة 15 يوماً من تاريخ إصداره، وتخضع الأسعار لتوافر قطع الغيار في المخزن.'
                    : 'الضمان يسري وفق الشروط المدونة في أمر الإصلاح. لا تُقبل أي مطالبات بدون إبراز أصل الفاتورة.'}
                </p>
              </div>
              <div className="text-center sm:text-left">
                <div className="w-36 h-12 border-b border-dashed border-slate-400 mb-1" />
                <span className="text-[10px] text-slate-400">
                  {isQuotation ? 'توقيع واعتماد العميل' : 'توقيع المستلم / المحاسب'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
