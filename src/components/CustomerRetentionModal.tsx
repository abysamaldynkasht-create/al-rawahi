/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Customer Retention Modal Dialog
 * 
 * Displayed after a visit repair is completed, payment is fully recorded,
 * and invoice printing has succeeded for a walk-in / temporary visit customer.
 */

import React, { useState } from 'react';
import {
  UserCheck,
  UserPlus,
  Clock,
  Car,
  Receipt,
  CheckCircle2,
  ShieldCheck,
  History,
  X,
  Phone,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { Button } from './ui/Button.tsx';
import { useToast } from './ui/Toast.tsx';
import { garageApi } from '../services/garageClient.ts';
import type { CustomerDTO, InvoiceDTO } from '../types/ipc.ts';
import { formatOMR, fromBaisa } from '../core/currency.ts';

export interface CustomerRetentionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerDTO;
  invoice: InvoiceDTO;
  onCustomerRetained?: (promotedCustomer: CustomerDTO) => void;
  onDismissed?: () => void;
}

export function CustomerRetentionModal({
  isOpen,
  onClose,
  customer,
  invoice,
  onCustomerRetained,
  onDismissed,
}: CustomerRetentionModalProps) {
  const { lang, isRtl, t } = useLanguage();
  const isAr = lang === 'ar';
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !customer) return null;

  // Handler: "Yes, save customer"
  const handleSaveCustomer = async () => {
    setIsSubmitting(true);
    try {
      // 1. Atomically promote customer to permanent directory
      const promoteRes = await garageApi.promoteCustomer(customer.id);
      if (!promoteRes.success || !promoteRes.data) {
        showToast(promoteRes.error || 'Failed to save customer', 'error');
        setIsSubmitting(false);
        return;
      }

      // 2. Mark this invoice as retention-prompted so it will never ask again
      await garageApi.markInvoiceRetentionPrompted(invoice.id);

      showToast(t('retentionSuccessPermanent'), 'success');
      if (onCustomerRetained) {
        onCustomerRetained(promoteRes.data);
      }
      onClose();
    } catch {
      showToast('Error promoting customer to permanent directory', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: "Not now"
  const handleNotNow = async () => {
    setIsSubmitting(true);
    try {
      // Mark invoice as prompted so dialog does not appear again for this completed visit
      await garageApi.markInvoiceRetentionPrompted(invoice.id);
      showToast(t('retentionVisitPreserved'), 'info');
      if (onDismissed) {
        onDismissed();
      }
      onClose();
    } catch {
      // Safe fallback
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Close without choosing
  const handleSafeDismiss = async () => {
    try {
      await garageApi.markInvoiceRetentionPrompted(invoice.id);
    } catch {
      // ignore
    }
    if (onDismissed) onDismissed();
    onClose();
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="w-full max-w-lg bg-[#0e1420] border border-[#233047] rounded-xl shadow-2xl overflow-hidden text-slate-100 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="retention-modal-title"
      >
        {/* Modal Top Header Ribbon */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-b from-[#182338] to-[#0e1420] border-b border-[#212d42]">
          <button
            type="button"
            onClick={handleSafeDismiss}
            className="absolute top-4 end-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-400/90 block mb-1">
                {isAr ? 'اكتمال الزيارة والمحاسبة' : 'Visit & Payment Completed'}
              </span>
              <h3 id="retention-modal-title" className="text-lg font-bold text-white tracking-tight">
                {t('retentionDialogTitle')}
              </h3>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-sm">
          {/* Main prompt message */}
          <p className="text-slate-300 leading-relaxed text-[13px] bg-slate-900/40 p-3.5 rounded-lg border border-[#1b2537]">
            {t('retentionDialogMessage')}
          </p>

          {/* Current Visit & Customer Summary Card */}
          <div className="bg-[#121927] border border-[#1e2a3f] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">{t('customerInputLabel')}:</span>
              <span className="font-bold text-white flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                {customer.fullName}
              </span>
            </div>

            {customer.phone && (
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="text-slate-400">{t('customerPhone')}:</span>
                <span className="font-mono text-slate-200 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {customer.phone}
                </span>
              </div>
            )}

            {invoice.vehiclePlate && (
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="text-slate-400">{t('plateNumber')}:</span>
                <span className="font-bold text-amber-300 flex items-center gap-1 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/20">
                  <Car className="w-3 h-3 text-amber-400" />
                  {invoice.vehiclePlate}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
              <span className="text-slate-400">{t('invoiceNumber')}:</span>
              <span className="font-mono text-slate-300 flex items-center gap-1">
                <Receipt className="w-3 h-3 text-slate-500" />
                {invoice.invoiceNumber}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{t('grandTotal')}:</span>
              <span className="font-bold text-emerald-400">
                {formatOMR(fromBaisa(invoice.grandTotalBaisa), { arabicLabel: isAr })}
              </span>
            </div>
          </div>

          {/* Retain Benefits List */}
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{isAr ? 'الوصول السريع لملف العميل وسجل صيانة مركبته في الزيارات القادمة' : 'Instant access to customer and vehicle service history on future visits'}</span>
            </div>
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{isAr ? 'الاطلاع على جميع فواتير الزيارات وسندات القبض السابقة' : 'Review past service visits, invoices, and payment receipts'}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>{isAr ? 'حفظ البيانات محلياً وبشكل آمن وفق نظام قاعدة بيانات الكراج' : 'Safely retained locally in accordance with garage database rules'}</span>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 sm:px-6 bg-[#0b101a] border-t border-[#1e2a3f] flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          {/* Action 2: "Not now" */}
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={handleNotNow}
            disabled={isSubmitting}
            className="w-full sm:w-auto text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-800/60"
            icon={<Clock className="w-4 h-4" />}
          >
            {t('retentionActionNotNow')}
          </Button>

          {/* Action 1: "Yes, save customer" */}
          <Button
            type="button"
            variant="gold"
            size="md"
            onClick={handleSaveCustomer}
            disabled={isSubmitting}
            className="w-full sm:w-auto shadow-lg shadow-amber-950/40"
            icon={<UserCheck className="w-4 h-4" />}
          >
            {isSubmitting ? t('loading') : t('retentionActionYes')}
          </Button>
        </div>
      </div>
    </div>
  );
}
