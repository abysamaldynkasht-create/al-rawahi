/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Master Desktop Shell: Sidebar, Top Bar, Breadcrumbs, Authentication & Routing
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Car,
  ClipboardList,
  Wrench,
  Package,
  Receipt,
  CreditCard,
  TrendingDown,
  Truck,
  BarChart3,
  Settings,
  Globe,
  Database,
  Monitor,
  Calendar,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Menu,
  Shield,
  FileCheck,
  PlusCircle,
  Activity,
  LogOut,
  Lock,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.tsx';
import { ROUTE_REGISTRY, type RouteId } from '../../i18n/translations.ts';
import { DashboardView } from '../../views/DashboardView.tsx';
import { CustomersView } from '../../views/CustomersView.tsx';
import { VehiclesView } from '../../views/VehiclesView.tsx';
import { RegisterMaintenanceView } from '../../views/RegisterMaintenanceView.tsx';
import { VehicleHandoverView } from '../../views/VehicleHandoverView.tsx';
import { RepairOrdersView } from '../../views/RepairOrdersView.tsx';
import { InventoryView } from '../../views/InventoryView.tsx';
import { InvoicesView } from '../../views/InvoicesView.tsx';
import { PaymentsView } from '../../views/PaymentsView.tsx';
import { TechniciansView } from '../../views/TechniciansView.tsx';
import { SuppliersView } from '../../views/SuppliersView.tsx';
import { ExpensesView } from '../../views/ExpensesView.tsx';
import { ReportsView } from '../../views/ReportsView.tsx';
import { SettingsView } from '../../views/SettingsView.tsx';
import { DiagnosticsView } from '../../views/DiagnosticsView.tsx';
import { LoginScreen } from '../LoginScreen.tsx';
import { garageApi, isDesktopRuntime } from '../../services/garageClient.ts';
import type { SystemInfo, AuthSessionDTO } from '../../types/ipc.ts';

interface NavItem {
  id: RouteId;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'customers', icon: <Users className="w-4 h-4" /> },
  { id: 'vehicles', icon: <Car className="w-4 h-4" /> },
  { id: 'registerMaintenance', icon: <PlusCircle className="w-4 h-4" /> },
  { id: 'vehicleHandover', icon: <FileCheck className="w-4 h-4" /> },
  { id: 'repairOrders', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'invoices', icon: <Receipt className="w-4 h-4" /> },
  { id: 'payments', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'technicians', icon: <Wrench className="w-4 h-4" /> },
  { id: 'inventory', icon: <Package className="w-4 h-4" /> },
  { id: 'suppliers', icon: <Truck className="w-4 h-4" /> },
  { id: 'expenses', icon: <TrendingDown className="w-4 h-4" /> },
  { id: 'reports', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'settings', icon: <Settings className="w-4 h-4" /> },
  { id: 'diagnostics', icon: <Activity className="w-4 h-4" /> },
];

export function AppShell() {
  const { lang, setLang, isRtl, t } = useLanguage();
  const [currentRoute, setCurrentRoute] = useState<RouteId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [selectedCustomerForVehicle, setSelectedCustomerForVehicle] = useState<string | undefined>(undefined);
  const isDesktop = isDesktopRuntime();

  // Authentication & Session Lock State
  const [session, setSession] = useState<AuthSessionDTO | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Listen for operating system workstation lock events
  useEffect(() => {
    if (typeof window !== 'undefined' && window.garageApi?.onSessionLocked) {
      const cleanup = window.garageApi.onSessionLocked(() => {
        setIsLocked(true);
      });
      return cleanup;
    }
  }, []);

  // Load real runtime health check
  useEffect(() => {
    let active = true;
    garageApi.getSystemInfo().then((res) => {
      if (active && res.success && res.data) {
        setSystemInfo(res.data);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Format today's date in local language
  const todayFormatted = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-OM' : 'en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  const currentMeta = ROUTE_REGISTRY[currentRoute] || ROUTE_REGISTRY.dashboard;

  // Render LoginScreen if not authenticated
  if (!session) {
    return (
      <LoginScreen
        onLoginSuccess={(newSession) => {
          setSession(newSession);
          setIsLocked(false);
        }}
      />
    );
  }

  // Render LockScreen if workstation session is locked
  if (isLocked) {
    return (
      <LoginScreen
        isLockedSession
        lockedUsername={session.username}
        onLoginSuccess={() => {
          setIsLocked(false);
        }}
      />
    );
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 overflow-hidden"
    >
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[#1c2638] bg-[#0f1522] sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs text-slate-400" aria-label="Breadcrumb">
            <button
              type="button"
              onClick={() => setCurrentRoute('dashboard')}
              className="hover:text-amber-400 transition-colors"
            >
              {t('home')}
            </button>
            {isRtl ? <ChevronLeft className="w-3.5 h-3.5 text-slate-600" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
            <span className="font-semibold text-slate-100">
              {isRtl ? currentMeta.labelAr : currentMeta.labelEn}
            </span>
          </nav>
        </div>

        {/* Header Right Utility Strip */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          {/* Real Runtime / Database Health Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium text-[11px] ${
              isDesktop
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
            }`}
          >
            {isDesktop ? <Monitor className="w-3.5 h-3.5 text-emerald-400" /> : <Database className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden sm:inline">
              {isDesktop ? 'Windows SQLite' : 'AI Studio Preview'}
            </span>
          </div>

          {/* Current Date */}
          <div className="hidden md:flex items-center gap-1.5 text-slate-400 text-[11px] px-2 py-1 rounded bg-slate-900/60 border border-slate-800/80">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{todayFormatted}</span>
          </div>

          {/* User / Operator Display */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800/80">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono font-bold text-white">{session.username}</span>
          </div>

          {/* Lock Session Button */}
          <button
            type="button"
            onClick={() => setIsLocked(true)}
            className="p-1.5 rounded-lg bg-[#182133] hover:bg-[#202b42] border border-[#26344f] text-slate-300 hover:text-amber-400 transition-colors"
            title="قفل الشاشة مؤقتًا"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>

          {/* Logout Button */}
          <button
            type="button"
            onClick={() => setSession(null)}
            className="p-1.5 rounded-lg bg-[#182133] hover:bg-red-950/50 border border-[#26344f] text-slate-300 hover:text-red-400 transition-colors"
            title="تسجيل الخروج"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>

          {/* Language Toggle */}
          <button
            type="button"
            onClick={() => setLang(isRtl ? 'en' : 'ar')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#182133] hover:bg-[#202b42] border border-[#26344f] text-slate-200 text-xs font-semibold transition-all focus:outline-none focus:ring-1 focus:ring-amber-500"
            aria-label="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRtl ? 'English' : 'العربية'}</span>
          </button>
        </div>
      </header>

      {/* Main Container: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-16'
          } shrink-0 bg-[#0d131f] border-e border-[#1c2638] flex flex-col justify-between transition-all duration-200 select-none z-30`}
        >
          {/* Garage Branding Header in Sidebar */}
          <div className="p-3 border-b border-[#182233]">
            <div className="flex items-center gap-3">
              <img
                src="/garage_logo.jpg"
                alt="شعار كراج الرواحي"
                className="w-9 h-9 object-contain rounded-lg border border-amber-500/40 shadow-sm shrink-0"
              />
              {sidebarOpen && (
                <div className="overflow-hidden leading-tight">
                  <div className="font-extrabold text-xs text-white tracking-wide truncate">
                    كراج الرواحي
                  </div>
                  <div className="text-[10px] text-amber-400 font-medium tracking-wider flex items-center gap-1 mt-0.5 truncate">
                    <span>AL RAWAHI AUTO CARE</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Nav Items List */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const meta = ROUTE_REGISTRY[item.id];
              const isActive = currentRoute === item.id;
              const label = isRtl ? meta.labelAr : meta.labelEn;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentRoute(item.id)}
                  title={!sidebarOpen ? label : undefined}
                  className={`w-full flex items-center ${
                    sidebarOpen ? 'justify-between px-3' : 'justify-center px-0'
                  } py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-amber-300 font-bold border border-amber-500/40 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#151d2c]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={isActive ? 'text-amber-400' : 'text-slate-500'}>
                      {item.icon}
                    </span>
                    {sidebarOpen && <span className="truncate">{label}</span>}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer Info */}
          {sidebarOpen ? (
            <div className="p-3 border-t border-[#182233] bg-[#0b0f17]/50 text-[11px] text-slate-500 space-y-1">
              <div className="flex items-center justify-between">
                <span>تطوير: <strong className="text-amber-400">AKASHA AI</strong></span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {isRtl ? 'آمن' : 'Secured'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-2 border-t border-[#182233] flex justify-center text-slate-600">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          )}
        </aside>

        {/* Main Workspace Region */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#0b0f17]">
          <div className="max-w-7xl mx-auto">
            {currentRoute === 'dashboard' && (
              <DashboardView onNavigate={(route) => setCurrentRoute(route)} />
            )}
            {currentRoute === 'customers' && (
              <CustomersView
                onNavigate={(route) => setCurrentRoute(route)}
                onSelectCustomerForVehicle={(c) => {
                  setSelectedCustomerForVehicle(c.id);
                  setCurrentRoute('vehicles');
                }}
              />
            )}
            {currentRoute === 'vehicles' && (
              <VehiclesView
                onNavigate={(route) => setCurrentRoute(route)}
                initialCustomerId={selectedCustomerForVehicle}
              />
            )}
            {currentRoute === 'registerMaintenance' && (
              <RegisterMaintenanceView onNavigate={(route) => setCurrentRoute(route)} />
            )}
            {currentRoute === 'vehicleHandover' && (
              <VehicleHandoverView onNavigate={(route) => setCurrentRoute(route)} />
            )}
            {currentRoute === 'repairOrders' && (
              <RepairOrdersView onNavigate={(route) => setCurrentRoute(route)} />
            )}
            {currentRoute === 'inventory' && (
              <InventoryView onNavigate={(route) => setCurrentRoute(route)} />
            )}
            {currentRoute === 'invoices' && (
              <InvoicesView onNavigate={(route) => setCurrentRoute(route)} />
            )}
            {currentRoute === 'payments' && (
              <PaymentsView onNavigate={(route) => setCurrentRoute(route)} />
            )}
            {currentRoute === 'technicians' && (
              <TechniciansView onNavigate={(route) => setCurrentRoute(route)} />
            )}
            {currentRoute === 'suppliers' && (
              <SuppliersView onNavigate={(route) => setCurrentRoute(route)} />
            )}
            {currentRoute === 'expenses' && (
              <ExpensesView onNavigate={(route) => setCurrentRoute(route)} />
            )}
            {currentRoute === 'reports' && (
              <ReportsView onNavigate={(route) => setCurrentRoute(route)} />
            )}
            {currentRoute === 'settings' && (
              <SettingsView onNavigate={(route) => setCurrentRoute(route)} />
            )}
            {currentRoute === 'diagnostics' && (
              <DiagnosticsView />
            )}
          </div>
        </main>
      </div>

      {/* Global Application Footer */}
      <footer className="h-8 border-t border-[#182233] bg-[#0c111a] px-4 flex items-center justify-between text-[11px] text-slate-500 z-30">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">كراج الرواحي للعناية بالسيارات</span>
          <span>•</span>
          <span>مسقط، سلطنة عُمان</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{t('developerLabel')}</span>
          <span className="text-amber-400 font-bold">{t('developerName')}</span>
          <span>•</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}
