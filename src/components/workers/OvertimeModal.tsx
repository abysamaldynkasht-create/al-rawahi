/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Worker Overtime Intake Modal
 */

import React, { useState, useEffect } from 'react';
import {
  Clock,
  User,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { toBaisa, fromBaisa, formatBaisa } from '../../core/currency.ts';
import type { TechnicianDTO, WorkerOvertimeInput, WorkerOvertimeEntryDTO } from '../../types/ipc.ts';

interface OvertimeModalProps {
  isOpen: boolean;
  workers: TechnicianDTO[];
  preselectedWorkerId?: string;
  editingEntry?: WorkerOvertimeEntryDTO | null;
  onClose: () => void;
  onSave: (input: WorkerOvertimeInput, editingId?: string) => Promise<boolean>;
  isAr: boolean;
}

export function OvertimeModal({
  isOpen,
  workers,
  preselectedWorkerId,
  editingEntry,
  onClose,
  onSave,
  isAr,
}: OvertimeModalProps) {
  const [workerId, setWorkerId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [hours, setHours] = useState('2.0');
  const [customRateOmr, setCustomRateOmr] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingEntry) {
        setWorkerId(editingEntry.workerId);
        setWorkDate(editingEntry.workDate);
        setHours(editingEntry.hours.toString());
        setCustomRateOmr(fromBaisa(editingEntry.hourlyRateBaisa).toFixed(3));
        setNotes(editingEntry.notes || '');
        setError(null);
      } else {
        const activeWorkers = workers.filter((w) => w.isActive);
        const initialId = preselectedWorkerId || (activeWorkers[0] ? activeWorkers[0].id : '');
        setWorkerId(initialId);
        setWorkDate(new Date().toISOString().slice(0, 10));
        setHours('2.0');
        setNotes('');
        setError(null);

        const target = workers.find((w) => w.id === initialId);
        if (target) {
          setCustomRateOmr(fromBaisa(target.overtimeRateBaisa || 2500).toFixed(3));
        }
      }
    }
  }, [isOpen, workers, preselectedWorkerId, editingEntry]);

  const handleWorkerChange = (id: string) => {
    setWorkerId(id);
    const target = workers.find((w) => w.id === id);
    if (target && !editingEntry) {
      setCustomRateOmr(fromBaisa(target.overtimeRateBaisa || 2500).toFixed(3));
    }
  };

  const selectedWorker = workers.find((w) => w.id === workerId);
  const parsedHours = parseFloat(hours) || 0;
  const parsedRateOmr = parseFloat(customRateOmr) || 0;
  const estimatedTotalBaisa = Math.round(parsedHours * toBaisa(parsedRateOmr));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId) {
      setError(isAr ? 'يرجى اختيار العامل / الفني' : 'Worker must be selected');
      return;
    }
    if (parsedHours <= 0 || parsedHours > 24) {
      setError(isAr ? 'عدد الساعات الإضافية يجب أن يكون بين 0.5 و 24 ساعة' : 'Hours must be between 0.5 and 24');
      return;
    }
    if (parsedRateOmr < 0) {
      setError(isAr ? 'سعر الساعة غير صحيح' : 'Invalid hourly rate');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: WorkerOvertimeInput = {
      workerId,
      workDate,
      hours: parsedHours,
      hourlyRateBaisa: toBaisa(parsedRateOmr),
      notes: notes.trim() || undefined,
    };

    const ok = await onSave(payload, editingEntry ? editingEntry.id : undefined);
    setIsSubmitting(false);
    if (ok) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingEntry
          ? isAr
            ? 'تعديل ساعات العمل الإضافي'
            : 'Edit Overtime Entry'
          : isAr
          ? 'تسجيل ساعات عمل إضافية'
          : 'Log Worker Overtime'
      }
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            variant="gold"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
            icon={isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          >
            {isSubmitting
              ? isAr
                ? 'جاري الحفظ...'
                : 'Saving...'
              : editingEntry
              ? isAr
                ? 'حفظ التعديلات'
                : 'Save Changes'
              : isAr
              ? 'تسجيل واعتماد الساعات'
              : 'Confirm Overtime'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            {isAr ? 'العامل / الفني' : 'Worker / Technician'} *
          </label>
          <select
            value={workerId}
            onChange={(e) => handleWorkerChange(e.target.value)}
            className="w-full bg-[#111827] text-slate-100 text-xs rounded-lg border border-[#243048] p-2.5 focus:outline-none focus:border-amber-500 transition-colors"
          >
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} {w.specialty ? `(${w.specialty})` : ''} - {isAr ? 'سعر إضافي:' : 'OT Rate:'} {fromBaisa(w.overtimeRateBaisa || 2500).toFixed(3)} ر.ع
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={isAr ? 'تاريخ العمل الإضافي' : 'Overtime Date'}
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
          />

          <Input
            label={isAr ? 'عدد الساعات الإضافية (ساعة)' : 'Overtime Hours'}
            type="number"
            step="0.5"
            min="0.5"
            max="24"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            dir="ltr"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={isAr ? 'سعر الساعة المعتمد (ر.ع / ساعة)' : 'Hourly Rate (OMR / hr)'}
            type="number"
            step="0.001"
            value={customRateOmr}
            onChange={(e) => setCustomRateOmr(e.target.value)}
            dir="ltr"
          />

          <div className="p-2.5 rounded-lg bg-[#141d2f] border border-[#233148] flex flex-col justify-center">
            <span className="text-[11px] text-slate-400">
              {isAr ? 'إجمالي مستحق هذا الإدخال:' : 'Estimated Overtime Pay:'}
            </span>
            <span className="text-sm font-bold text-amber-400 font-mono">
              {formatBaisa(estimatedTotalBaisa, { arabicLabel: isAr })}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            {isAr ? 'بيان الأعمال والمهام الإضافية المنجزة' : 'Work Description / Tasks'}
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isAr ? 'أعمال صيانة طارئة بعد الدوام الرسمي، تسليم عاجل لمركبة...' : 'Overtime task description...'}
            className="w-full bg-[#111827] text-slate-100 text-xs rounded-lg border border-[#243048] p-2.5 focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
          />
        </div>
      </form>
    </Modal>
  );
}
