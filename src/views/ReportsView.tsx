/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Garage Financial & Operational Reporting View
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Printer,
  Sparkles,
  ClipboardList,
  Wrench,
  Package,
  Layers,
  Percent,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { type RouteId } from '../i18n/translations.ts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { garageApi } from '../services/garageClient.ts';
import type { FinancialReportDTO } from '../types/ipc.ts';
import { formatOMR, fromBaisa } from '../core/currency.ts';

export function ReportsView({ onNavigate: _onNavigate }: { onNavigate?: (route: RouteId) => void }) {
  const { lang, isRtl } = useLanguage();
  const isAr = lang === 'ar';

  const [datePreset, setDatePreset] = useState<'month' | 'today' | 'week' | 'year' | 'all'>('month');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<FinancialReportDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyPreset = (preset: 'month' | 'today' | 'week' | 'year' | 'all') => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'year') {
      const d = new Date(now.getFullYear(), 0, 1);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate('2020-01-01');
      setEndDate(todayStr);
    }
  };

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const res = await garageApi.getFinancialReport(startDate, endDate);
      if (res.success && res.data) {
        setReport(res.data);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const netIncomeBaisa = report ? report.netIncomeBaisa : 0;
  const isProfit = netIncomeBaisa >= 0;

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <span>{isAr ? 'التقارير المالية والتشغيلية' : 'Financial & Operational Reports'}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAr
              ? 'تحليل إيرادات الصيانة، ضريبة القيمة المضافة 5%، صافي الأرباح وحركة قطع الغيار'
              : 'Analyze garage revenue, Oman 5% VAT, net profit margin, and parts turnover'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handlePrint}
            icon={<Printer className="w-4 h-4" />}
          >
            <span>{isAr ? 'طباعة التقرير' : 'Print Statement'}</span>
          </Button>
        </div>
      </div>

      {/* Date Filter Card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => applyPreset('today')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  datePreset === 'today'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-[#141c2c] text-slate-300 hover:bg-[#1a253a]'
                }`}
              >
                {isAr ? 'اليوم' : 'Today'}
              </button>
              <button
                type="button"
                onClick={() => applyPreset('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  datePreset === 'week'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-[#141c2c] text-slate-300 hover:bg-[#1a253a]'
                }`}
              >
                {isAr ? 'آخر 7 أيام' : 'Last 7 Days'}
              </button>
              <button
                type="button"
                onClick={() => applyPreset('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  datePreset === 'month'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-[#141c2c] text-slate-300 hover:bg-[#1a253a]'
                }`}
              >
                {isAr ? 'الشهر الحالي' : 'This Month'}
              </button>
              <button
                type="button"
                onClick={() => applyPreset('year')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  datePreset === 'year'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-[#141c2c] text-slate-300 hover:bg-[#1a253a]'
                }`}
              >
                {isAr ? 'السنة الحالية' : 'This Year'}
              </button>
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  datePreset === 'all'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-[#141c2c] text-slate-300 hover:bg-[#1a253a]'
                }`}
              >
                {isAr ? 'كامل السجل' : 'All Time'}
              </button>
            </div>

            {/* Custom Range */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#0c111a] border border-[#1e283d] rounded-lg px-2.5 py-1 text-xs">
                <span className="text-slate-500 text-[11px]">{isAr ? 'من:' : 'From:'}</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setDatePreset('month');
                    setStartDate(e.target.value);
                  }}
                  className="bg-transparent text-white focus:outline-none font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-[#0c111a] border border-[#1e283d] rounded-lg px-2.5 py-1 text-xs">
                <span className="text-slate-500 text-[11px]">{isAr ? 'إلى:' : 'To:'}</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setDatePreset('month');
                    setEndDate(e.target.value);
                  }}
                  className="bg-transparent text-white focus:outline-none font-mono text-[11px]"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Financial Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <Card className="hover:border-amber-500/40 transition-colors">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>{isAr ? 'إجمالي المفوتر' : 'Gross Invoiced'}</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-white tracking-tight">
              {formatOMR(fromBaisa(report?.totalInvoicedBaisa || 0), { arabicLabel: isAr, useThousandsSeparator: true })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1e273a]">
              <span>{isAr ? 'عدد الفواتير الصادرة' : 'Issued Invoices'}</span>
              <span className="text-amber-400 font-semibold">{report?.invoicesCount || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Collected */}
        <Card className="hover:border-emerald-500/40 transition-colors">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>{isAr ? 'المقبوضات المحصلة' : 'Net Collected'}</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
              {formatOMR(fromBaisa(report?.totalCollectedBaisa || 0), { arabicLabel: isAr, useThousandsSeparator: true })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1e273a]">
              <span>{isAr ? 'سندات القبض' : 'Receipt Vouchers'}</span>
              <span className="text-emerald-400 font-semibold">{report?.paymentsCount || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card className="hover:border-rose-500/40 transition-colors">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>{isAr ? 'المصروفات التشغيلية' : 'Operating Expenses'}</span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-rose-400 tracking-tight">
              {formatOMR(fromBaisa(report?.totalExpensesBaisa || 0), { arabicLabel: isAr, useThousandsSeparator: true })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1e273a]">
              <span>{isAr ? 'أوامر الصيانة المكتملة' : 'Completed Orders'}</span>
              <span className="text-amber-400 font-semibold">{report?.completedOrdersCount || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="hover:border-sky-500/40 transition-colors">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>{isAr ? 'صافي الدخل التشغيلي' : 'Net Operating Profit'}</span>
              <div className={`p-1.5 rounded-lg ${isProfit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>
            <div className={`text-2xl font-black font-mono tracking-tight ${isProfit ? 'text-emerald-300' : 'text-rose-400'}`}>
              {formatOMR(fromBaisa(Math.abs(netIncomeBaisa)), { arabicLabel: isAr, useThousandsSeparator: true })}
              {!isProfit && ` (${isAr ? 'عجز' : 'Deficit'})`}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1e273a]">
              <span>{isAr ? 'التحصيل - النفقات' : 'Cash Flow Margin'}</span>
              <span className={`font-semibold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isProfit ? (isAr ? 'ربح صافٍ' : 'Net Surplus') : (isAr ? 'سالب' : 'Loss')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax & Breakdown Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tax & Receivables Card */}
        <Card>
          <CardHeader>
            <CardTitle icon={<Percent className="w-4 h-4" />}>
              <span>{isAr ? 'المستحقات وضريبة القيمة المضافة (5% سلطنة عُمان)' : 'VAT & Accounts Receivable (Oman 5%)'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0f1522] border border-[#1e283d]">
              <div>
                <span className="text-xs text-slate-400 block">{isAr ? 'ضريبة القيمة المضافة المحصلة (VAT 5%)' : 'Oman VAT 5% Collected'}</span>
                <span className="text-[10px] text-slate-500">{isAr ? 'التزام ضريبي مستحق للإقرار' : 'Tax liability on completed invoices'}</span>
              </div>
              <div className="text-base font-bold font-mono text-amber-400">
                {formatOMR(fromBaisa(report?.totalVatBaisa || 0), { arabicLabel: isAr, useThousandsSeparator: true })}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0f1522] border border-[#1e283d]">
              <div>
                <span className="text-xs text-slate-400 block">{isAr ? 'الديون المستحقة قيد التحصيل' : 'Outstanding Receivables'}</span>
                <span className="text-[10px] text-slate-500">{isAr ? 'أرصدة فواتير معلقة لدى العملاء' : 'Unpaid invoice balance'}</span>
              </div>
              <div className="text-base font-bold font-mono text-rose-300">
                {formatOMR(fromBaisa(report?.totalOutstandingBaisa || 0), { arabicLabel: isAr, useThousandsSeparator: true })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Mix Card */}
        <Card>
          <CardHeader>
            <CardTitle icon={<Layers className="w-4 h-4" />}>
              <span>{isAr ? 'توزيع مصادر الإيرادات' : 'Revenue Source Breakdown'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0f1522] border border-[#1e283d]">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-sky-400" />
                <div>
                  <span className="text-xs text-slate-200 font-semibold block">{isAr ? 'أجور اليد العاملة والصيانة' : 'Labor & Services'}</span>
                  <span className="text-[10px] text-slate-500">{isAr ? 'إصلاح ميكانيكي وكهربائي' : 'Mechanic & diagnostic fees'}</span>
                </div>
              </div>
              <div className="text-base font-bold font-mono text-sky-400">
                {formatOMR(fromBaisa(report?.totalLaborBaisa || 0), { arabicLabel: isAr, useThousandsSeparator: true })}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0f1522] border border-[#1e283d]">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-xs text-slate-200 font-semibold block">{isAr ? 'مبيعات قطع الغيار والزيوت' : 'Spare Parts & Consumables'}</span>
                  <span className="text-[10px] text-slate-500">{isAr ? 'فلاتر، قطع، سوائل' : 'Inventory components issued'}</span>
                </div>
              </div>
              <div className="text-base font-bold font-mono text-amber-400">
                {formatOMR(fromBaisa(report?.totalPartsBaisa || 0), { arabicLabel: isAr, useThousandsSeparator: true })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Moving Spare Parts Table */}
      <Card>
        <CardHeader>
          <CardTitle icon={<Package className="w-4 h-4" />}>
            <span>{isAr ? 'أكثر قطع الغيار حركة ومبيعًا' : 'Top Moving Spare Parts'}</span>
          </CardTitle>
          <Badge variant="gold" size="sm">
            {isAr ? 'حركة المخزون' : 'Fast Movers'}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-[#1c2638] bg-[#0c121d] text-slate-400">
                  <th className="p-3 text-start font-semibold">{isAr ? 'رقم القطعة / الباركود' : 'Part Number'}</th>
                  <th className="p-3 text-start font-semibold">{isAr ? 'اسم القطعة' : 'Description'}</th>
                  <th className="p-3 text-center font-semibold">{isAr ? 'الكمية المنصرفة' : 'Quantity Sold'}</th>
                  <th className="p-3 text-end font-semibold">{isAr ? 'إجمالي المبيعات' : 'Total Revenue'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172030]">
                {!report?.topMovingParts || report.topMovingParts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500">
                      {isAr ? 'لا توجد بيانات حركة قطع خلال الفترة المحددة' : 'No parts movement recorded in this period'}
                    </td>
                  </tr>
                ) : (
                  report.topMovingParts.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#121927] transition-colors">
                      <td className="p-3 font-mono font-bold text-amber-300">
                        {item.partCode}
                      </td>
                      <td className="p-3 font-semibold text-white">
                        {item.partName}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-200">
                        {item.quantity}
                      </td>
                      <td className="p-3 text-end font-mono font-bold text-emerald-400">
                        {formatOMR(fromBaisa(item.totalRevenueBaisa), { arabicLabel: isAr, useThousandsSeparator: true })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
