/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Worker Labor Productivity Allocation Modal
 * Strict Accounting Rule: Spare parts costs are NEVER attributed to labor productivity.
 * Multi-worker labor split constraint: SUM(allocations) <= Total RO Labor Charges.
 */

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  User,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { toBaisa, fromBaisa, formatBaisa } from '../../core/currency.ts';
import { garageApi } from '../../services/garageClient.ts';
import type {
  TechnicianDTO,
  RepairOrderDTO,
  LaborAllocationInput,
} from '../../types/ipc.ts';

interface LaborAllocationModalProps {
  isOpen: boolean;
  workers: TechnicianDTO[];
  onClose: () => void;
  onSuccess: () => void;
  isAr: boolean;
}

interface WorkerAllocationRow {
  workerId: string;
  laborValueOmr: string;
  hoursSpent: string;
}

export function LaborAllocationModal({
  isOpen,
  workers,
  onClose,
  onSuccess,
  isAr,
}: LaborAllocationModalProps) {
  const [repairOrders, setRepairOrders] = useState<RepairOrderDTO[]>([]);
  const [selectedRoId, setSelectedRoId] = useState<string>('');
  const [selectedRo, setSelectedRo] = useState<RepairOrderDTO | null>(null);
  const [workDate, setWorkDate] = useState<string>('');
  const [workDescription, setWorkDescription] = useState<string>('');
  const [rows, setRows] = useState<WorkerAllocationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRos, setIsLoadingRos] = useState(false);

  // Active workers only
  const activeWorkers = workers.filter((w) => w.isActive);

  useEffect(() => {
    if (isOpen) {
      setWorkDate(new Date().toISOString().slice(0, 10));
      setWorkDescription('');
      setError(null);
      setSelectedRoId('');
      setSelectedRo(null);

      // Default single row if workers available
      if (activeWorkers.length > 0) {
        setRows([
          {
            workerId: activeWorkers[0].id,
            laborValueOmr: '10.000',
            hoursSpent: '1.5',
          },
        ]);
      } else {
        setRows([]);
      }

      // Load repair orders
      loadRepairOrders();
    }
  }, [isOpen]);

  const loadRepairOrders = async () => {
    setIsLoadingRos(true);
    try {
      const res = await garageApi.getRepairOrders();
      if (res.success && res.data) {
        // Exclude delivered or cancelled if needed, or show all with labor > 0
        setRepairOrders(res.data);
      }
    } catch (err) {
      console.error('Failed to load repair orders:', err);
    } finally {
      setIsLoadingRos(false);
    }
  };

  const handleRoChange = (roId: string) => {
    setSelectedRoId(roId);
    const ro = repairOrders.find((r) => r.id === roId) || null;
    setSelectedRo(ro);

    if (ro) {
      if (!workDescription) {
        setWorkDescription(
          isAr
            ? `أعمال صيانة وإصلاح لأمر العمل ${ro.roNumber}`
            : `Labor execution for RO #${ro.roNumber}`
        );
      }
      // If RO has laborTotalBaisa, preset first row allocation if single row
      if (rows.length === 1 && ro.laborTotalBaisa > 0) {
        setRows([
          {
            ...rows[0],
            laborValueOmr: fromBaisa(ro.laborTotalBaisa).toFixed(3),
          },
        ]);
      }
    }
  };

  const handleAddRow = () => {
    const unselected = activeWorkers.find((w) => !rows.some((r) => r.workerId === w.id));
    const nextWorkerId = unselected ? unselected.id : (activeWorkers[0]?.id || '');
    setRows([
      ...rows,
      {
        workerId: nextWorkerId,
        laborValueOmr: '5.000',
        hoursSpent: '1.0',
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof WorkerAllocationRow, value: string) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  // Calculations
  const totalAllocatedBaisa = rows.reduce(
    (acc, r) => acc + toBaisa(parseFloat(r.laborValueOmr) || 0),
    0
  );
  const roLaborBaisa = selectedRo ? selectedRo.laborTotalBaisa : 0;
  const isOverBudget = selectedRo && roLaborBaisa > 0 && totalAllocatedBaisa > roLaborBaisa;
  const remainingBudgetBaisa = selectedRo && roLaborBaisa > 0 ? roLaborBaisa - totalAllocatedBaisa : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!workDescription.trim()) {
      setError(isAr ? 'يرجى كتابة وصف للعمل المنجز' : 'Work description is required.');
      return;
    }

    if (rows.length === 0) {
      setError(isAr ? 'يجب تعيين عامل واحد على الأقل' : 'At least one worker allocation is required.');
      return;
    }

    // Check duplicate workers
    const workerIds = rows.map((r) => r.workerId);
    if (new Set(workerIds).size !== workerIds.length) {
      setError(isAr ? 'لا يمكن تكرار نفس العامل في أكثر من سطر ضمن نفس العملية' : 'Cannot allocate to the same worker multiple times in one operation.');
      return;
    }

    // Check non-zero positive amounts
    for (const r of rows) {
      const val = parseFloat(r.laborValueOmr);
      if (isNaN(val) || val <= 0) {
        setError(isAr ? 'يجب إدخال قيمة عمل إيجابية لكل عامل' : 'Each worker must have a positive labor value.');
        return;
      }
    }

    if (isOverBudget) {
      setError(
        isAr
          ? `مجموع الإنتاجية الموزعة (${formatBaisa(totalAllocatedBaisa)}) يتجاوز إجمالي أجور اليد المعتمدة لأمر الإصلاح (${formatBaisa(roLaborBaisa)}).`
          : `Total allocated labor (${formatBaisa(totalAllocatedBaisa)}) exceeds RO labor charges (${formatBaisa(roLaborBaisa)}).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const input: LaborAllocationInput = {
        repairOrderId: selectedRo?.id,
        vehicleId: selectedRo?.vehicleId,
        workDate,
        workDescription: workDescription.trim(),
        allocations: rows.map((r) => ({
          workerId: r.workerId,
          laborValueBaisa: toBaisa(parseFloat(r.laborValueOmr) || 0),
          hoursSpent: parseFloat(r.hoursSpent) || undefined,
        })),
      };

      const res = await garageApi.allocateLaborProductivity(input);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || (isAr ? 'فشل توزيع الإنتاجية' : 'Failed to allocate labor.'));
      }
    } catch (err: any) {
      console.error('Labor allocation error:', err);
      setError(err?.message || (isAr ? 'حدث خطأ أثناء حفظ التوزيع' : 'Error saving labor allocation.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAr ? 'توزيع إنتاجية أجور اليد والعمل المنجز' : 'Allocate Labor Productivity to Workers'}
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-sm">
        {/* Strict Accounting Rule Notice */}
        <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-start gap-3 text-amber-800 dark:text-amber-300">
          <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold">
              {isAr ? 'قاعدة محاسبية صارمة: ' : 'Strict Accounting Principle: '}
            </span>
            {isAr
              ? 'إنتاجية العامل تعتمد حصريًا على أجور اليد والعمل اليدوي المنجز، وتُستبعد تكاليف قطع الغيار استبعادًا قاطعًا ولا تدخل ضمن الإنتاجية.'
              : 'Worker labor productivity is attributed exclusively to labor/service charges. Spare parts costs are strictly excluded from productivity calculations.'}
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Repair Order Selector & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? 'ربط بأمر إصلاح (اختياري / مفضل)' : 'Link to Repair Order (Optional)'}
            </label>
            <select
              value={selectedRoId}
              onChange={(e) => handleRoChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="">{isAr ? '-- عمل ورشة عام / بدون أمر إصلاح --' : '-- General Workshop Labor --'}</option>
              {repairOrders.map((ro) => (
                <option key={ro.id} value={ro.id}>
                  {ro.roNumber} - {ro.customerName || 'عميل'} ({ro.vehiclePlate || 'مركبة'}) - {isAr ? 'أجور يد:' : 'Labor:'} {formatBaisa(ro.laborTotalBaisa)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? 'تاريخ إنجاز العمل' : 'Work Date'} *
            </label>
            <Input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              required
              className="text-xs"
            />
          </div>
        </div>

        {/* Selected RO Context Banner */}
        {selectedRo && (
          <div className="bg-slate-100 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-slate-900 dark:text-slate-100">
                {isAr ? 'بيانات أمر الإصلاح المختار:' : 'Selected Repair Order:'} {selectedRo.roNumber}
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                {selectedRo.customerName} | {selectedRo.vehiclePlate}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200 dark:border-slate-700 text-center">
              <div>
                <span className="text-[11px] text-slate-500 block">{isAr ? 'أجور اليد القابلة للتوزيع' : 'Total Labor Charge'}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-sm">
                  {formatBaisa(selectedRo.laborTotalBaisa)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">{isAr ? 'قطع الغيار (مستبعدة)' : 'Spare Parts (Excluded)'}</span>
                <span className="font-mono text-slate-500 line-through text-xs">
                  {formatBaisa(selectedRo.partsTotalBaisa)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">{isAr ? 'المتبقي للتوزيع' : 'Remaining Labor'}</span>
                <span className={`font-mono font-bold text-sm ${remainingBudgetBaisa !== null && remainingBudgetBaisa < 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {remainingBudgetBaisa !== null ? formatBaisa(remainingBudgetBaisa) : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Work Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {isAr ? 'وصف العمل المنجز ومهام الصيانة' : 'Work Description / Service Details'} *
          </label>
          <Input
            value={workDescription}
            onChange={(e) => setWorkDescription(e.target.value)}
            placeholder={isAr ? 'مثال: فك وتركيب مجمع الفرامل، تنظيف حساسات الوقود، وزن الأذرعة' : 'e.g. Brake caliper overhaul, sensor cleaning, alignment'}
            required
            className="text-xs"
          />
        </div>

        {/* Worker Allocations List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-500" />
              <span>{isAr ? 'توزيع العمل على الفنيين والعمال' : 'Labor Split Across Workers'}</span>
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              className="text-xs h-7 gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'إضافة عامل إضافي' : 'Add Another Worker'}</span>
            </Button>
          </div>

          <div className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/50">
            {rows.map((row, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                {/* Worker select */}
                <div className="flex-1 min-w-[140px]">
                  <select
                    value={row.workerId}
                    onChange={(e) => handleRowChange(index, 'workerId', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {activeWorkers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.specialty || 'فني'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Labor Value OMR */}
                <div className="w-32">
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.050"
                      min="0.100"
                      value={row.laborValueOmr}
                      onChange={(e) => handleRowChange(index, 'laborValueOmr', e.target.value)}
                      placeholder="0.000"
                      required
                      className="text-xs font-mono pr-2 pl-8 h-8"
                    />
                    <span className="absolute left-2 top-2 text-[10px] text-slate-400 font-mono">OMR</span>
                  </div>
                </div>

                {/* Hours Spent */}
                <div className="w-24">
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={row.hoursSpent}
                      onChange={(e) => handleRowChange(index, 'hoursSpent', e.target.value)}
                      placeholder="ساعات"
                      className="text-xs font-mono pr-2 pl-6 h-8"
                    />
                    <span className="absolute left-2 top-2 text-[10px] text-slate-400 font-mono">hrs</span>
                  </div>
                </div>

                {/* Delete row */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRow(index)}
                  disabled={rows.length === 1}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-rose-500 disabled:opacity-30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}

            {/* Total summary in allocation list */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-xs px-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                {isAr ? 'مجموع الإنتاجية الموزعة:' : 'Total Allocated:'}
              </span>
              <span className={`font-mono font-bold text-sm ${isOverBudget ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {formatBaisa(totalAllocatedBaisa)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-600 dark:text-slate-400 text-xs"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isOverBudget || rows.length === 0}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-2 min-w-[140px]"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{isAr ? 'جارٍ الحفظ...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isAr ? 'حفظ وتثبيت الإنتاجية' : 'Save Allocation'}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
