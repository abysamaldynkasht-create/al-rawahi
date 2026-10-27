/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Worker Intake & Compensation Settings Modal
 */

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  DollarSign,
  Phone,
  Calendar,
  CreditCard,
  User,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { toBaisa, fromBaisa } from '../../core/currency.ts';
import type { TechnicianDTO, TechnicianInput } from '../../types/ipc.ts';

interface WorkerModalProps {
  isOpen: boolean;
  worker: TechnicianDTO | null;
  onClose: () => void;
  onSave: (input: TechnicianInput) => Promise<boolean>;
  isAr: boolean;
}

export function WorkerModal({ isOpen, worker, onClose, onSave, isAr }: WorkerModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<'ACTIVE' | 'ON_LEAVE' | 'TERMINATED'>('ACTIVE');
  const [baseSalaryOmr, setBaseSalaryOmr] = useState('350.000');
  const [overtimeRateOmr, setOvertimeRateOmr] = useState('2.500');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (worker) {
      setName(worker.name);
      setPhone(worker.phone || '');
      setSpecialty(worker.specialty || '');
      setNationalId(worker.nationalId || '');
      setHireDate(worker.hireDate || new Date().toISOString().slice(0, 10));
      setEmploymentStatus(worker.employmentStatus || (worker.isActive ? 'ACTIVE' : 'TERMINATED'));
      setBaseSalaryOmr(fromBaisa(worker.monthlyBaseSalaryBaisa || 350000).toFixed(3));
      setOvertimeRateOmr(fromBaisa(worker.overtimeRateBaisa || 2500).toFixed(3));
      setNotes(worker.notes || '');
    } else {
      setName('');
      setPhone('');
      setSpecialty(isAr ? 'ميكانيكي عام ومحركات' : 'General Mechanic');
      setNationalId('');
      setHireDate(new Date().toISOString().slice(0, 10));
      setEmploymentStatus('ACTIVE');
      setBaseSalaryOmr('350.000');
      setOvertimeRateOmr('2.500');
      setNotes('');
    }
    setError(null);
  }, [worker, isOpen, isAr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(isAr ? 'يرجى إدخال اسم العامل / الفني' : 'Worker name is required');
      return;
    }

    const baseSalaryNum = parseFloat(baseSalaryOmr);
    const overtimeRateNum = parseFloat(overtimeRateOmr);

    if (isNaN(baseSalaryNum) || baseSalaryNum < 0) {
      setError(isAr ? 'قيمة الراتب الأساسي غير صحيحة' : 'Invalid base salary amount');
      return;
    }
    if (isNaN(overtimeRateNum) || overtimeRateNum < 0) {
      setError(isAr ? 'سعر الساعة الإضافية غير صحيح' : 'Invalid overtime rate amount');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: TechnicianInput = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      specialty: specialty.trim() || undefined,
      nationalId: nationalId.trim() || undefined,
      hireDate: hireDate || new Date().toISOString().slice(0, 10),
      employmentStatus,
      isActive: employmentStatus === 'ACTIVE',
      monthlyBaseSalaryBaisa: toBaisa(baseSalaryNum),
      overtimeRateBaisa: toBaisa(overtimeRateNum),
      notes: notes.trim() || undefined,
    };

    const ok = await onSave(payload);
    setIsSubmitting(false);
    if (ok) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={worker ? (isAr ? 'تعديل بيانات العامل / الفني' : 'Edit Worker Profile') : (isAr ? 'تسجيل عامل / فني جديد' : 'Register New Worker')}
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
            {isSubmitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ البيانات التعاقدية' : 'Save Worker Profile')}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={(isAr ? 'اسم العامل / الفني الكامل' : 'Full Worker Name') + ' *'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isAr ? 'مثال: أحمد البلوشي' : 'e.g., Ahmed Al Balushi'}
            autoFocus
          />

          <Input
            label={isAr ? 'رقم الهاتف / الواتساب' : 'Phone / WhatsApp'}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+968 91234567"
            dir="ltr"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={isAr ? 'التخصص الفني' : 'Specialty / Role'}
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder={isAr ? 'ميكانيكا عامة / كهرباء وبرمجة' : 'General Mechanic / Auto Electrician'}
          />

          <Input
            label={isAr ? 'الرقم المدني / رقم الجواز' : 'Civil / Passport ID'}
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
            placeholder="10928374"
            dir="ltr"
          />
        </div>

        <div className="p-3.5 rounded-xl bg-[#141d2f] border border-[#233148] space-y-3">
          <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            <span>{isAr ? 'البنود المالية والتعاقدية (الريال العُماني)' : 'Contractual Financial Terms (OMR)'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={(isAr ? 'الراتب الأساسي الشهري (ر.ع)' : 'Monthly Base Salary (OMR)') + ' *'}
              type="number"
              step="0.001"
              value={baseSalaryOmr}
              onChange={(e) => setBaseSalaryOmr(e.target.value)}
              placeholder="350.000"
              dir="ltr"
            />

            <Input
              label={(isAr ? 'أجر الساعة الإضافية (ر.ع / ساعة)' : 'Overtime Rate / Hour (OMR)') + ' *'}
              type="number"
              step="0.001"
              value={overtimeRateOmr}
              onChange={(e) => setOvertimeRateOmr(e.target.value)}
              placeholder="2.500"
              dir="ltr"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            {isAr
              ? 'ملاحظة: تُحفظ مبالغ الرواتب والساعات الإضافية بدقة البيسة الصحيحة، ويتم حفظ لقطة تاريخية (Snapshot) عند اعتماد كل مسير.'
              : 'Amounts are stored in integer Baisa precision. Historical snapshots protect past payrolls when wages change.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={isAr ? 'تاريخ التعيين والالتحاق' : 'Hire Date'}
            type="date"
            value={hireDate}
            onChange={(e) => setHireDate(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              {isAr ? 'الحالة الوظيفية' : 'Employment Status'}
            </label>
            <select
              value={employmentStatus}
              onChange={(e) => setEmploymentStatus(e.target.value as any)}
              className="w-full bg-[#111827] text-slate-100 text-xs rounded-lg border border-[#243048] p-2.5 focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value="ACTIVE">{isAr ? 'على رأس العمل (نشط)' : 'Active Employment'}</option>
              <option value="ON_LEAVE">{isAr ? 'إجازة رسمية' : 'On Leave'}</option>
              <option value="TERMINATED">{isAr ? 'منتهي الخدمة' : 'Terminated'}</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            {isAr ? 'ملاحظات وتفاصيل إضافية' : 'Notes & Remarks'}
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isAr ? 'شهادات الخبرة، الكفالة، أو أي شروط عمل إضافية...' : 'Experience, sponsorship, or custom terms...'}
            className="w-full bg-[#111827] text-slate-100 text-xs rounded-lg border border-[#243048] p-2.5 focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
          />
        </div>
      </form>
    </Modal>
  );
}
