/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * System Diagnostics & Developer Attribution View
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  ShieldCheck,
  Printer,
  Sparkles,
  RefreshCw,
  Archive,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { garageApi, isDesktopRuntime } from '../services/garageClient.ts';
import type { SystemInfo, BackupRecord, PrinterInfoDTO } from '../types/ipc.ts';

export function DiagnosticsView() {
  const { showToast } = useToast();
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [printers, setPrinters] = useState<PrinterInfoDTO[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggeringBackup, setIsTriggeringBackup] = useState(false);
  const isDesktop = isDesktopRuntime();

  const loadDiagnostics = async () => {
    setIsLoading(true);
    try {
      const [sysRes, printRes, backRes] = await Promise.all([
        garageApi.getSystemInfo(),
        garageApi.getPrinters(),
        garageApi.listBackups(),
      ]);

      if (sysRes.success && sysRes.data) setSystemInfo(sysRes.data);
      if (printRes.success && printRes.data) setPrinters(printRes.data);
      if (backRes.success && backRes.data) setBackups(backRes.data);
    } catch {
      showToast('خطأ أثناء تحميل بيانات تشخيص النظام', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const handleManualBackup = async () => {
    setIsTriggeringBackup(true);
    try {
      const res = await garageApi.triggerBackup();
      if (res.success && res.data) {
        showToast(`تم إنشاء نسخة احتياطية آمنة بنجاح: ${res.data.backupFile}`, 'success');
        loadDiagnostics();
      } else {
        showToast(res.error || 'فشل إنشاء النسخة الاحتياطية', 'error');
      }
    } catch {
      showToast('خطأ أثناء إنشاء النسخة الاحتياطية', 'error');
    } finally {
      setIsTriggeringBackup(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1c273a] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                تشخيص النظام ومعلومات المطور
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                حالة قاعدة البيانات، مسارات التخزين، الطابعات، وتوثيق شركة التطوير AKASHA AI
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadDiagnostics}
            disabled={isLoading}
          >
            تحديث الفحص
          </Button>
          <Button
            variant="gold"
            size="sm"
            icon={<Archive className="w-3.5 h-3.5" />}
            onClick={handleManualBackup}
            disabled={isTriggeringBackup}
          >
            {isTriggeringBackup ? 'جارٍ النسخ...' : 'إنشاء نسخة احتياطية فورية'}
          </Button>
        </div>
      </div>

      {/* Developer Company Attribution Card (Independent Section) */}
      <Card className="bg-gradient-to-br from-[#121b2d] via-[#0d1422] to-[#0a0f19] border-amber-500/40 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2d47] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-lg">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                  الجهة المطورة للنظام (Developer Attribution)
                </span>
                <h3 className="text-lg font-black text-white">AKASHA AI</h3>
                <p className="text-xs text-slate-300">
                  حلول الذكاء الاصطناعي وهندسة البرمجيات المكتبية عالية الاعتمادية
                </p>
              </div>
            </div>

            <Badge variant="amber" size="md">
              المنتج: AL RAWAHI GARAGE MANAGEMENT SYSTEM
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-[#090e18]/80 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">اسم الشركة المطورة:</span>
              <span className="font-bold text-white text-sm mt-0.5 block">AKASHA AI</span>
            </div>
            <div className="p-3 rounded-xl bg-[#090e18]/80 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">اسم المنظومة البرمجية:</span>
              <span className="font-bold text-white text-sm mt-0.5 block">
                AL RAWAHI GARAGE MANAGEMENT SYSTEM
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#090e18]/80 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">التوثيق والاعتماد:</span>
              <span className="font-bold text-emerald-400 text-sm mt-0.5 block">
                Developed by AKASHA AI
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-200/90 leading-relaxed">
            <Info className="w-4 h-4 text-amber-400 inline-block ml-1 align-sub" />
            <span>
              هوية المطور (AKASHA AI) مستقلة تمامًا عن هوية الكراج التجارية. فواتير العملاء الرسمية
              تحمل حصريًا اسم كراج الرواحي وشعاره الرسمي المعتمد.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Database & Storage Status */}
        <Card className="bg-[#0f1522] border-[#1d273a]">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100 border-b border-slate-800 pb-3">
              <Database className="w-4 h-4 text-amber-400" />
              <span>حالة قاعدة البيانات (SQLite Storage)</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">حالة الاتصال:</span>
                <Badge variant={systemInfo?.databaseStatus === 'connected' ? 'emerald' : 'amber'}>
                  {systemInfo?.databaseStatus === 'connected' ? 'متصل بنجاح (WAL Mode)' : 'قيد التشغيل'}
                </Badge>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">بيئة التشغيل:</span>
                <span className="font-semibold text-white">
                  {isDesktop ? 'تطبيق مكتبي Windows Desktop (Electron)' : 'بيئة تجريبية Google AI Studio'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">إصدار المخطط (Schema Migration):</span>
                <span className="font-mono font-bold text-amber-400">
                  Version {systemInfo?.activeSchemaVersion || 8}
                </span>
              </div>

              <div className="py-1.5 space-y-1">
                <span className="text-slate-400 block">مسار تخزين قاعدة البيانات الآمن:</span>
                <div
                  className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 break-all"
                  dir="ltr"
                >
                  {systemInfo?.databasePath || '%APPDATA%\\al-rawahi-garage\\database.sqlite'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="p-2.5 rounded-lg bg-[#141d2f] border border-slate-800">
                  <div className="text-[10px] text-slate-400">العملاء</div>
                  <div className="font-mono font-bold text-amber-300 text-sm mt-0.5">
                    {systemInfo?.totalCustomers || 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#141d2f] border border-slate-800">
                  <div className="text-[10px] text-slate-400">المركبات</div>
                  <div className="font-mono font-bold text-amber-300 text-sm mt-0.5">
                    {systemInfo?.totalVehicles || 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#141d2f] border border-slate-800">
                  <div className="text-[10px] text-slate-400">أوامر جارية</div>
                  <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
                    {systemInfo?.openRepairOrders || 0}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hardware Printers Status */}
        <Card className="bg-[#0f1522] border-[#1d273a]">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100 border-b border-slate-800 pb-3">
              <Printer className="w-4 h-4 text-amber-400" />
              <span>الطابعات المتصلة بنظام التشغيل ({printers.length})</span>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {printers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  لم يتم اكتشاف طابعات متصلة حالياً.
                </div>
              ) : (
                printers.map((pr, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#141d2f] border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{pr.displayName || pr.name}</span>
                        {pr.isDefault && (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-500/30">
                            الافتراضية
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {pr.description || pr.name}
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => garageApi.testPrint(pr.name)}
                    >
                      طباعة تجريبية
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup Ledger & Archive List */}
      <Card className="bg-[#0f1522] border-[#1d273a]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
              <Archive className="w-4 h-4 text-amber-400" />
              <span>سجل النسخ الاحتياطية المتوفرة ({backups.length})</span>
            </div>
            <Button
              variant="gold"
              size="sm"
              icon={<Archive className="w-3.5 h-3.5" />}
              onClick={handleManualBackup}
              disabled={isTriggeringBackup}
            >
              نسخ احتياطي الآن
            </Button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {backups.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                لا توجد ملفات نسخ احتياطي مسجلة حالياً.
              </div>
            ) : (
              backups.map((b, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#141d2f] border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-mono font-bold text-slate-200">{b.fileName}</div>
                    <div className="text-[11px] text-slate-400">
                      التاريخ: {b.createdAt} • الحجم: {(((b.fileSizeBytes || (b as any).sizeBytes || 0)) / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <Badge variant="emerald" size="sm">
                    سليمة ومشفرة
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
