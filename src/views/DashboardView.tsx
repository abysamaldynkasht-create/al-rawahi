/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Master Dashboard View (Real-time Live Metrics & Module Navigation)
 */

import { useState, useEffect } from 'react';
import {
  Car,
  ClipboardList,
  Clock,
  CheckCircle2,
  TrendingUp,
  Package,
  Receipt,
  Users,
  ShieldCheck,
  CreditCard,
  Truck,
  TrendingDown,
  Wrench,
  DollarSign,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { type RouteId } from '../i18n/translations.ts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { garageApi, isDesktopRuntime } from '../services/garageClient.ts';
import type { CustomerDTO, VehicleDTO, RepairOrderDTO, FinancialReportDTO } from '../types/ipc.ts';
import { formatOMR, fromBaisa } from '../core/currency.ts';

export function DashboardView({ onNavigate }: { onNavigate: (route: RouteId, subTab?: string) => void }) {
  const { lang, t } = useLanguage();
  const isAr = lang === 'ar';
  const isDesktop = isDesktopRuntime();

  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [vehicles, setVehicles] = useState<VehicleDTO[]>([]);
  const [repairOrders, setRepairOrders] = useState<RepairOrderDTO[]>([]);
  const [todayReport, setTodayReport] = useState<FinancialReportDTO | null>(null);
  const [monthReport, setMonthReport] = useState<FinancialReportDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const monthStartStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        const [custRes, vehRes, roRes, todayRepRes, monthRepRes] = await Promise.all([
          garageApi.getCustomers(),
          garageApi.getVehicles(),
          garageApi.getRepairOrders(),
          garageApi.getFinancialReport(todayStr, todayStr),
          garageApi.getFinancialReport(monthStartStr, todayStr),
        ]);

        if (!isMounted) return;
        if (custRes.success && custRes.data) setCustomers(custRes.data);
        if (vehRes.success && vehRes.data) setVehicles(vehRes.data);
        if (roRes.success && roRes.data) setRepairOrders(roRes.data);
        if (todayRepRes.success && todayRepRes.data) setTodayReport(todayRepRes.data);
        if (monthRepRes.success && monthRepRes.data) setMonthReport(monthRepRes.data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const roUnderInspection = repairOrders.filter((r) => r.status === 'UNDER_INSPECTION').length;
  const roAwaitingApproval = repairOrders.filter((r) => r.status === 'AWAITING_APPROVAL').length;
  const roInProgress = repairOrders.filter((r) => r.status === 'IN_PROGRESS' || r.status === 'UNDER_REPAIR').length;
  const roReady = repairOrders.filter((r) => r.status === 'READY_FOR_COLLECTION' || r.status === 'READY_FOR_DELIVERY').length;
  const roCompleted = repairOrders.filter((r) => r.status === 'DELIVERED').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/25 via-[#131b2c] to-[#131b2c] p-4 text-xs flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-300 text-sm">
                AL RAWAHI GARAGE MANAGEMENT SYSTEM
              </span>
              <Badge variant="gold" size="sm">
                {isDesktop ? (isAr ? 'بيئة سطح المكتب SQLite' : 'Desktop SQLite Engine') : (isAr ? 'مستودع تجريبي' : 'Mock Storage')}
              </Badge>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              {isAr ? 'نظام شامل لإدارة ورش صيانة السيارات، أوامر الإصلاح، قطع الغيار والمحاسبة بالريال العُماني OMR' : 'Comprehensive garage maintenance operations, parts ledger, and accounting in Omani Rial OMR'}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('technicians', 'overtime')}
            icon={<Clock className="w-3.5 h-3.5 text-amber-400" />}
          >
            {isAr ? 'ساعات العمل الإضافي' : 'Overtime Hours'}
          </Button>
          <Button
            variant="gold"
            size="sm"
            onClick={() => onNavigate('repairOrders')}
            icon={<ClipboardList className="w-3.5 h-3.5" />}
          >
            {isAr ? 'أمر إصلاح جديد' : 'New Repair Order'}
          </Button>
        </div>
      </div>

      {/* Main Operational KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vehicles in Garage */}
        <Card
          className="hover:border-amber-500/40 transition-colors cursor-pointer"
          onClick={() => onNavigate('vehicles')}
        >
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>{isAr ? 'المركبات المسجلة' : 'Registered Vehicles'}</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Car className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              {vehicles.length}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1e273a]">
              <span>{isAr ? 'العملاء المسجلون' : 'Active Clients'}</span>
              <span className="text-emerald-400 font-medium">{customers.length} {isAr ? 'عميل' : 'Clients'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Vehicles Under Inspection & Work */}
        <Card
          className="hover:border-sky-500/40 transition-colors cursor-pointer"
          onClick={() => onNavigate('repairOrders')}
        >
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>{isAr ? 'قيد الفحص والعمل' : 'In Service & Inspection'}</span>
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                <ClipboardList className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              {roUnderInspection + roInProgress}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1e273a]">
              <span>{isAr ? 'فحص: ' + roUnderInspection : 'Diagnosis: ' + roUnderInspection}</span>
              <span className="text-sky-400 font-medium">{isAr ? 'عمل: ' + roInProgress : 'Active: ' + roInProgress}</span>
            </div>
          </CardContent>
        </Card>

        {/* Awaiting Customer Approval */}
        <Card
          className="hover:border-amber-500/40 transition-colors cursor-pointer"
          onClick={() => onNavigate('repairOrders')}
        >
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>{isAr ? 'بانتظار موافقة العميل' : 'Awaiting Approval'}</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-300 tracking-tight">
              {roAwaitingApproval}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1e273a]">
              <span>{isAr ? 'تسعيرات معلقة' : 'Pending Quotations'}</span>
              <span className="text-amber-400 font-medium">{roAwaitingApproval > 0 ? (isAr ? 'مطلوب تأكيد' : 'Action Required') : (isAr ? 'لا يوجد' : 'None')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Ready for Delivery */}
        <Card
          className="hover:border-emerald-500/40 transition-colors cursor-pointer"
          onClick={() => onNavigate('repairOrders')}
        >
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>{isAr ? 'جاهزة للتسليم والاستلام' : 'Ready for Delivery'}</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-400 tracking-tight">
              {roReady}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#1e273a]">
              <span>{isAr ? 'مكتملة الصيانة' : 'Completed Total'}</span>
              <span className="text-emerald-400 font-medium">{roCompleted} {isAr ? 'أمر' : 'Orders'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Overview (Real Data from Invoices, Payments, Expenses) */}
      <Card>
        <CardHeader>
          <CardTitle icon={<TrendingUp className="w-4 h-4" />}>
            <span>{isAr ? 'المؤشرات المالية (بالريال العُماني OMR)' : 'Financial Indicators (Omani Rial - OMR)'}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="gold" size="sm">
              {isAr ? 'حسابات دقيقة 3 خانات عشرية' : 'Exact 3-Decimal Precision'}
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('reports')}
              icon={<BarChart3 className="w-3.5 h-3.5" />}
            >
              {isAr ? 'عرض كل التقارير' : 'View Full Reports'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Today's Invoiced / Collected */}
            <div className="p-4 rounded-xl bg-[#0f1522] border border-[#1e283d] space-y-1.5">
              <span className="text-xs text-slate-400">{isAr ? 'تحصيل اليوم' : "Today's Collections"}</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {formatOMR(fromBaisa(todayReport?.totalCollectedBaisa || 0), { arabicLabel: isAr, useThousandsSeparator: true })}
              </div>
              <span className="text-[10px] text-slate-500 block">
                {todayReport?.paymentsCount || 0} {isAr ? 'سندات قبض مسجلة اليوم' : 'receipts recorded today'}
              </span>
            </div>

            {/* Outstanding Receivables */}
            <div className="p-4 rounded-xl bg-[#0f1522] border border-[#1e283d] space-y-1.5">
              <span className="text-xs text-slate-400">{isAr ? 'الديون المستحقة قيد التحصيل' : 'Outstanding Receivables'}</span>
              <div className="text-xl font-bold font-mono text-amber-300">
                {formatOMR(fromBaisa(monthReport?.totalOutstandingBaisa || 0), { arabicLabel: isAr, useThousandsSeparator: true })}
              </div>
              <span className="text-[10px] text-slate-500 block">
                {isAr ? 'أرصدة فواتير معلقة لدى العملاء' : 'Unpaid invoices awaiting payment'}
              </span>
            </div>

            {/* Monthly Invoiced */}
            <div className="p-4 rounded-xl bg-[#0f1522] border border-[#1e283d] space-y-1.5">
              <span className="text-xs text-slate-400">{isAr ? 'إجمالي المبيعات والمفوتر للشهر' : 'Monthly Gross Invoiced'}</span>
              <div className="text-xl font-bold font-mono text-white">
                {formatOMR(fromBaisa(monthReport?.totalInvoicedBaisa || 0), { arabicLabel: isAr, useThousandsSeparator: true })}
              </div>
              <span className="text-[10px] text-slate-500 block">
                {monthReport?.invoicesCount || 0} {isAr ? 'فاتورة صادرة هذا الشهر' : 'invoices issued this month'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module Shortcuts Grid */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
          {isAr ? 'أقسام النظام والملاحة السريعة' : 'System Modules & Quick Navigation'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
          <Button
            variant="secondary"
            size="md"
            className="justify-between h-auto py-3.5 px-4"
            onClick={() => onNavigate('customers')}
            icon={<Users className="w-4 h-4 text-amber-400" />}
          >
            <div className="text-start">
              <div className="font-bold text-white text-xs">{isAr ? 'سجل العملاء' : 'Customers'}</div>
              <div className="text-[10px] text-slate-400">{customers.length} {isAr ? 'عميل' : 'Registered'}</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="justify-between h-auto py-3.5 px-4"
            onClick={() => onNavigate('vehicles')}
            icon={<Car className="w-4 h-4 text-amber-400" />}
          >
            <div className="text-start">
              <div className="font-bold text-white text-xs">{isAr ? 'أسطول السيارات' : 'Vehicles'}</div>
              <div className="text-[10px] text-slate-400">{vehicles.length} {isAr ? 'مركبة' : 'Vehicles'}</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="justify-between h-auto py-3.5 px-4"
            onClick={() => onNavigate('repairOrders')}
            icon={<ClipboardList className="w-4 h-4 text-amber-400" />}
          >
            <div className="text-start">
              <div className="font-bold text-white text-xs">{isAr ? 'أوامر الإصلاح' : 'Repair Orders'}</div>
              <div className="text-[10px] text-slate-400">{repairOrders.length} {isAr ? 'أمر صيانة' : 'Orders'}</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="justify-between h-auto py-3.5 px-4"
            onClick={() => onNavigate('inventory')}
            icon={<Package className="w-4 h-4 text-amber-400" />}
          >
            <div className="text-start">
              <div className="font-bold text-white text-xs">{isAr ? 'المخزون وقطع الغيار' : 'Inventory'}</div>
              <div className="text-[10px] text-slate-400">{isAr ? 'حركة القطع والمستودع' : 'Stock & Parts'}</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="justify-between h-auto py-3.5 px-4"
            onClick={() => onNavigate('invoices')}
            icon={<Receipt className="w-4 h-4 text-amber-400" />}
          >
            <div className="text-start">
              <div className="font-bold text-white text-xs">{isAr ? 'الفواتير والطباعة' : 'Invoices'}</div>
              <div className="text-[10px] text-slate-400">{isAr ? 'فواتير ضريبية معتمدة' : 'Tax Invoices & PDF'}</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="justify-between h-auto py-3.5 px-4"
            onClick={() => onNavigate('payments')}
            icon={<CreditCard className="w-4 h-4 text-emerald-400" />}
          >
            <div className="text-start">
              <div className="font-bold text-white text-xs">{isAr ? 'المدفوعات والمقبوضات' : 'Payments'}</div>
              <div className="text-[10px] text-slate-400">{isAr ? 'سندات قبض وأرصدة' : 'Receipt Vouchers'}</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="justify-between h-auto py-3.5 px-4"
            onClick={() => onNavigate('expenses')}
            icon={<TrendingDown className="w-4 h-4 text-rose-400" />}
          >
            <div className="text-start">
              <div className="font-bold text-white text-xs">{isAr ? 'المصروفات والنفقات' : 'Expenses'}</div>
              <div className="text-[10px] text-slate-400">{isAr ? 'إيجارات ورواتب وفواتير' : 'Operating Costs'}</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="justify-between h-auto py-3.5 px-4"
            onClick={() => onNavigate('technicians')}
            icon={<Wrench className="w-4 h-4 text-sky-400" />}
          >
            <div className="text-start">
              <div className="font-bold text-white text-xs">{isAr ? 'الفنيون والورشة' : 'Technicians'}</div>
              <div className="text-[10px] text-slate-400">{isAr ? 'الأجور والمهام' : 'Staff & Labor Rates'}</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="justify-between h-auto py-3.5 px-4 border-amber-500/20 hover:border-amber-500/40"
            onClick={() => onNavigate('technicians', 'overtime')}
            icon={<Clock className="w-4 h-4 text-amber-400" />}
          >
            <div className="text-start">
              <div className="font-bold text-white text-xs">{isAr ? 'ساعات العمل الإضافي' : 'Overtime Hours'}</div>
              <div className="text-[10px] text-slate-400">{isAr ? 'تسجيل واحتساب أجر الساعات' : 'Log & Calculate Overtime'}</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="justify-between h-auto py-3.5 px-4"
            onClick={() => onNavigate('suppliers')}
            icon={<Truck className="w-4 h-4 text-amber-400" />}
          >
            <div className="text-start">
              <div className="font-bold text-white text-xs">{isAr ? 'الموردون والشركات' : 'Suppliers'}</div>
              <div className="text-[10px] text-slate-400">{isAr ? 'حسابات الموردين' : 'Parts Vendors'}</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="justify-between h-auto py-3.5 px-4"
            onClick={() => onNavigate('reports')}
            icon={<BarChart3 className="w-4 h-4 text-amber-400" />}
          >
            <div className="text-start">
              <div className="font-bold text-white text-xs">{isAr ? 'التقارير المالية' : 'Financial Reports'}</div>
              <div className="text-[10px] text-slate-400">{isAr ? 'الأرباح وضريبة 5%' : 'Profit & VAT'}</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="justify-between h-auto py-3.5 px-4"
            onClick={() => onNavigate('settings')}
            icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
          >
            <div className="text-start">
              <div className="font-bold text-white text-xs">{isAr ? 'إعدادات النظام والنسخ' : 'Settings & Backups'}</div>
              <div className="text-[10px] text-slate-400">{isAr ? 'البيانات والنسخ الاحتياطي' : 'Database & Backup'}</div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}
