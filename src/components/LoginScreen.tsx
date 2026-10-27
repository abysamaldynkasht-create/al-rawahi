/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Professional Arabic Login & Workstation Lock Screen
 */

import React, { useState } from 'react';
import { Lock, User, KeyRound, ShieldCheck, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { garageApi } from '../services/garageClient.ts';
import type { AuthSessionDTO } from '../types/ipc.ts';

interface LoginScreenProps {
  onLoginSuccess: (session: AuthSessionDTO) => void;
  isLockedSession?: boolean;
  lockedUsername?: string;
}

export function LoginScreen({ onLoginSuccess, isLockedSession = false, lockedUsername = 'admin9988' }: LoginScreenProps) {
  const [username, setUsername] = useState(isLockedSession ? lockedUsername : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const userToSubmit = isLockedSession ? lockedUsername : username.trim();
    if (!userToSubmit) {
      setError('يرجى إدخال اسم المستخدم');
      return;
    }
    if (!password) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    setIsLoading(true);
    try {
      const res = await garageApi.login({
        username: userToSubmit,
        password,
      });

      if (res.success && res.data) {
        onLoginSuccess(res.data);
      } else {
        setError(res.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } catch {
      setError('تعذر الاتصال بخدمة المصادقة الرئيسية');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col justify-between selection:bg-amber-500/30 font-sans relative overflow-hidden"
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Strip */}
      <header className="h-16 border-b border-[#162133] bg-[#0b101c]/80 backdrop-blur-md px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <img
            src="/garage_logo.jpg"
            alt="شعار كراج الرواحي"
            className="w-10 h-10 object-contain rounded-lg border border-amber-500/40 shadow-sm"
          />
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-wide">
              كراج الرواحي للعناية بالسيارات
            </h1>
            <p className="text-[10px] text-amber-400 font-mono tracking-wider">
              AL RAWAHI GARAGE MANAGEMENT SYSTEM
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-medium">نظام محمي وآمن</span>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-md bg-[#0d1422] border border-[#202d45] rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6 backdrop-blur-sm">
          {/* Brand & Title inside Card */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-24 h-24 rounded-2xl p-1 bg-gradient-to-b from-amber-500/30 to-amber-900/10 border border-amber-500/50 shadow-lg flex items-center justify-center">
              <img
                src="/garage_logo.jpg"
                alt="كراج الرواحي"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isLockedSession ? 'الجلسة مقفلة للأمان' : 'تسجيل الدخول إلى النظام'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {isLockedSession
                  ? 'تم قفل الجلسة مؤقتًا لحماية البيانات. أدخل كلمة المرور للمتابعة.'
                  : 'أدخل بيانات الحساب الإداري المعتمد للوصول إلى قاعدة بيانات الكراج.'}
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLockedSession && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  اسم المستخدم
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin9988"
                    autoComplete="username"
                    dir="ltr"
                    className="w-full pl-3 pr-10 py-2.5 bg-[#141d2f] border border-[#273752] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-mono"
                  />
                </div>
              </div>
            )}

            {isLockedSession && (
              <div className="p-3 rounded-xl bg-[#141d2f] border border-[#24334c] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <User className="w-4 h-4 text-amber-400" />
                  <span>المسؤول:</span>
                  <span className="font-mono font-bold text-white">{lockedUsername}</span>
                </div>
                <span className="text-[11px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  حساب نشط
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                كلمة المرور
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  dir="ltr"
                  autoFocus
                  className="w-full pl-3 pr-10 py-2.5 bg-[#141d2f] border border-[#273752] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جارٍ التحقق...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>{isLockedSession ? 'إلغاء قفل الجلسة' : 'دخول النظام'}</span>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                </>
              )}
            </button>
          </form>

          {/* Initial Setup Credentials Hint */}
          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 text-center leading-relaxed">
            <span>بيانات الحساب الافتراضي: </span>
            <span className="font-mono text-amber-300 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30">
              admin9988
            </span>
            <span className="mx-1">•</span>
            <span>كلمة المرور: </span>
            <span className="font-mono text-amber-300 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30">
              1122334455
            </span>
          </div>
        </div>
      </main>

      {/* Developer Attribution Footer */}
      <footer className="h-12 border-t border-[#162133] bg-[#090d17] px-6 flex items-center justify-between text-xs text-slate-500 z-10">
        <div>
          <span>كراج الرواحي للعناية بالسيارات — سلطنة عُمان</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>تطوير وإشراف:</span>
          <span className="text-amber-400 font-bold">AKASHA AI</span>
        </div>
      </footer>
    </div>
  );
}
