/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Language Context Provider & Hook
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { TRANSLATIONS, type Language } from './translations.ts';
import { garageApi } from '../services/garageClient.ts';

interface LanguageContextType {
  lang: Language;
  setLang: (language: Language) => void;
  isRtl: boolean;
  t: (key: keyof typeof TRANSLATIONS.ar) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_LANG_KEY = 'al_rawahi_app_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LANG_KEY);
      if (saved === 'en' || saved === 'ar') return saved;
    } catch {
      // fallback to Arabic default
    }
    return 'ar'; // Default language is Arabic
  });

  const isRtl = lang === 'ar';

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_LANG_KEY, newLang);
      garageApi.setSetting('default_language', newLang).catch(() => {});
    } catch (e) {
      console.warn('Failed to persist language setting:', e);
    }
  };

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, isRtl]);

  const t = useMemo(() => {
    return (key: keyof typeof TRANSLATIONS.ar): string => {
      const dict = TRANSLATIONS[lang] || TRANSLATIONS.ar;
      return dict[key] || TRANSLATIONS.ar[key] || String(key);
    };
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, isRtl, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
