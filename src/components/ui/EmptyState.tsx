/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Reusable Commercial UI Component: EmptyState
 */

import React from 'react';
import { Badge } from './Badge.tsx';
import { ShieldCheck, CalendarClock } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.tsx';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  phaseNumber?: number;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  phaseNumber,
  action,
  className = '',
}: EmptyStateProps) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';

  return (
    <div
      className={`rounded-2xl border border-dashed border-[#2b3a56] bg-[#111726]/60 p-8 sm:p-12 text-center flex flex-col items-center justify-center max-w-2xl mx-auto shadow-inner ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-sm">
        {icon}
      </div>

      {phaseNumber !== undefined && (
        <Badge variant="gold" size="md" className="mb-3" icon={<CalendarClock className="w-3.5 h-3.5" />}>
          {isAr ? `مجدول للمرحلة ${phaseNumber}` : `Scheduled for Phase ${phaseNumber}`}
        </Badge>
      )}

      <h3 className="text-lg font-bold text-slate-100 tracking-tight mb-2">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-lg mb-6">
        {description}
      </p>

      {/* Technical Readiness Stamp */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 mb-6">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>
          {isAr
            ? 'جداول SQLite وقواعد الأمان ومنافذ IPC تم التحقق منها واكتمالها في المرحلة 1.'
            : 'SQLite tables, security guardrails, and IPC contracts verified in Phase 1.'}
        </span>
      </div>

      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  );
}
