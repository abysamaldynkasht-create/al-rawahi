/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * System Settings, Printers & Security Management View
 */

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Building2,
  Save,
  RefreshCw,
  Download,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Hash,
  Clock,
  HardDrive,
  Receipt,
  Phone,
  Mail,
  MapPin,
  Printer,
  KeyRound,
  Lock,
  User,
  ShieldAlert,
  Image,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { garageApi, isDesktopRuntime } from '../services/garageClient.ts';
import type { BackupRecord, SystemInfo, PrinterInfoDTO } from '../types/ipc.ts';

export function SettingsView({ onNavigate }: { onNavigate?: (route: any) => void }) {
  const { lang, t } = useLanguage();
  const isAr = lang === 'ar';
  const { showToast } = useToast();
  const isDesktop = isDesktopRuntime();

  const [activeTab, setActiveTab] = useState<'profile' | 'printers' | 'security' | 'backups' | 'system'>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // System Settings State
  const [garageName, setGarageName] = useState('كراج الرواحي للعناية بالسيارات');
  const [crNumber, setCrNumber] = useState('1092834');
  const [vatNumber, setVatNumber] = useState('OM1100234567');
  const [phone, setPhone] = useState('+968 91234567');
  const [altPhone, setAltPhone] = useState('+968 24567890');
  const [email, setEmail] = useState('info@alrawahi-garage.om');
  const [address, setAddress] = useState('مسقط، سلطنة عُمان - غلا الصناعية');
  const [taxRatePercent, setTaxRatePercent] = useState('5.0');
  const [invoiceLangDefault, setInvoiceLangDefault] = useState<'ar' | 'en'>('ar');
  const [currencySymbol, setCurrencySymbol] = useState('ر.ع.');

  // Printers State
  const [printers, setPrinters] = useState<PrinterInfoDTO[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [paperSize, setPaperSize] = useState<'A4' | 'THERMAL_80MM'>('A4');
  const [autoPrintOnIssue, setAutoPrintOnIssue] = useState<boolean>(false);
  const [isTestingPrint, setIsTestingPrint] = useState(false);

  // Security & Credential Change State
  const [devCode, setDevCode] = useState('');
  const [newUsername, setNewUsername] = useState('admin9988');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingCredentials, setIsUpdatingCredentials] = useState(false);

  // Backups & Diagnostics State
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [restoreConfirmFile, setRestoreConfirmFile] = useState<string | null>(null);

  useEffect(() => {
    loadSettingsAndBackups();
  }, []);

  async function loadSettingsAndBackups() {
    setIsLoading(true);
    try {
      const [settingsRes, backupsRes, infoRes, printRes] = await Promise.all([
        garageApi.getAllSettings(),
        garageApi.listBackups(),
        garageApi.getSystemInfo(),
        garageApi.getPrinters(),
      ]);

      if (settingsRes.success && settingsRes.data) {
        const s = settingsRes.data;
        if (s.garage_name) setGarageName(s.garage_name);
        if (s.cr_number) setCrNumber(s.cr_number);
        if (s.vat_number) setVatNumber(s.vat_number);
        if (s.phone) setPhone(s.phone);
        if (s.alt_phone) setAltPhone(s.alt_phone);
        if (s.email) setEmail(s.email);
        if (s.address) setAddress(s.address);
        if (s.default_tax_rate_percent) setTaxRatePercent(s.default_tax_rate_percent);
        if (s.invoice_language_default) setInvoiceLangDefault(s.invoice_language_default as 'ar' | 'en');
        if (s.currency_symbol_ar) setCurrencySymbol(s.currency_symbol_ar);
        if (s.default_printer) setSelectedPrinter(s.default_printer);
        if (s.paper_size) setPaperSize(s.paper_size as 'A4' | 'THERMAL_80MM');
        if (s.auto_print_on_issue) setAutoPrintOnIssue(s.auto_print_on_issue === 'true');
      }

      if (backupsRes.success && backupsRes.data) {
        setBackups(backupsRes.data);
      }

      if (infoRes.success && infoRes.data) {
        setSystemInfo(infoRes.data);
      }

      if (printRes.success && printRes.data) {
        setPrinters(printRes.data);
        if (!selectedPrinter && printRes.data.length > 0) {
          const def = printRes.data.find((p) => p.isDefault) || printRes.data[0];
          setSelectedPrinter(def.name);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await Promise.all([
        garageApi.setSetting('garage_name', garageName),
        garageApi.setSetting('cr_number', crNumber),
        garageApi.setSetting('vat_number', vatNumber),
        garageApi.setSetting('phone', phone),
        garageApi.setSetting('alt_phone', altPhone),
        garageApi.setSetting('email', email),
        garageApi.setSetting('address', address),
        garageApi.setSetting('default_tax_rate_percent', taxRatePercent),
        garageApi.setSetting('invoice_language_default', invoiceLangDefault),
        garageApi.setSetting('currency_symbol_ar', currencySymbol),
        garageApi.setSetting('default_printer', selectedPrinter),
        garageApi.setSetting('paper_size', paperSize),
        garageApi.setSetting('auto_print_on_issue', autoPrintOnIssue ? 'true' : 'false'),
      ]);

      showToast(
        isAr ? 'تم حفظ إعدادات الكراج بنجاح' : 'Garage settings saved successfully',
        'success'
      );
    } catch {
      showToast(
        isAr ? 'فشل حفظ الإعدادات' : 'Failed to save settings',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  }

  const handleTestPrint = async () => {
    setIsTestingPrint(true);
    try {
      const res = await garageApi.testPrint(selectedPrinter || undefined);
      if (res.success) {
        showToast('تم إرسال صفحة الاختبار إلى الطابعة بنجاح', 'success');
      } else {
        showToast(res.error || 'تعذر إجراء الطباعة التجريبية', 'error');
      }
    } catch {
      showToast('خطأ أثناء تشغيل أمر الطباعة', 'error');
    } finally {
      setIsTestingPrint(false);
    }
  };

  const handleChangeCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devCode.trim()) {
      showToast('يرجى إدخال رمز تفويض المطور للمتابعة', 'error');
      return;
    }
    if (!newUsername.trim()) {
      showToast('يرجى تحديد اسم المستخدم الجديد', 'error');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      showToast('يجب أن لا تقل كلمة المرور عن 6 خانات', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('كلمتا المرور غير متطابقتين', 'error');
      return;
    }

    setIsUpdatingCredentials(true);
    try {
      const res = await garageApi.changeCredentials({
        devCode: devCode.trim(),
        newUsername: newUsername.trim(),
        newPassword,
      });

      if (res.success) {
        showToast('تم تحديث بيانات الدخول الإدارية بنجاح بنظام التشفير الآمن', 'success');
        setDevCode('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToast(res.error || 'فشل تحديث البيانات. تحقق من رمز تفويض المطور.', 'error');
      }
    } catch {
      showToast('خطأ أثناء تحديث بيانات الدخول', 'error');
    } finally {
      setIsUpdatingCredentials(false);
    }
  };

  async function handleTriggerBackup() {
    setIsBackingUp(true);
    try {
      const res = await garageApi.triggerBackup();
      if (res.success && res.data) {
        showToast(
          isAr
            ? `تم إنشاء نسخة احتياطية بنجاح (${res.data.backupFile})`
            : `Backup created successfully (${res.data.backupFile})`,
          'success'
        );
        const listRes = await garageApi.listBackups();
        if (listRes.success && listRes.data) {
          setBackups(listRes.data);
        }
      } else {
        showToast(res.error || (isAr ? 'فشل إنشاء النسخة الاحتياطية' : 'Backup creation failed'), 'error');
      }
    } catch {
      showToast(isAr ? 'خطأ أثناء النسخ الاحتياطي' : 'Error during backup', 'error');
    } finally {
      setIsBackingUp(false);
    }
  }

  async function handleRestoreBackup(fileName: string) {
    setIsRestoring(true);
    try {
      const res = await garageApi.restoreBackup(fileName);
      if (res.success) {
        showToast(
          isAr ? 'تمت استعادة قاعدة البيانات بنجاح' : 'Database successfully restored from backup',
          'success'
        );
        setRestoreConfirmFile(null);
        await loadSettingsAndBackups();
      } else {
        showToast(res.error || (isAr ? 'فشلت الاستعادة' : 'Restore failed'), 'error');
      }
    } catch {
      showToast(isAr ? 'خطأ أثناء الاستعادة' : 'Error during restore', 'error');
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#1f2b40]">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span className="text-amber-400">
              <SettingsIcon className="w-5 h-5" />
            </span>
            <span>{isAr ? 'إعدادات النظام، الطابعات، والأمان' : 'System Settings & Security'}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isAr
              ? 'إدارة بيانات الكراج، إعدادات الطباعة، الحساب الإداري، والنسخ الاحتياطي'
              : 'Manage garage profile, printing preferences, admin credentials, and SQLite backups'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#131b2c] border border-[#1e2a3d] rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'profile'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isAr ? 'بيانات الكراج' : 'Profile'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('printers')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'printers'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isAr ? 'إعدادات الطباعة' : 'Printers'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'security'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isAr ? 'الأمان والحساب' : 'Security'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backups')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'backups'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isAr ? 'النسخ الاحتياطي' : 'Backups'}
          </button>
        </div>
      </div>

      {/* Tab 1: Profile & Tax Settings */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Legal & Garage Identity */}
            <Card>
              <CardHeader className="pb-3 border-b border-[#1a2333]">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span>{isAr ? 'الهوية الرسمية والبيانات الضريبية' : 'Legal & Official Identity'}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-xs">
                {/* Official Logo Display */}
                <div className="p-3.5 rounded-xl bg-[#0c121e] border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src="/garage_logo.jpg"
                      alt="شعار الكراج"
                      className="w-14 h-14 object-contain rounded-xl border border-amber-500/40 shadow-sm"
                    />
                    <div>
                      <div className="font-bold text-white text-xs">الشعار الرسمي المعتمد للكراج</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        يتم إدراجه تلقائيًا في ترويسة الفواتير وكعلامة مائية خفيفة
                      </div>
                    </div>
                  </div>
                  <Badge variant="emerald">معتمد ونشط</Badge>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {isAr ? 'اسم المنشأة / الكراج' : 'Garage Trade Name'}
                  </label>
                  <input
                    type="text"
                    value={garageName}
                    onChange={(e) => setGarageName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      {isAr ? 'رقم السجل التجاري (CR)' : 'Commercial Register (CR)'}
                    </label>
                    <input
                      type="text"
                      value={crNumber}
                      onChange={(e) => setCrNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      {isAr ? 'الرقم الضريبي (VAT ID)' : 'Oman VAT ID'}
                    </label>
                    <input
                      type="text"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      {isAr ? 'نسبة ضريبة القيمة المضافة (%)' : 'VAT Rate (%)'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={taxRatePercent}
                      onChange={(e) => setTaxRatePercent(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      {isAr ? 'رمز العملة الافتراضي' : 'Currency Symbol'}
                    </label>
                    <input
                      type="text"
                      value={currencySymbol}
                      onChange={(e) => setCurrencySymbol(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {isAr ? 'لغة طباعة الفواتير الافتراضية' : 'Default Invoice Language'}
                  </label>
                  <select
                    value={invoiceLangDefault}
                    onChange={(e) => setInvoiceLangDefault(e.target.value as 'ar' | 'en')}
                    className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="ar">العربية (Arabic Official)</option>
                    <option value="en">English (Bilingual)</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Contact & Location Details */}
            <Card>
              <CardHeader className="pb-3 border-b border-[#1a2333]">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>{isAr ? 'بيانات التواصل والموقع الجغرافي' : 'Contact & Location Info'}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isAr ? 'رقم الهاتف الرئيسي' : 'Primary Phone'}</span>
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isAr ? 'هاتف بديل / الفاكس' : 'Alt Phone / Fax'}</span>
                    </label>
                    <input
                      type="text"
                      value={altPhone}
                      onChange={(e) => setAltPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isAr ? 'البريد الإلكتروني' : 'Official Email'}</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {isAr ? 'عنوان الكراج والفرع' : 'Physical Garage Address'}
                  </label>
                  <textarea
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d131f] border border-[#223048] rounded-lg text-white focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                  />
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-slate-300 leading-relaxed text-[11px]">
                  {isAr
                    ? 'تظهر هذه البيانات تلقائياً في ترويسة الفواتير المطبوعة وسندات القبض وأوامر الصيانة الرسمية.'
                    : 'These details are automatically printed on invoice headers, payment receipts, and repair orders.'}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="submit"
              variant="gold"
              icon={<Save className="w-4 h-4" />}
              disabled={isSaving}
            >
              {isSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديلات' : 'Save Changes')}
            </Button>
          </div>
        </form>
      )}

      {/* Tab 2: Dedicated Printer Settings */}
      {activeTab === 'printers' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-[#1a2333]">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-400" />
                <span>إعدادات الطابعات وتنسيق الطباعة</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    الطابعة الافتراضية للفواتير والتقارير:
                  </label>
                  <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0d131f] border border-[#223048] rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- اختر طابعة من النظام --</option>
                    {printers.map((p, idx) => (
                      <option key={idx} value={p.name}>
                        {p.displayName || p.name} {p.isDefault ? '(الافتراضية للنظام)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    حجم الورق وتنسيق الفاتورة:
                  </label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value as 'A4' | 'THERMAL_80MM')}
                    className="w-full px-3 py-2.5 bg-[#0d131f] border border-[#223048] rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="A4">A4 قياسي مع شعار وعلامة مائية رسمية (موصى به)</option>
                    <option value="THERMAL_80MM">ورق حراري 80mm إيصالات سريعة (POS Thermal)</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="p-4 rounded-xl bg-[#0e1524] border border-slate-800 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPrintOnIssue}
                    onChange={(e) => setAutoPrintOnIssue(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-900 focus:ring-amber-500"
                  />
                  <span className="text-slate-200 font-medium">
                    طباعة الفاتورة تلقائياً للمرة الأولى فقط عند تسليم المركبة واعتماد الفاتورة
                  </span>
                </label>
                <p className="text-[11px] text-slate-400 mr-7">
                  عند إعادة فتح فاتورة سابقة محفوظة لن تتم إعادة الطباعة تلقائياً لتفادي استهلاك الورق.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Printer className="w-3.5 h-3.5" />}
                  onClick={handleTestPrint}
                  disabled={isTestingPrint}
                >
                  {isTestingPrint ? 'جارٍ إرسال صفحة الاختبار...' : 'طباعة صفحة تجريبية'}
                </Button>

                <Button
                  variant="gold"
                  size="sm"
                  icon={<Save className="w-3.5 h-3.5" />}
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                >
                  حفظ إعدادات الطابعة
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 3: Security & Admin Credentials Change */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-[#1a2333]">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>إدارة الحساب الإداري والأمان (Single Admin Security Vault)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-4 text-xs">
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 leading-relaxed text-xs">
                <ShieldAlert className="w-4 h-4 text-amber-400 inline-block ml-1 align-sub" />
                <span>
                  النظام يدعم حساباً إدارياً واحداً فقط لحماية سرية وأمان الحسابات. لتغيير اسم المستخدم أو
                  كلمة المرور، يجب إدخال <strong>رمز تفويض المطور المعتمد (Developer Authorization Code)</strong> الصادر من AKASHA AI.
                </span>
              </div>

              <form onSubmit={handleChangeCredentials} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    رمز تفويض المطور * (Developer Authorization Code)
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={devCode}
                      onChange={(e) => setDevCode(e.target.value)}
                      placeholder="أدخل رمز التفويض الخاص بـ AKASHA AI..."
                      dir="ltr"
                      className="w-full px-3 py-2 bg-[#0d131f] border border-[#273752] rounded-xl text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    يتم التحقق من الرمز داخل العملية الموثوقة (Main Process) باستخدام مقارنة غير قابلة للهجمات الزمنية.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      اسم المستخدم الجديد *
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="admin9988"
                      dir="ltr"
                      className="w-full px-3 py-2 bg-[#0d131f] border border-[#273752] rounded-xl text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      كلمة المرور الجديدة *
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••"
                      dir="ltr"
                      className="w-full px-3 py-2 bg-[#0d131f] border border-[#273752] rounded-xl text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    تأكيد كلمة المرور الجديدة *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••"
                    dir="ltr"
                    className="w-full px-3 py-2 bg-[#0d131f] border border-[#273752] rounded-xl text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="gold"
                    size="md"
                    icon={<KeyRound className="w-4 h-4" />}
                    disabled={isUpdatingCredentials}
                  >
                    {isUpdatingCredentials ? 'جارٍ التحقق والتحديث...' : 'تحديث بيانات الحساب الإداري'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 4: Backups Management */}
      {activeTab === 'backups' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-[#0f1728] border border-[#1d273a]">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>{isAr ? 'النسخ الاحتياطي الذري لقاعدة البيانات' : 'Atomic Database Snapshot'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isAr
                  ? 'يتم أخذ نسخة كاملة متطابقة بدون إيقاف النظام أو التأثير على العملاء (VACUUM INTO).'
                  : 'Generates a live, non-blocking zero-downtime hot backup of your active SQLite database.'}
              </p>
            </div>
            <Button
              variant="gold"
              icon={<Download className="w-4 h-4" />}
              onClick={handleTriggerBackup}
              disabled={isBackingUp}
            >
              {isBackingUp
                ? (isAr ? 'جاري النسخ...' : 'Backing up...')
                : (isAr ? 'إنشاء نسخة احتياطية فورية' : 'Create Live Backup')}
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3 border-b border-[#1a2333]">
              <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
                <span>{isAr ? 'أرشيف النسخ الاحتياطية المتوفرة' : 'Available Backup Archives'}</span>
                <span className="text-xs font-normal text-slate-400">
                  {backups.length} {isAr ? 'ملف محفوظ' : 'files'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {backups.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  {isAr ? 'لا توجد نسخ احتياطية مسجلة بعد.' : 'No backups found.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {backups.map((b) => (
                    <div
                      key={b.fileName}
                      className="p-3 bg-[#0d131f] border border-[#1b2538] hover:border-[#27364f] rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="font-mono font-bold text-white flex items-center gap-2">
                          <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                          <span>{b.fileName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {new Date(b.createdAt).toLocaleString(isAr ? 'ar-OM' : 'en-GB')}
                          </span>
                          <span>•</span>
                          <span>{(b.fileSizeBytes / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
                          onClick={() => setRestoreConfirmFile(b.fileName)}
                        >
                          {isAr ? 'استعادة هذه النسخة' : 'Restore'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreConfirmFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-amber-500/50 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-sm text-white">
                {isAr ? 'تأكيد استعادة قاعدة البيانات' : 'Confirm Database Restore'}
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isAr
                ? `هل أنت متأكد من رغبتك في استعادة قاعدة البيانات من النسخة: "${restoreConfirmFile}"؟ سيتم استبدال البيانات الحالية بالبيانات الموجودة في ملف النسخة الاحتياطية.`
                : `Are you sure you want to restore the database from "${restoreConfirmFile}"? Current database contents will be overwritten with the snapshot.`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRestoreConfirmFile(null)}
                disabled={isRestoring}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="gold"
                size="sm"
                onClick={() => handleRestoreBackup(restoreConfirmFile)}
                disabled={isRestoring}
              >
                {isRestoring
                  ? (isAr ? 'جاري الاستعادة...' : 'Restoring...')
                  : (isAr ? 'تأكيد واستعادة' : 'Confirm & Restore')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
