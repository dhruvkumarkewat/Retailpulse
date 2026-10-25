import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

export interface AppSettings {
  theme: ThemeMode;
  accent: string;
  density: Density;
  currency: string;
  numberLocale: string;
  dateFormat: 'ISO' | 'US' | 'EU';
  sidebarCollapsed: boolean;
  reducedMotion: boolean;
  notifyHighChurn: boolean;
  notifyReorder: boolean;
  notifyWeekly: boolean;
  defaultHorizon: number;
  email: string;
  displayName: string;
}
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light', accent: '#4338ca', density: 'comfortable',
  currency: 'USD', numberLocale: 'en-US', dateFormat: 'ISO',
  sidebarCollapsed: false, reducedMotion: false,
  notifyHighChurn: true, notifyReorder: true, notifyWeekly: false,
  defaultHorizon: 6, email: 'ana.reyes@retailpulse.io', displayName: 'Ana Reyes',
};
const KEY = 'retailpulse-settings-v1';

interface Ctx {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;
  resolvedTheme: 'light' | 'dark';
  clearCaches: () => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
}
const Ctx2 = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try { const raw = localStorage.getItem(KEY); return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS; }
    catch { return DEFAULT_SETTINGS; }
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout((toast as any)._t);
    (toast as any)._t = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.('change', h);
    return () => mq.removeEventListener?.('change', h);
  }, []);

  const resolvedTheme: 'light' | 'dark' = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    document.documentElement.dataset.density = settings.density;
    document.documentElement.style.setProperty('--indigo', settings.accent);
    // derive strong/soft from accent via fixed fallbacks for non-default accents
    document.documentElement.style.setProperty('--accent', settings.accent);
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
  }, [settings, resolvedTheme]);

  const update = useCallback((patch: Partial<AppSettings>) => setSettings(s => ({ ...s, ...patch })), []);
  const resetSettings = useCallback(() => { setSettings(DEFAULT_SETTINGS); toast('Settings restored to defaults'); }, [toast]);
  const clearCaches = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
    toast('Local caches cleared. Dataset will re-parse on next reload.');
  }, [toast]);

  const value = useMemo(() => ({ settings, update, resetSettings, resolvedTheme, clearCaches, toast, toastMsg }),
    [settings, update, resetSettings, resolvedTheme, clearCaches, toast, toastMsg]);
  return React.createElement(Ctx2.Provider, { value }, children);
}

export function useSettings() {
  const c = useContext(Ctx2);
  if (!c) throw new Error('useSettings must be used inside <SettingsProvider>');
  return c;
}
