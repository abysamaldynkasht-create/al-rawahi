/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Comprehensive Worker Management, Payroll, Overtime, and Productivity Center
 */

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Clock,
  DollarSign,
  TrendingUp,
  Plus,
  Search,
  Calendar,
  Printer,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Edit2,
  UserCheck,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  RefreshCw,
  Phone,
  User,
  Check,
  X,
  CreditCard,
  Briefcase,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { type RouteId } from '../i18n/translations.ts';
import { Card, CardContent } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { garageApi } from '../services/garageClient.ts';
import { formatBaisa, formatOMR, fromBaisa } from '../core/currency.ts';
import { WorkerModal } from '../components/workers/WorkerModal.tsx';
import { OvertimeModal } from '../components/workers/OvertimeModal.tsx';
import { PayrollSheetModal } from '../components/workers/PayrollSheetModal.tsx';
import { LaborAllocationModal } from '../components/workers/LaborAllocationModal.tsx';
import type {
  TechnicianDTO,
  TechnicianInput,
  WorkerOvertimeEntryDTO,
  WorkerMonthlyPayrollDTO,
  WorkerLaborProductivityDTO,
} from '../types/ipc.ts';

type ActiveTab = 'workers' | 'overtime' | 'payroll' | 'productivity';

export function TechniciansView({ onNavigate: _onNavigate }: { onNavigate?: (route: RouteId) => void }) {
  const { lang, isRtl } = useLanguage();
  const isAr = lang === 'ar';

  const [activeTab, setActiveTab] = useState<ActiveTab>('workers');
  const [isLoading, setIsLoading] = useState(false);

  // Workers Data
  const [workers, setWorkers] = useState<TechnicianDTO[]>([]);
  const [workerSearch, setWorkerSearch] = useState('');
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<TechnicianDTO | null>(null);

  // Overtime Data
  const [overtimeEntries, setOvertimeEntries] = useState<WorkerOvertimeEntryDTO[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [otWorkerFilter, setOtWorkerFilter] = useState<string>('');
  const [isOtModalOpen, setIsOtModalOpen] = useState(false);

  // Payroll Data
  const [payrollMonth, setPayrollMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [payrolls, setPayrolls] = useState<WorkerMonthlyPayrollDTO[]>([]);
  const [isPayrollSheetOpen, setIsPayrollSheetOpen] = useState(false);
  const [isGeneratingPayroll, setIsGeneratingPayroll] = useState(false);

  // Productivity Data
  const [productivityRecords, setProductivityRecords] = useState<WorkerLaborProductivityDTO[]>([]);
  const [prodWorkerFilter, setProdWorkerFilter] = useState<string>('');
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);

  // Feedback Notification
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // 1. Load Workers
  const loadWorkers = async () => {
    try {
      const res = await garageApi.getTechnicians();
      if (res.success && res.data) {
        setWorkers(res.data);
      }
    } catch (err) {
      console.error('Failed to load workers:', err);
    }
  };

  // 2. Load Overtime
  const loadOvertime = async () => {
    try {
      const res = await garageApi.getWorkerOvertime(otWorkerFilter || undefined, selectedMonth);
      if (res.success && res.data) {
        setOvertimeEntries(res.data);
      }
    } catch (err) {
      console.error('Failed to load overtime:', err);
    }
  };

  // 3. Load Payroll
  const loadPayrolls = async () => {
    try {
      const res = await garageApi.getWorkerPayrolls(payrollMonth);
      if (res.success && res.data) {
        setPayrolls(res.data);
      }
    } catch (err) {
      console.error('Failed to load payrolls:', err);
    }
  };

  // 4. Load Productivity
  const loadProductivity = async () => {
    try {
      const res = await garageApi.getWorkerProductivity(prodWorkerFilter || undefined);
      if (res.success && res.data) {
        setProductivityRecords(res.data);
      }
    } catch (err) {
      console.error('Failed to load productivity:', err);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadWorkers().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'overtime') {
      loadOvertime();
    } else if (activeTab === 'payroll') {
      loadPayrolls();
    } else if (activeTab === 'productivity') {
      loadProductivity();
    }
  }, [activeTab, selectedMonth, otWorkerFilter, payrollMonth, prodWorkerFilter]);

  // Handler: Save Worker (Create or Update)
  const handleSaveWorker = async (input: TechnicianInput): Promise<boolean> => {
    try {
      if (selectedWorker) {
        const res = await garageApi.updateTechnician(selectedWorker.id, input);
        if (res.success) {
          showFeedback('success', isAr ? 'تم تحديث بيانات العامل بنجاح' : 'Worker updated successfully');
          loadWorkers();
          return true;
        } else {
          showFeedback('error', res.error || (isAr ? 'فشل تحديث بيانات العامل' : 'Failed to update worker'));
          return false;
        }
      } else {
        const res = await garageApi.createTechnician(input);
        if (res.success) {
          showFeedback('success', isAr ? 'تم تسجيل العامل الجديد وتحديد راتبه بنجاح' : 'New worker registered successfully');
          loadWorkers();
          return true;
        } else {
          showFeedback('error', res.error || (isAr ? 'فشل تسجيل العامل' : 'Failed to register worker'));
          return false;
        }
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Error saving worker');
      return false;
    }
  };

  // Handler: Delete/Deactivate Worker
  const handleDeleteWorker = async (worker: TechnicianDTO) => {
    const confirmMsg = isAr
      ? `هل أنت متأكد من رغبتك في حذف أو إلغاء تفعيل العامل "${worker.name}"؟ سيتم إلغاء التفعيل بأمان إذا كانت لديه سجلات سابقة للحفاظ على التاريخ المالي.`
      : `Are you sure you want to deactivate or remove worker "${worker.name}"? If historical records exist, they will be safely deactivated to preserve financial integrity.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await garageApi.deleteTechnician(worker.id);
      if (res.success) {
        showFeedback(
          'success',
          isAr ? 'تمت معالجة حالة العامل بنجاح' : 'Worker status updated successfully'
        );
        loadWorkers();
      } else {
        showFeedback('error', res.error || (isAr ? 'فشل حذف العامل' : 'Failed to remove worker'));
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Error deleting worker');
    }
  };

  // Handler: Update Overtime Status
  const handleUpdateOtStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await garageApi.updateWorkerOvertimeStatus(id, status);
      if (res.success) {
        showFeedback(
          'success',
          isAr
            ? status === 'APPROVED'
              ? 'تم اعتماد ساعات العمل الإضافي'
              : 'تم رفض سجل العمل الإضافي'
            : `Overtime entry ${status.toLowerCase()}`
        );
        loadOvertime();
      } else {
        showFeedback('error', res.error || 'Failed to update status');
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Error updating status');
    }
  };

  // Handler: Delete Overtime
  const handleDeleteOt = async (id: string) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا السجل الإضافي؟' : 'Delete overtime record?')) return;
    try {
      const res = await garageApi.deleteWorkerOvertime(id);
      if (res.success) {
        showFeedback('success', isAr ? 'تم حذف السجل' : 'Record deleted');
        loadOvertime();
      } else {
        showFeedback('error', res.error || 'Failed to delete');
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Error deleting');
    }
  };

  // Handler: Generate Payroll
  const handleGeneratePayroll = async () => {
    setIsGeneratingPayroll(true);
    try {
      const res = await garageApi.generateWorkerPayroll({ payrollMonth });
      if (res.success) {
        showFeedback(
          'success',
          isAr
            ? `تم توليد مسير رواتب شهر ${payrollMonth} بنجاح لجميع العمال النشطين`
            : `Payroll for ${payrollMonth} generated successfully`
        );
        loadPayrolls();
      } else {
        showFeedback('error', res.error || (isAr ? 'فشل توليد الرواتب' : 'Failed to generate payroll'));
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Error generating payroll');
    } finally {
      setIsGeneratingPayroll(false);
    }
  };

  // Handler: Finalize Payroll
  const handleFinalizePayroll = async (payrollId: string) => {
    try {
      const res = await garageApi.finalizeWorkerPayroll({
        payrollId,
        markAsPaid: true,
        paymentMethod: 'CASH',
      });
      if (res.success) {
        showFeedback('success', isAr ? 'تم اعتماد وصرف الراتب بنجاح' : 'Payroll finalized and marked as paid');
        loadPayrolls();
      } else {
        showFeedback('error', res.error || 'Failed to finalize');
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Error finalizing');
    }
  };

  // Filtered workers list
  const filteredWorkers = workers.filter(
    (w) =>
      w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
      (w.specialty && w.specialty.toLowerCase().includes(workerSearch.toLowerCase())) ||
      (w.phone && w.phone.includes(workerSearch)) ||
      (w.nationalId && w.nationalId.includes(workerSearch))
  );

  // Calculations for Overtime tab KPIs
  const totalOtHours = overtimeEntries.reduce((acc, e) => acc + e.hours, 0);
  const approvedOtHours = overtimeEntries.filter((e) => e.status === 'APPROVED').reduce((acc, e) => acc + e.hours, 0);
  const pendingOtEntries = overtimeEntries.filter((e) => e.status === 'PENDING').length;
  const totalOtBaisa = overtimeEntries.reduce((acc, e) => acc + e.totalAmountBaisa, 0);

  // Calculations for Payroll tab KPIs
  const totalPayrollWorkers = payrolls.length;
  const totalBaseBaisa = payrolls.reduce((acc, p) => acc + p.baseSalaryBaisa, 0);
  const totalOtAmountInPayrollBaisa = payrolls.reduce((acc, p) => acc + p.overtimeAmountBaisa, 0);
  const netPayrollBaisa = payrolls.reduce((acc, p) => acc + p.totalPayableBaisa, 0);

  // Calculations for Productivity tab KPIs
  const totalAttributedLaborBaisa = productivityRecords.reduce((acc, r) => acc + r.laborValueBaisa, 0);
  const totalProdHours = productivityRecords.reduce((acc, r) => acc + (r.hoursSpent || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Akasha AI Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-inner">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                {isAr ? 'إدارة العمال والرواتب والإنتاجية' : 'Workers, Payroll & Productivity Center'}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'تسجيل العمال، الرواتب الشهرية، ساعات العمل الإضافي، وتوزيع إنتاجية أجور اليد المعتمدة'
                  : 'Manage technicians, overtime payroll, and verified labor charge productivity'}
              </p>
            </div>
          </div>
        </div>

        {/* Global Action depending on Tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'workers' && (
            <Button
              onClick={() => {
                setSelectedWorker(null);
                setIsWorkerModalOpen(true);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-2 shadow-lg shadow-amber-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? 'تسجيل عامل جديد' : 'Add New Worker'}</span>
            </Button>
          )}

          {activeTab === 'overtime' && (
            <Button
              onClick={() => setIsOtModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-2 shadow-lg shadow-amber-600/20"
            >
              <Clock className="w-4 h-4" />
              <span>{isAr ? 'تسجيل عمل إضافي' : 'Log Overtime'}</span>
            </Button>
          )}

          {activeTab === 'payroll' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setIsPayrollSheetOpen(true)}
                disabled={payrolls.length === 0}
                className="border-slate-700 text-slate-200 hover:bg-slate-800 text-xs gap-1.5"
              >
                <Printer className="w-4 h-4 text-amber-500" />
                <span>{isAr ? 'كشف المسير للطباعة' : 'Print Statement'}</span>
              </Button>
              <Button
                onClick={handleGeneratePayroll}
                disabled={isGeneratingPayroll}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-2 shadow-lg shadow-amber-600/20"
              >
                {isGeneratingPayroll ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                <span>{isAr ? 'توليد مسير الشهر' : 'Generate Payroll'}</span>
              </Button>
            </div>
          )}

          {activeTab === 'productivity' && (
            <Button
              onClick={() => setIsAllocationModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-2 shadow-lg shadow-amber-600/20"
            >
              <Layers className="w-4 h-4" />
              <span>{isAr ? 'توزيع إنتاجية صيانة' : 'Allocate Labor'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Floating feedback alert */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Modern 4-Tab Bar */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('workers')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'workers'
              ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{isAr ? 'سجل الفنيين والعمال' : 'Workers & Technicians'}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {workers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('overtime')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'overtime'
              ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{isAr ? 'ساعات العمل الإضافي' : 'Overtime Tracking'}</span>
          {pendingOtEntries > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold">
              {pendingOtEntries}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'payroll'
              ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>{isAr ? 'مسيرات الرواتب الشهرية' : 'Monthly Payroll'}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {payrolls.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('productivity')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'productivity'
              ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>{isAr ? 'إنتاجية أجور اليد' : 'Labor Productivity'}</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: WORKERS & TECHNICIANS                                           */}
      {/* ===================================================================== */}
      {activeTab === 'workers' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute right-3.5 rtl:right-3.5 ltr:left-3.5 top-3 text-slate-500" />
              <Input
                value={workerSearch}
                onChange={(e) => setWorkerSearch(e.target.value)}
                placeholder={isAr ? 'بحث بالاسم، رقم الهاتف، التخصص، أو الرقم المدني...' : 'Search by name, phone, specialty, national ID...'}
                className="rtl:pr-10 ltr:pl-10 text-xs bg-slate-900/60 border-slate-800"
              />
            </div>
          </div>

          {/* Workers Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkers.map((w) => {
              const status = w.employmentStatus || (w.isActive ? 'ACTIVE' : 'TERMINATED');
              return (
                <Card
                  key={w.id}
                  className="bg-slate-900/80 border-slate-800/80 hover:border-slate-700 transition-all rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between"
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold text-base">
                          {w.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                            <span>{w.name}</span>
                          </h3>
                          <p className="text-xs text-amber-400/90 font-medium">
                            {w.specialty || (isAr ? 'فني ورشة' : 'Workshop Technician')}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : status === 'ON_LEAVE'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {status === 'ACTIVE'
                          ? isAr ? 'نشط' : 'Active'
                          : status === 'ON_LEAVE'
                          ? isAr ? 'في إجازة' : 'On Leave'
                          : isAr ? 'منهية خدماته' : 'Terminated'}
                      </span>
                    </div>

                    {/* Financial Snapshot: Base Salary & Overtime Rate */}
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="border-r rtl:border-l rtl:border-r-0 border-slate-800">
                        <span className="text-[10px] text-slate-400 block mb-0.5">
                          {isAr ? 'الراتب الأساسي' : 'Base Salary'}
                        </span>
                        <span className="font-bold font-mono text-slate-200">
                          {formatBaisa(w.monthlyBaseSalaryBaisa || 350000)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">
                          {isAr ? 'ساعة الإضافي' : 'OT Hourly Rate'}
                        </span>
                        <span className="font-bold font-mono text-amber-400">
                          {formatBaisa(w.overtimeRateBaisa || 2500)}
                        </span>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="space-y-1.5 text-xs text-slate-400">
                      {w.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-mono">{w.phone}</span>
                        </div>
                      )}
                      {w.nationalId && (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                          <span>{isAr ? 'الرقم المدني:' : 'National ID:'} </span>
                          <span className="font-mono text-slate-300">{w.nationalId}</span>
                        </div>
                      )}
                      {w.hireDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{isAr ? 'تاريخ التعيين:' : 'Hired:'} </span>
                          <span className="font-mono text-slate-300">{w.hireDate}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>

                  {/* Card footer actions */}
                  <div className="px-5 py-3 bg-slate-950/40 border-t border-slate-800/60 flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedWorker(w);
                        setIsWorkerModalOpen(true);
                      }}
                      className="text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-1.5 h-8 px-2.5"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isAr ? 'تعديل البيانات' : 'Edit'}</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteWorker(w)}
                      className="text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 gap-1.5 h-8 px-2.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{w.isActive ? (isAr ? 'إلغاء التفعيل' : 'Deactivate') : (isAr ? 'حذف' : 'Delete')}</span>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {filteredWorkers.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
              {isAr ? 'لا يوجد عمال يطابقون معايير البحث.' : 'No workers match the search criteria.'}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: OVERTIME TRACKING                                               */}
      {/* ===================================================================== */}
      {activeTab === 'overtime' && (
        <div className="space-y-4">
          {/* Overtime KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="p-3.5 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {isAr ? 'إجمالي الساعات المسجلة' : 'Total OT Hours'}
                </span>
                <span className="text-lg font-black text-amber-400 font-mono">
                  {totalOtHours.toFixed(1)} {isAr ? 'ساعة' : 'hrs'}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="p-3.5 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {isAr ? 'الساعات المعتمدة' : 'Approved Hours'}
                </span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {approvedOtHours.toFixed(1)} {isAr ? 'ساعة' : 'hrs'}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="p-3.5 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {isAr ? 'سجلات بانتظار الاعتماد' : 'Pending Approval'}
                </span>
                <span className="text-lg font-black text-blue-400 font-mono">
                  {pendingOtEntries}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="p-3.5 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {isAr ? 'إجمالي بدل العمل الإضافي' : 'Total OT Amount'}
                </span>
                <span className="text-lg font-black text-slate-100 font-mono">
                  {formatBaisa(totalOtBaisa)}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Filters Bar */}
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400">{isAr ? 'شهر الاستحقاق:' : 'Month:'}</span>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-36 text-xs h-8 bg-slate-800 border-slate-700"
              />
            </div>

            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400">{isAr ? 'تصفية بالعامل:' : 'Worker:'}</span>
              <select
                value={otWorkerFilter}
                onChange={(e) => setOtWorkerFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 h-8"
              >
                <option value="">{isAr ? 'جميع العمال' : 'All Workers'}</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Overtime Entries Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-right rtl:text-right ltr:text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="py-3 px-4">{isAr ? 'اسم العامل' : 'Worker'}</th>
                    <th className="py-3 px-4">{isAr ? 'الساعات' : 'Hours'}</th>
                    <th className="py-3 px-4">{isAr ? 'سعر الساعة (المثبت)' : 'Snapshot Rate'}</th>
                    <th className="py-3 px-4">{isAr ? 'المبلغ المستحق' : 'Amount'}</th>
                    <th className="py-3 px-4">{isAr ? 'ملاحظات' : 'Notes'}</th>
                    <th className="py-3 px-4">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="py-3 px-4 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {overtimeEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        {isAr ? 'لا توجد ساعات عمل إضافي مسجلة لهذه الفترة.' : 'No overtime records for this period.'}
                      </td>
                    </tr>
                  ) : (
                    overtimeEntries.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-300">{e.workDate}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-100">{e.workerName || '—'}</span>
                          <span className="text-[10px] text-slate-400 block">{e.workerSpecialty}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-amber-400 font-bold">
                          {e.hours.toFixed(1)} {isAr ? 'س' : 'h'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {formatBaisa(e.hourlyRateBaisa)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-100 font-bold">
                          {formatBaisa(e.totalAmountBaisa)}
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-[180px] truncate">
                          {e.notes || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              e.status === 'APPROVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : e.status === 'REJECTED'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {e.status === 'APPROVED'
                              ? isAr ? 'معتمد' : 'Approved'
                              : e.status === 'REJECTED'
                              ? isAr ? 'مرفوض' : 'Rejected'
                              : isAr ? 'قيد المراجعة' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {e.status === 'PENDING' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOtStatus(e.id, 'APPROVED')}
                                  title={isAr ? 'اعتماد' : 'Approve'}
                                  className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/20"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOtStatus(e.id, 'REJECTED')}
                                  title={isAr ? 'رفض' : 'Reject'}
                                  className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/20"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteOt(e.id)}
                              title={isAr ? 'حذف' : 'Delete'}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
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
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: MONTHLY PAYROLL                                                 */}
      {/* ===================================================================== */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Payroll KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="p-3.5 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {isAr ? 'عدد العمال المشمولين' : 'Workers Count'}
                </span>
                <span className="text-lg font-black text-slate-100 font-mono">
                  {totalPayrollWorkers}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="p-3.5 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {isAr ? 'مجموع الرواتب الأساسية' : 'Total Base Salaries'}
                </span>
                <span className="text-lg font-black text-slate-100 font-mono">
                  {formatBaisa(totalBaseBaisa)}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="p-3.5 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {isAr ? 'مجموع بدلات الإضافي' : 'Total Overtime Pay'}
                </span>
                <span className="text-lg font-black text-amber-400 font-mono">
                  {formatBaisa(totalOtAmountInPayrollBaisa)}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-800 bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-3.5 text-center">
                <span className="text-[11px] font-bold text-amber-400 block mb-1">
                  {isAr ? 'صافي مسير الرواتب' : 'Net Total Payroll'}
                </span>
                <span className="text-xl font-black text-amber-400 font-mono">
                  {formatBaisa(netPayrollBaisa)}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Month selector and Formula Explanation */}
          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 font-semibold">{isAr ? 'شهر المسير المعتمد:' : 'Payroll Period:'}</span>
              <Input
                type="month"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
                className="w-40 text-xs h-8 bg-slate-800 border-slate-700"
              />
            </div>

            <div className="text-xs text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800 font-mono">
              <span className="text-amber-400 font-bold">{isAr ? 'المعادلة المحاسبية:' : 'Formula:'} </span>
              {isAr ? 'الصافي = الراتب الأساسي + (ساعات الإضافي × أجر الساعة المثبت)' : 'Payable = Base Salary + (OT Hours × Rate)'}
            </div>
          </div>

          {/* Payroll Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-right rtl:text-right ltr:text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">{isAr ? 'اسم العامل' : 'Worker'}</th>
                    <th className="py-3 px-4">{isAr ? 'الراتب الأساسي' : 'Base Salary'}</th>
                    <th className="py-3 px-4">{isAr ? 'ساعات الإضافي' : 'OT Hours'}</th>
                    <th className="py-3 px-4">{isAr ? 'مستحق الإضافي' : 'OT Pay'}</th>
                    <th className="py-3 px-4 font-bold text-amber-400">{isAr ? 'صافي الراتب' : 'Net Total'}</th>
                    <th className="py-3 px-4">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="py-3 px-4 text-center">{isAr ? 'إجراءات الصرف' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {payrolls.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        {isAr
                          ? 'لم يتم توليد مسير رواتب لهذا الشهر بعد. انقر على "توليد مسير الشهر" لحساب مستحقات العمال.'
                          : 'No payroll records for this month. Click "Generate Payroll" to compute payments.'}
                      </td>
                    </tr>
                  ) : (
                    payrolls.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-100">{p.workerName || '—'}</span>
                          <span className="text-[10px] text-slate-400 block">{p.workerSpecialty}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {formatBaisa(p.baseSalaryBaisa)}
                        </td>
                        <td className="py-3 px-4 font-mono text-amber-400">
                          {p.overtimeHours.toFixed(1)} {isAr ? 'س' : 'h'}
                        </td>
                        <td className="py-3 px-4 font-mono text-amber-400 font-bold">
                          {formatBaisa(p.overtimeAmountBaisa)}
                        </td>
                        <td className="py-3 px-4 font-mono text-base font-black text-amber-400">
                          {formatBaisa(p.totalPayableBaisa)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.status === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : p.status === 'FINALIZED'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {p.status === 'PAID'
                              ? isAr ? 'تم الصرف' : 'Paid'
                              : p.status === 'FINALIZED'
                              ? isAr ? 'معتمد' : 'Finalized'
                              : isAr ? 'مسودة' : 'Draft'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.status !== 'PAID' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFinalizePayroll(p.id)}
                              className="text-xs h-7 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isAr ? 'اعتماد وصرف' : 'Finalize & Pay'}</span>
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono">
                              {p.paidAt ? p.paidAt.slice(0, 10) : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: LABOR PRODUCTIVITY                                              */}
      {/* ===================================================================== */}
      {activeTab === 'productivity' && (
        <div className="space-y-4">
          {/* Strict Separation Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl flex items-start gap-3 text-amber-300">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold">
                {isAr ? 'تنبيه محاسبي ومبدأ فصل الذمم: ' : 'Strict Segregation Rule: '}
              </span>
              {isAr
                ? 'إنتاجية العمل تمثل الإيرادات المولدة من أجور اليد لورشة الصيانة، وتُفصل تمامًا عن الرواتب المستحقة للعاملين. قطع الغيار مستبعدة كليًا من إنتاجية العمال، ولا تتجاوز الحصص الموزعة إجمالي أجور اليد المعتمدة في أمر الإصلاح.'
                : 'Productivity tracks labor revenue generated by workers and is strictly segregated from payroll liabilities. Spare parts costs are never attributed to worker productivity.'}
            </div>
          </div>

          {/* Productivity KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="p-3.5 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {isAr ? 'إجمالي إنتاجية أجور اليد المسجلة' : 'Total Attributed Labor'}
                </span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {formatBaisa(totalAttributedLaborBaisa)}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="p-3.5 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {isAr ? 'ساعات الصيانة الموثقة' : 'Documented Labor Hours'}
                </span>
                <span className="text-xl font-black text-amber-400 font-mono">
                  {totalProdHours.toFixed(1)} {isAr ? 'ساعة' : 'hrs'}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-800">
              <CardContent className="p-3.5 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {isAr ? 'عدد العمليات الموثقة' : 'Recorded Allocations'}
                </span>
                <span className="text-xl font-black text-slate-100 font-mono">
                  {productivityRecords.length}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Filters Bar */}
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 flex items-center gap-3 text-xs">
            <User className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">{isAr ? 'تصفية بالعامل:' : 'Filter Worker:'}</span>
            <select
              value={prodWorkerFilter}
              onChange={(e) => setProdWorkerFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 h-8"
            >
              <option value="">{isAr ? 'جميع العمال' : 'All Workers'}</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Productivity Records Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-right rtl:text-right ltr:text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="py-3 px-4">{isAr ? 'اسم العامل' : 'Worker'}</th>
                    <th className="py-3 px-4">{isAr ? 'أمر الإصلاح' : 'RO #'}</th>
                    <th className="py-3 px-4">{isAr ? 'لوحة المركبة' : 'Plate'}</th>
                    <th className="py-3 px-4">{isAr ? 'وصف العمل المنجز' : 'Work Description'}</th>
                    <th className="py-3 px-4">{isAr ? 'الساعات' : 'Hours'}</th>
                    <th className="py-3 px-4 font-bold text-emerald-400">{isAr ? 'قيمة الإنتاجية' : 'Labor Value'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {productivityRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        {isAr ? 'لا توجد سجلات إنتاجية مسجلة بعد.' : 'No productivity allocations recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    productivityRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-300">{r.workDate}</td>
                        <td className="py-3 px-4 font-bold text-slate-100">{r.workerName || '—'}</td>
                        <td className="py-3 px-4 font-mono text-amber-400">{r.roNumber || '—'}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{r.vehiclePlate || '—'}</td>
                        <td className="py-3 px-4 text-slate-300 max-w-[220px] truncate">
                          {r.workDescription}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {r.hoursSpent ? `${r.hoursSpent} ${isAr ? 'س' : 'h'}` : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-sm">
                          {formatBaisa(r.laborValueBaisa)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <WorkerModal
        isOpen={isWorkerModalOpen}
        worker={selectedWorker}
        onClose={() => setIsWorkerModalOpen(false)}
        onSave={handleSaveWorker}
        isAr={isAr}
      />

      <OvertimeModal
        isOpen={isOtModalOpen}
        workers={workers}
        onClose={() => setIsOtModalOpen(false)}
        onSave={async (input) => {
          const res = await garageApi.addWorkerOvertime(input);
          if (res.success) {
            showFeedback('success', isAr ? 'تم تسجيل ساعات العمل الإضافي بنجاح' : 'Overtime logged successfully');
            loadOvertime();
            return true;
          } else {
            showFeedback('error', res.error || 'Failed to log overtime');
            return false;
          }
        }}
        isAr={isAr}
      />

      <PayrollSheetModal
        isOpen={isPayrollSheetOpen}
        payrolls={payrolls}
        month={payrollMonth}
        onClose={() => setIsPayrollSheetOpen(false)}
        onFinalize={async (id) => {
          await handleFinalizePayroll(id);
        }}
        isAr={isAr}
      />

      <LaborAllocationModal
        isOpen={isAllocationModalOpen}
        workers={workers}
        onClose={() => setIsAllocationModalOpen(false)}
        onSuccess={() => {
          showFeedback('success', isAr ? 'تم حفظ وتوزيع إنتاجية أجور اليد بنجاح' : 'Labor productivity allocated successfully');
          loadProductivity();
        }}
        isAr={isAr}
      />
    </div>
  );
}
