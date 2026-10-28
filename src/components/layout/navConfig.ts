import { type RouteId } from '../../i18n/translations.ts';

export interface NavGroupConfig {
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
  iconName: string;
  items: { id: RouteId; iconName: string }[];
}

export const NAV_GROUPS_CONFIG: NavGroupConfig[] = [
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
    iconName: 'Wrench',
    items: [
      { id: 'dashboard', iconName: 'LayoutDashboard' },
      { id: 'customers', iconName: 'Users' },
      { id: 'vehicles', iconName: 'Car' },
      { id: 'registerMaintenance', iconName: 'PlusCircle' },
      { id: 'vehicleHandover', iconName: 'FileCheck' },
      { id: 'repairOrders', iconName: 'ClipboardList' },
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
    iconName: 'Receipt',
    items: [
      { id: 'invoices', iconName: 'Receipt' },
      { id: 'payments', iconName: 'CreditCard' },
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
    iconName: 'Boxes',
    items: [
      { id: 'technicians', iconName: 'UserCheck' },
      { id: 'inventory', iconName: 'Boxes' },
      { id: 'suppliers', iconName: 'Truck' },
      { id: 'expenses', iconName: 'Wallet' },
      { id: 'reports', iconName: 'BarChart3' },
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
    iconName: 'Settings',
    items: [
      { id: 'settings', iconName: 'Settings' },
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
      badgeBg: 'bg-slate-500/15',
      badgeText: 'text-slate-300',
      activeBg: 'bg-gradient-to-r from-slate-500/25 via-slate-500/10 to-transparent',
      activeText: 'text-slate-200',
      activeBorder: 'border-slate-500/50',
      dotColor: 'bg-slate-400',
      groupIconColor: 'text-slate-400',
    },
    iconName: 'ShieldAlert',
    items: [
      { id: 'diagnostics', iconName: 'ShieldAlert' },
    ],
  },
];
