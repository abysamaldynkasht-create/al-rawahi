/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Monthly Payroll & Overtime Statement (A4 Printable Sheet)
 */

import React, { useRef } from 'react';
import {
  Printer,
  X,
  CheckCircle2,
  Calendar,
  Users,
  DollarSign,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import { formatBaisa } from '../../core/currency.ts';
import type { WorkerMonthlyPayrollDTO } from '../../types/ipc.ts';

interface PayrollSheetModalProps {
  isOpen: boolean;
  payrolls: WorkerMonthlyPayrollDTO[];
  month: string;
  garageName?: string;
  onClose: () => void;
  onFinalize?: (payrollId: string) => Promise<void>;
  isAr: boolean;
}

export function PayrollSheetModal({
  isOpen,
  payrolls,
  month,
  garageName = 'مركز الرواحي للعناية بالسيارات',
  onClose,
  onFinalize,
  isAr,
}: PayrollSheetModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const totalWorkers = payrolls.length;
  const totalBaseSalaryBaisa = payrolls.reduce((acc, p) => acc + p.baseSalaryBaisa, 0);
  const totalOvertimeHours = payrolls.reduce((acc, p) => acc + p.overtimeHours, 0);
  const totalOvertimeBaisa = payrolls.reduce((acc, p) => acc + p.overtimeAmountBaisa, 0);
  const totalPayableBaisa = payrolls.reduce((acc, p) => acc + p.totalPayableBaisa, 0);

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: WorkerMonthlyPayrollDTO['status']) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            {isAr ? 'تم الصرف' : 'Paid'}
          </span>
        );
      case 'FINALIZED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            {isAr ? 'معتمد' : 'Finalized'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            {isAr ? 'مسودة' : 'Draft'}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Top Action Bar (Hidden in Print) */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {isAr ? 'كشف مسيرات الرواتب وساعات الإضافي' : 'Monthly Payroll & Overtime Statement'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? `شهر الاستحقاق: ${month}` : `Period: ${month}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-2 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Printer className="w-4 h-4 text-amber-500" />
              <span>{isAr ? 'طباعة الكشف' : 'Print Statement'}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Printable Sheet Area */}
        <div
          ref={printAreaRef}
          className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white text-slate-900 text-sm print:overflow-visible print:p-4"
        >
          {/* Header with Garage Logo */}
          <div className="border-b-2 border-amber-600/30 pb-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img
                  src="/garage_logo.jpg"
                  alt="Garage Logo"
                  className="w-20 h-20 object-contain rounded-lg border border-slate-200"
                />
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {garageName}
                  </h1>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    AL RAWAHI GARAGE FOR AUTOMOTIVE CARE & MAINTENANCE
                  </p>
                  <p className="text-xs text-amber-700 font-bold mt-1">
                    {isAr ? 'كشف مستحقات العمال والرواتب المعتمدة' : 'Official Worker Compensation & Payroll Ledger'}
                  </p>
                </div>
              </div>

              <div className="text-left rtl:text-right bg-slate-50 p-3 rounded-xl border border-slate-200 min-w-[200px]">
                <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold">{isAr ? 'شهر المسير:' : 'Period:'}</span>
                  <span className="font-mono font-bold text-slate-900">{month}</span>
                </div>
                <div className="text-xs text-slate-500">
                  <span>{isAr ? 'تاريخ التوليد:' : 'Generated:'} </span>
                  <span className="font-mono">{new Date().toLocaleDateString('ar-OM')}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Powered by AKASHA AI Core
                </div>
              </div>
            </div>
          </div>

          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
            <div className="p-2 border-r last:border-r-0 border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 mb-1">
                {isAr ? 'إجمالي العمال' : 'Total Workers'}
              </div>
              <div className="text-lg font-bold text-slate-800">{totalWorkers}</div>
            </div>
            <div className="p-2 border-r last:border-r-0 border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 mb-1">
                {isAr ? 'مجموع الرواتب الأساسية' : 'Total Base Salaries'}
              </div>
              <div className="text-base font-bold text-slate-900 font-mono">
                {formatBaisa(totalBaseSalaryBaisa)}
              </div>
            </div>
            <div className="p-2 border-r last:border-r-0 border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 mb-1">
                {isAr ? 'إجمالي ساعات الإضافي' : 'Total OT Hours'}
              </div>
              <div className="text-base font-bold text-amber-700 font-mono">
                {totalOvertimeHours.toFixed(1)} {isAr ? 'ساعة' : 'hrs'}
              </div>
            </div>
            <div className="p-2 border-r last:border-r-0 border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 mb-1">
                {isAr ? 'بدلات العمل الإضافي' : 'Total Overtime Pay'}
              </div>
              <div className="text-base font-bold text-amber-700 font-mono">
                {formatBaisa(totalOvertimeBaisa)}
              </div>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 col-span-2 sm:col-span-1">
              <div className="text-[11px] font-bold text-amber-900 mb-1">
                {isAr ? 'صافي المستحق للصرف' : 'Net Payable'}
              </div>
              <div className="text-base font-black text-amber-900 font-mono">
                {formatBaisa(totalPayableBaisa)}
              </div>
            </div>
          </div>

          {/* Statement Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl mb-6">
            <table className="w-full text-right rtl:text-right ltr:text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">{isAr ? 'اسم العامل والتخصص' : 'Worker & Specialty'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'الراتب الأساسي' : 'Base Salary'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'ساعات الإضافي' : 'OT Hours'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'مستحق الإضافي' : 'OT Amount'}</th>
                  <th className="py-2.5 px-3 font-bold bg-amber-50/50">{isAr ? 'صافي الراتب المستحق' : 'Net Payable'}</th>
                  <th className="py-2.5 px-3">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="py-2.5 px-4 w-36 text-center">{isAr ? 'توقيع المستلم' : 'Recipient Signature'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {payrolls.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      {isAr ? 'لا توجد سجلات رواتب مسجلة لهذا الشهر بعد' : 'No payroll records generated for this month.'}
                    </td>
                  </tr>
                ) : (
                  payrolls.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{p.workerName || '—'}</div>
                        <div className="text-[11px] text-slate-500">{p.workerSpecialty || '—'}</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-700">
                        {formatBaisa(p.baseSalaryBaisa)}
                      </td>
                      <td className="py-3 px-3 font-mono text-amber-700">
                        {p.overtimeHours.toFixed(1)} {isAr ? 'س' : 'h'}
                      </td>
                      <td className="py-3 px-3 font-mono text-amber-700 font-medium">
                        {formatBaisa(p.overtimeAmountBaisa)}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 bg-amber-50/30">
                        {formatBaisa(p.totalPayableBaisa)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(p.status)}
                          {p.status === 'DRAFT' && onFinalize && (
                            <button
                              type="button"
                              onClick={() => onFinalize(p.id)}
                              className="print:hidden text-[11px] text-blue-600 hover:text-blue-800 underline font-semibold"
                            >
                              {isAr ? 'اعتماد' : 'Finalize'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 border-l border-slate-200">
                        <div className="h-9 border-b border-dashed border-slate-300 w-full flex items-end justify-center text-[10px] text-slate-300">
                          {p.status === 'PAID' ? (isAr ? 'تم الاستلام' : 'Received') : ''}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100/90 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={2} className="py-3 px-3 text-slate-900">
                    {isAr ? 'الإجمالي الكلي للمسير:' : 'Grand Totals:'}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-900">
                    {formatBaisa(totalBaseSalaryBaisa)}
                  </td>
                  <td className="py-3 px-3 font-mono text-amber-800">
                    {totalOvertimeHours.toFixed(1)} {isAr ? 'س' : 'h'}
                  </td>
                  <td className="py-3 px-3 font-mono text-amber-800">
                    {formatBaisa(totalOvertimeBaisa)}
                  </td>
                  <td className="py-3 px-3 font-mono text-base font-black text-amber-900 bg-amber-100/60">
                    {formatBaisa(totalPayableBaisa)}
                  </td>
                  <td colSpan={2} className="py-3 px-3 text-slate-500 font-normal text-xs text-center">
                    {isAr ? 'المبالغ بالريال العماني (OMR)' : 'Amounts in Omani Rial (OMR)'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Legal Notes & Signatures */}
          <div className="mt-8 pt-4 border-t border-slate-200">
            <p className="text-[11px] text-slate-500 mb-6 leading-relaxed">
              {isAr
                ? 'ملاحظة: هذا الكشف رسمي وصادر من نظام الرواحي لإدارة الورش المعتمد. تُحسب مستحقات العمل الإضافي وفقًا لمعدلات الساعات التاريخية الموثقة في عقود العمل وتفصل تفصيلاً كاملاً عن إنتاجية مهام الصيانة.'
                : 'Note: This statement is an official payroll ledger issued by Al Rawahi Garage Management System. Overtime compensation is calculated based on historical snapshot rates and strictly segregated from repair order labor productivity.'}
            </p>

            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              <div className="border-t border-slate-300 pt-3">
                <p className="font-bold text-slate-700">{isAr ? 'إعداد المحاسب / مسؤول الرواتب' : 'Prepared By (Accountant)'}</p>
                <div className="h-10"></div>
                <p className="text-[10px] text-slate-400">{isAr ? 'التوقيع والختم' : 'Signature & Date'}</p>
              </div>
              <div className="border-t border-slate-300 pt-3">
                <p className="font-bold text-slate-700">{isAr ? 'مدير عام الورشة' : 'Workshop Manager'}</p>
                <div className="h-10"></div>
                <p className="text-[10px] text-slate-400">{isAr ? 'الاعتماد النهائي' : 'Approval & Seal'}</p>
              </div>
              <div className="border-t border-slate-300 pt-3">
                <p className="font-bold text-slate-700">{isAr ? 'التدقيق المالي' : 'Financial Auditor'}</p>
                <div className="h-10"></div>
                <p className="text-[10px] text-slate-400">{isAr ? 'المطابقة' : 'Audit Check'}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
