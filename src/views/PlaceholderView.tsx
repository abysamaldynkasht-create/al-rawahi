/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Reusable Placeholder View for Phase 3-9 Modules
 */

import React from 'react';
import {
  Users,
  Car,
  ClipboardList,
  Wrench,
  Package,
  Receipt,
  CreditCard,
  TrendingDown,
  Coins,
  Truck,
  BarChart3,
  Settings,
  ArrowRight,
  ArrowLeft,
  Activity,
  PlusCircle,
  CheckCircle,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { ROUTE_REGISTRY, type RouteId } from '../i18n/translations.ts';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Button } from '../components/ui/Button.tsx';

const ROUTE_ICONS: Record<RouteId, React.ReactNode> = {
  dashboard: <BarChart3 className="w-8 h-8" />,
  customers: <Users className="w-8 h-8" />,
  vehicles: <Car className="w-8 h-8" />,
  registerMaintenance: <PlusCircle className="w-8 h-8" />,
  vehicleHandover: <CheckCircle className="w-8 h-8" />,
  repairOrders: <ClipboardList className="w-8 h-8" />,
  technicians: <Wrench className="w-8 h-8" />,
  inventory: <Package className="w-8 h-8" />,
  invoices: <Receipt className="w-8 h-8" />,
  payments: <CreditCard className="w-8 h-8" />,
  expenses: <TrendingDown className="w-8 h-8" />,
  cashRegister: <Coins className="w-8 h-8" />,
  suppliers: <Truck className="w-8 h-8" />,
  reports: <BarChart3 className="w-8 h-8" />,
  settings: <Settings className="w-8 h-8" />,
  diagnostics: <Activity className="w-8 h-8" />,
};

export function PlaceholderView({
  routeId,
  onNavigate,
}: {
  routeId: RouteId;
  onNavigate: (route: RouteId) => void;
}) {
  const { lang, t } = useLanguage();
  const isAr = lang === 'ar';
  const meta = ROUTE_REGISTRY[routeId];
  const icon = ROUTE_ICONS[routeId] || <Package className="w-8 h-8" />;

  const title = isAr ? meta.labelAr : meta.labelEn;
  const description = isAr ? meta.descriptionAr : meta.descriptionEn;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#1f2b40]">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span className="text-amber-400">{icon}</span>
            <span>{title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate('dashboard')}
            icon={isAr ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          >
            {isAr ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
          </Button>
        </div>
      </div>

      {/* Structured Empty State with Roadmap Information */}
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        phaseNumber={meta.phasePlanned}
        action={
          <Button variant="gold" size="sm" onClick={() => onNavigate('dashboard')}>
            {isAr ? 'استعراض لوحة التحكم' : 'Explore Dashboard'}
          </Button>
        }
      />
    </div>
  );
}
