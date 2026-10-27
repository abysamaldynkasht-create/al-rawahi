/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Full Customer Profile & Financial/Maintenance History Panel
 */

import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Car,
  Plus,
  Clock,
  Receipt,
  ArrowUpRight,
  Gauge,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { garageApi } from '../services/garageClient.ts';
import type { CustomerDTO, VehicleDTO, RepairOrderDTO, InvoiceDTO } from '../types/ipc.ts';
import { formatOMR, fromBaisa } from '../core/currency.ts';
import { InvoiceDocumentModal } from '../components/InvoiceDocumentModal.tsx';

interface CustomerProfileModalProps {
  customer: CustomerDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onAddVehicleForCustomer?: (customer: CustomerDTO) => void;
  onViewVehicleDetails?: (vehicle: VehicleDTO) => void;
}

export function CustomerProfileModal({
  customer,
  isOpen,
  onClose,
  onAddVehicleForCustomer,
  onViewVehicleDetails,
}: CustomerProfileModalProps) {
  const { lang, t } = useLanguage();
  const isAr = lang === 'ar';

  const [vehicles, setVehicles] = useState<VehicleDTO[]>([]);
  const [repairOrders, setRepairOrders] = useState<RepairOrderDTO[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [activeTab, setActiveTab] = useState<'vehicles' | 'repairs' | 'invoices'>('vehicles');
  const [isLoading, setIsLoading] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceDTO | null>(null);

  useEffect(() => {
    if (!customer || !isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      garageApi.getVehicles({ customerId: customer.id, includeArchived: true }),
      garageApi.getRepairOrders(),
      garageApi.getInvoices(customer.id),
    ])
      .then(([vehRes, roRes, invRes]) => {
        if (!isMounted) return;
        if (vehRes.success && vehRes.data) setVehicles(vehRes.data);
        if (roRes.success && roRes.data) {
          setRepairOrders(roRes.data.filter((ro) => ro.customerId === customer.id));
        }
        if (invRes.success && invRes.data) setInvoices(invRes.data);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [customer, isOpen]);

  if (!isOpen || !customer) return null;

  // Calculate total outstanding balance
  const totalBalanceDueBaisa = invoices.reduce((sum, i) => sum + i.balanceDueBaisa, 0);
  const totalBilledBaisa = invoices.reduce((sum, i) => sum + i.grandTotalBaisa, 0);
  const totalPaidBaisa = invoices.reduce((sum, i) => sum + i.paidAmountBaisa, 0);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-5xl bg-[#0f1624] border border-[#23324d] rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="h-16 bg-[#0a0f18] border-b border-[#1c273a] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>ملف العميل: {customer.fullName}</span>
                <Badge variant={customer.isPermanent ? 'emerald' : 'sky'} size="sm">
                  {customer.isPermanent ? 'عميل دائم' : 'زيارة فردية'}
                </Badge>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                كود العميل: {customer.id.slice(0, 12)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onAddVehicleForCustomer && (
              <Button
                variant="gold"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  onClose();
                  onAddVehicleForCustomer(customer);
                }}
              >
                تسجيل مركبة للعميل
              </Button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Info & Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Contact Details Card */}
            <div className="md:col-span-2 p-4 rounded-xl bg-[#0c121e] border border-[#1e2a3f] space-y-2.5 text-xs">
              <div className="font-bold text-slate-200 border-b border-slate-800 pb-1.5">
                بيانات الاتصال والعنوان
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-slate-400">الهاتف:</span>
                  <span className="font-mono font-bold text-white" dir="ltr">
                    {customer.phone || '—'}
                  </span>
                </div>
                {customer.altPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-slate-400">بديل:</span>
                    <span className="font-mono text-slate-200" dir="ltr">
                      {customer.altPhone}
                    </span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-slate-400">البريد:</span>
                    <span className="text-slate-200 truncate">{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-slate-400">العنوان:</span>
                    <span className="text-slate-200">{customer.address}</span>
                  </div>
                )}
              </div>
              {customer.notes && (
                <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-400">
                  ملاحظات: {customer.notes}
                </div>
              )}
            </div>

            {/* Financial Overview Cards */}
            <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e2a3f] flex flex-col justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">إجمالي الفواتير الصادرة</span>
                <span className="font-mono font-bold text-white text-base mt-1 block">
                  {formatOMR(fromBaisa(totalBilledBaisa))}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800 text-slate-400 text-[11px]">
                تم تحصيل: <span className="font-mono text-emerald-400 font-bold">{formatOMR(fromBaisa(totalPaidBaisa))}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e2a3f] flex flex-col justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">الرصيد المتبقي المستحق</span>
                <span
                  className={`font-mono font-bold text-base mt-1 block ${
                    totalBalanceDueBaisa > 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {formatOMR(fromBaisa(totalBalanceDueBaisa))}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800 text-slate-400 text-[11px]">
                {totalBalanceDueBaisa > 0 ? 'يوجد رصيد مطلوب سداده' : 'الحساب خالص بالكامل'}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-[#1e273a] pb-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('vehicles')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'vehicles'
                  ? 'bg-[#1a2538] text-amber-400 border-b-2 border-amber-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>المركبات المسجلة ({vehicles.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('repairs')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'repairs'
                  ? 'bg-[#1a2538] text-amber-400 border-b-2 border-amber-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>سجل أوامر الصيانة ({repairOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'invoices'
                  ? 'bg-[#1a2538] text-amber-400 border-b-2 border-amber-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>الفواتير والمدفوعات ({invoices.length})</span>
            </button>
          </div>

          {/* Tab 1: Vehicles Grid */}
          {activeTab === 'vehicles' && (
            <div className="space-y-3">
              {vehicles.length === 0 ? (
                <EmptyState
                  icon={<Car className="w-8 h-8 text-slate-500" />}
                  title="لا توجد مركبات مسجلة لهذا العميل"
                  description="يمكنك ربط سيارة جديدة بهذا العميل بنقرة واحدة."
                  action={
                    onAddVehicleForCustomer && (
                      <Button
                        variant="gold"
                        size="sm"
                        onClick={() => {
                          onClose();
                          onAddVehicleForCustomer(customer);
                        }}
                      >
                        تسجيل سيارة الآن
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {vehicles.map((v) => (
                    <div
                      key={v.id}
                      className="p-4 rounded-xl border border-[#22314a] bg-[#0c121e] hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2.5 py-1 rounded bg-black/60 border border-amber-500/50 text-amber-300 font-mono font-bold text-xs">
                            {v.plateNumber}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {v.odometer.toLocaleString()} كم
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-bold text-slate-100">
                          {v.make} {v.model} ({v.year})
                        </div>
                        {v.vin && (
                          <div className="mt-1 text-[11px] text-slate-400 font-mono truncate">
                            VIN: {v.vin}
                          </div>
                        )}
                      </div>

                      {onViewVehicleDetails && (
                        <div className="pt-2 border-t border-slate-800 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                            onClick={() => {
                              onClose();
                              onViewVehicleDetails(v);
                            }}
                          >
                            عرض سجل المركبة
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Real Repair Orders History */}
          {activeTab === 'repairs' && (
            <div className="space-y-3">
              {repairOrders.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  لا توجد أوامر صيانة مسجلة لهذا العميل.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {repairOrders.map((ro) => (
                    <div
                      key={ro.id}
                      className="p-3.5 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-300">{ro.roNumber}</span>
                          <Badge variant="amber" size="sm">
                            {ro.status}
                          </Badge>
                          <span className="text-slate-400 font-mono">اللوحة: {ro.vehiclePlate}</span>
                        </div>
                        <div className="text-slate-300 font-medium">
                          المشكلة: {ro.reportedProblem}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          تاريخ الدخول: {ro.receivedAt ? ro.receivedAt.slice(0, 10) : '—'}
                        </div>
                      </div>

                      <div className="text-left font-mono font-bold text-white text-sm">
                        {formatOMR(fromBaisa(ro.grandTotalBaisa || ro.estimatedCostBaisa))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Real Invoices & Outstanding Balances */}
          {activeTab === 'invoices' && (
            <div className="space-y-3">
              {invoices.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  لا توجد فواتير صادرة لهذا العميل حتى الآن.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {invoices.map((inv) => {
                    const isPaid = inv.status === 'PAID' || inv.balanceDueBaisa <= 0;
                    return (
                      <div
                        key={inv.id}
                        className="p-3.5 rounded-xl bg-[#0c121e] border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white">{inv.invoiceNumber}</span>
                            <Badge variant={isPaid ? 'emerald' : 'amber'} size="sm">
                              {isPaid ? 'مدفوعة' : 'مستحقة'}
                            </Badge>
                            <span className="text-slate-500">{inv.invoiceDate}</span>
                          </div>
                          <div className="text-slate-400 text-[11px]">
                            المركبة: {inv.vehiclePlate || '—'}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-left">
                            <div className="font-mono font-bold text-white">
                              {formatOMR(fromBaisa(inv.grandTotalBaisa))}
                            </div>
                            {inv.balanceDueBaisa > 0 && (
                              <div className="text-[11px] text-red-400 font-mono">
                                المتبقي: {formatOMR(fromBaisa(inv.balanceDueBaisa))}
                              </div>
                            )}
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              const res = await garageApi.getInvoiceById(inv.id);
                              setViewingInvoice(res.success && res.data ? res.data : inv);
                            }}
                          >
                            عرض الفاتورة
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invoice Document Modal */}
      <InvoiceDocumentModal
        invoice={viewingInvoice}
        isOpen={Boolean(viewingInvoice)}
        onClose={() => setViewingInvoice(null)}
      />
    </div>
  );
}
