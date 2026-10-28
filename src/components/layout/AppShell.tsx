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
  ChevronDown,
  ChevronUp,
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

export interface NavSubItem {
  id: RouteId;
  icon: React.ReactNode;
}

export interface NavGroup {
  id: string;
  groupNumber: number;
  labelAr: string;
  labelEn: string;
  badgeLabelAr: string;
  badgeLabelEn: string;
  colorName: 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
  theme: {
    accentText: string;
    borderAccent: string;
    badgeBg: string;
    badgeText: string;
    activeBg: string;
    activeText: string;
    activeBorder: string;
    dotColor: string;
    groupIconColor: string;
  };
  icon: React.ReactNode;
  items: NavSubItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'group1',
    groupNumber: 1,
    labelAr: 'التشغيل والصيانة',
    labelEn: 'Operations & Maintenance',
    badgeLabelAr: 'المجموعة 1',
    badgeLabelEn: 'Group 1',
    colorName: 'emerald',
    theme: {
      accentText: 'text-emerald-400',
      borderAccent: 'border-emerald-500/30',
      badgeBg: 'bg-emerald-500/15',
      badgeText: 'text-emerald-300',
      activeBg: 'bg-gradient-to-r from-emerald-500/25 via-emerald-500/10 to-transparent',
      activeText: 'text-emerald-300',
      activeBorder: 'border-emerald-500/50',
      dotColor: 'bg-emerald-400',
      groupIconColor: 'text-emerald-400',
    },
    icon: <Wrench className="w-4 h-4 text-emerald-400" />,
    items: [
      { id: 'dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'customers', icon: <Users className="w-4 h-4" /> },
      { id: 'vehicles', icon: <Car className="w-4 h-4" /> },
      { id: 'registerMaintenance', icon: <PlusCircle className="w-4 h-4" /> },
      { id: 'vehicleHandover', icon: <FileCheck className="w-4 h-4" /> },
      { id: 'repairOrders', icon: <ClipboardList className="w-4 h-4" /> },
    ],
  },
  {
    id: 'group2',
    groupNumber: 2,
    labelAr: 'الفواتير والتحصيل',
    labelEn: 'Billing & Collections',
    badgeLabelAr: 'المجموعة 2',
    badgeLabelEn: 'Group 2',
    colorName: 'amber',
    theme: {
      accentText: 'text-amber-400',
      borderAccent: 'border-amber-500/30',
      badgeBg: 'bg-amber-500/15',
      badgeText: 'text-amber-300',
      activeBg: 'bg-gradient-to-r from-amber-500/25 via-amber-500/10 to-transparent',
      activeText: 'text-amber-300',
      activeBorder: 'border-amber-500/50',
      dotColor: 'bg-amber-400',
      groupIconColor: 'text-amber-400',
    },
    icon: <Receipt className="w-4 h-4 text-amber-400" />,
    items: [
      { id: 'invoices', icon: <Receipt className="w-4 h-4" /> },
      { id: 'payments', icon: <CreditCard className="w-4 h-4" /> },
    ],
  },
  {
    id: 'group3',
    groupNumber: 3,
    labelAr: 'المخزون والموارد',
    labelEn: 'Inventory & Resources',
    badgeLabelAr: 'المجموعة 3',
    badgeLabelEn: 'Group 3',
    colorName: 'rose',
    theme: {
      accentText: 'text-rose-400',
      borderAccent: 'border-rose-500/30',
      badgeBg: 'bg-rose-500/15',
      badgeText: 'text-rose-300',
      activeBg: 'bg-gradient-to-r from-rose-500/25 via-rose-500/10 to-transparent',
      activeText: 'text-rose-300',
      activeBorder: 'border-rose-500/50',
      dotColor: 'bg-rose-400',
      groupIconColor: 'text-rose-400',
    },
    icon: <Package className="w-4 h-4 text-rose-400" />,
    items: [
      { id: 'technicians', icon: <Wrench className="w-4 h-4" /> },
      { id: 'inventory', icon: <Package className="w-4 h-4" /> },
      { id: 'suppliers', icon: <Truck className="w-4 h-4" /> },
      { id: 'expenses', icon: <TrendingDown className="w-4 h-4" /> },
      { id: 'reports', icon: <BarChart3 className="w-4 h-4" /> },
    ],
  },
  {
    id: 'group4',
    groupNumber: 4,
    labelAr: 'الإدارة والإعدادات',
    labelEn: 'Administration & Settings',
    badgeLabelAr: 'المجموعة 4',
    badgeLabelEn: 'Group 4',
    colorName: 'sky',
    theme: {
      accentText: 'text-sky-400',
      borderAccent: 'border-sky-500/30',
      badgeBg: 'bg-sky-500/15',
      badgeText: 'text-sky-300',
      activeBg: 'bg-gradient-to-r from-sky-500/25 via-sky-500/10 to-transparent',
      activeText: 'text-sky-300',
      activeBorder: 'border-sky-500/50',
      dotColor: 'bg-sky-400',
      groupIconColor: 'text-sky-400',
    },
    icon: <Settings className="w-4 h-4 text-sky-400" />,
    items: [
      { id: 'settings', icon: <Settings className="w-4 h-4" /> },
    ],
  },
  {
    id: 'group5',
    groupNumber: 5,
    labelAr: 'النظام والدعم',
    labelEn: 'System & Support',
    badgeLabelAr: 'المجموعة 5',
    badgeLabelEn: 'Group 5',
    colorName: 'slate',
    theme: {
      accentText: 'text-slate-300',
      borderAccent: 'border-slate-500/30',
      badgeBg: 'bg-slate-500/20',
      badgeText: 'text-slate-300',
      activeBg: 'bg-gradient-to-r from-slate-500/25 via-slate-500/10 to-transparent',
      activeText: 'text-slate-200',
      activeBorder: 'border-slate-500/50',
      dotColor: 'bg-slate-400',
      groupIconColor: 'text-slate-300',
    },
    icon: <Activity className="w-4 h-4 text-slate-300" />,
    items: [
      { id: 'diagnostics', icon: <Activity className="w-4 h-4" /> },
    ],
  },
];

export function AppShell() {
  const { lang, setLang, isRtl, t } = useLanguage();
  const [currentRoute, setCurrentRoute] = useState<RouteId>('dashboard');
  const [techniciansInitialTab, setTechniciansInitialTab] = useState<'workers' | 'overtime' | 'payroll' | 'productivity'>('workers');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [selectedCustomerForVehicle, setSelectedCustomerForVehicle] = useState<string | undefined>(undefined);
  const isDesktop = isDesktopRuntime();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    group1: true,
    group2: true,
    group3: true,
    group4: true,
    group5: true,
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Auto-expand the group of currentRoute if changed
  useEffect(() => {
    const parentGroup = NAV_GROUPS.find((g) => g.items.some((it) => it.id === currentRoute));
    if (parentGroup) {
      setExpandedGroups((prev) => ({
        ...prev,
        [parentGroup.id]: true,
      }));
    }
  }, [currentRoute]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleNavigate = (route: RouteId, subTab?: string) => {
    if (route === 'technicians') {
      if (subTab) {
        setTechniciansInitialTab(subTab as 'workers' | 'overtime' | 'payroll' | 'productivity');
      } else {
        setTechniciansInitialTab('workers');
      }
    }
    setCurrentRoute(route);
    setMobileDrawerOpen(false);
  };

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

  const renderSidebarContent = (isMobile: boolean = false) => (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Garage Branding Header in Sidebar */}
      <div className="p-3 border-b border-[#182233] bg-[#0c121e]">
        <div className="flex items-center gap-3">
          <img
            src="/garage_logo.jpg"
            alt="شعار الرواحي للعناية بالسيارات"
            className="w-10 h-10 object-contain rounded-xl border border-amber-500/40 shadow-sm shrink-0 bg-black/40 p-0.5"
          />
          {(sidebarOpen || isMobile) && (
            <div className="overflow-hidden leading-tight">
              <div className="font-black text-xs text-white tracking-wide truncate">
                الرواحي للعناية بالسيارات
              </div>
              <div className="text-[10px] text-amber-400 font-bold tracking-wider flex items-center gap-1 mt-0.5 truncate">
                <span>AL RAWAHI AUTO CARE</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5 Collapsible Navigation Groups */}
      <nav className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar">
        {NAV_GROUPS.map((group) => {
          const isExpanded = Boolean(expandedGroups[group.id]);
          const hasActiveItem = group.items.some((it) => it.id === currentRoute);
          const groupTitle = isRtl ? group.labelAr : group.labelEn;
          const badgeLabel = isRtl ? group.badgeLabelAr : group.badgeLabelEn;

          if (!sidebarOpen && !isMobile) {
            // Collapsed Icon-Only Mode
            return (
              <div key={group.id} className="flex flex-col items-center py-1 border-b border-slate-800/60 last:border-0">
                <button
                  type="button"
                  onClick={() => {
                    setSidebarOpen(true);
                    setExpandedGroups((prev) => ({ ...prev, [group.id]: true }));
                  }}
                  title={`${badgeLabel} — ${groupTitle}`}
                  className={`p-2 rounded-xl border transition-all ${
                    hasActiveItem
                      ? `${group.theme.badgeBg} ${group.theme.borderAccent} ${group.theme.accentText} shadow-sm`
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-[#162033]'
                  }`}
                >
                  {group.icon}
                </button>
              </div>
            );
          }

          return (
            <div
              key={group.id}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                hasActiveItem
                  ? `${group.theme.borderAccent} bg-[#111827]/90 shadow-sm`
                  : 'border-slate-800/70 bg-[#0e1422]/60 hover:border-slate-700/80'
              }`}
            >
              {/* Group Header (Accordion Toggle) */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`w-full px-3 py-2 flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                  hasActiveItem ? 'bg-slate-800/40' : 'hover:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`p-1.5 rounded-lg ${group.theme.badgeBg} ${group.theme.groupIconColor} shrink-0`}
                  >
                    {group.icon}
                  </span>
                  <div className="flex flex-col text-start min-w-0">
                    <span
                      className={`truncate text-xs tracking-tight ${
                        hasActiveItem ? `${group.theme.accentText} font-black` : 'text-slate-200'
                      }`}
                    >
                      {groupTitle}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {badgeLabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${group.theme.badgeBg} ${group.theme.badgeText}`}
                  >
                    {group.items.length}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </div>
              </button>

              {/* Collapsible Sub-Items */}
              {isExpanded && (
                <div className="px-2 pb-2 pt-1 space-y-1 border-t border-slate-800/60 bg-[#0b101c]/70">
                  {group.items.map((item) => {
                    const meta = ROUTE_REGISTRY[item.id];
                    const isActive = currentRoute === item.id;
                    const label = isRtl ? meta.labelAr : meta.labelEn;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setCurrentRoute(item.id);
                          if (isMobile) setMobileDrawerOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                          isActive
                            ? `${group.theme.activeBg} ${group.theme.activeText} font-bold border ${group.theme.activeBorder} shadow-sm`
                            : 'text-slate-400 hover:text-slate-100 hover:bg-[#162033]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={isActive ? group.theme.accentText : 'text-slate-500'}>
                            {item.icon}
                          </span>
                          <span className="truncate">{label}</span>
                        </div>
                        {isActive && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${group.theme.dotColor} shrink-0 animate-pulse`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Footer Info */}
      {(sidebarOpen || isMobile) ? (
        <div className="p-3 border-t border-[#182233] bg-[#0b0f17]/90 text-[11px] text-slate-500 space-y-1">
          <div className="flex items-center justify-between">
            <span>تطوير: <strong className="text-amber-400">AKASHA AI</strong></span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {isRtl ? 'محمي وآمن' : 'Secured'}
            </span>
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-[#182233] flex justify-center text-slate-600">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
        </div>
      )}
    </div>
  );

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 overflow-hidden"
    >
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[#1c2638] bg-[#0f1522] sticky top-0 z-40 px-3 sm:px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          {/* Toggle Sidebar (Desktop toggle / Mobile drawer open) */}
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileDrawerOpen(true);
              } else {
                setSidebarOpen((prev: boolean) => !prev);
              }
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Breadcrumbs & Quick Home */}
          <nav className="flex items-center gap-1.5 text-xs text-slate-400" aria-label="Breadcrumb">
            <button
              type="button"
              onClick={() => setCurrentRoute('dashboard')}
              className="hover:text-amber-400 transition-colors font-medium"
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
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Slide-Over Drawer Backdrop */}
        {mobileDrawerOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
        )}

        {/* Mobile Slide-Over Drawer */}
        <aside
          className={`md:hidden fixed inset-y-0 start-0 z-50 w-72 bg-[#0d131f] border-e border-[#1c2638] shadow-2xl transform transition-transform duration-300 ease-in-out ${
            mobileDrawerOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full' : '-translate-x-full')
          }`}
        >
          {renderSidebarContent(true)}
        </aside>

        {/* Desktop Sidebar Navigation */}
        <aside
          className={`hidden md:flex ${
            sidebarOpen ? 'w-64' : 'w-16'
          } shrink-0 bg-[#0d131f] border-e border-[#1c2638] flex-col justify-between transition-all duration-200 select-none z-30`}
        >
          {renderSidebarContent(false)}
        </aside>

        {/* Main Workspace Region */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 bg-[#0b0f17]">
          <div className="max-w-7xl mx-auto">
            {currentRoute === 'dashboard' && (
              <DashboardView onNavigate={handleNavigate} />
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
              <TechniciansView onNavigate={handleNavigate} initialTab={techniciansInitialTab} />
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
          <span className="font-semibold text-slate-400">الرواحي للعناية بالسيارات</span>
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
