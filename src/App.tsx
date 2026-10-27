/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Phase 2 Root Application Component
 */

import { LanguageProvider } from './i18n/LanguageContext.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';
import { AppShell } from './components/layout/AppShell.tsx';

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </LanguageProvider>
  );
}
