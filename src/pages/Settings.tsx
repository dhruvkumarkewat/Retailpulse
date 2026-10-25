import React from 'react';
import {
  Settings as SettingsIcon, Sun, Moon, Monitor, Check, Trash2, RotateCcw, Palette, BellRing, Database,
  UserRound, Gauge, MoonStar, ShieldCheck, FileText, CircleCheck,
} from 'lucide-react';
import { useSettings, DEFAULT_SETTINGS, type ThemeMode, type Density } from '../context/SettingsContext';
import { useData } from '../context/DataContext';
import { PageHeader, InfoNote } from '../components/ui';

const ACCENTS = [
  { name: 'Indigo (default)', value: '#4338ca' }, { name: 'Cyan', value: '#0891b2' }, { name: 'Violet', value: '#7c3aed' },
  { name: 'Emerald', value: '#059669' }, { name: 'Rose', value: '#e11d48' }, { name: 'Amber', value: '#d97706' }, { name: 'Slate', value: '#334155' },
];

export default function Settings() {
  const { settings, update, resetSettings, resolvedTheme, clearCaches, toast, toastMsg } = useSettings();
  const { report, reload, status } = useData();

  const themeOptions: { mode: ThemeMode; label: string; icon: React.ReactNode; desc: string }[] = [
    { mode: 'light', label: 'Light', icon: <Sun size={18} />, desc: 'Clean white, indigo accents — the boardroom look' },
    { mode: 'dark', label: 'Dark', icon: <Moon size={18} />, desc: 'Low-light war-room for long analytical sessions' },
    { mode: 'system', label: 'System', icon: <Monitor size={18} />, desc: 'Follows your OS appearance automatically' },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader
        icon={<SettingsIcon size={20} />}
        title="Settings"
        subtitle="Preferences persist locally. The dataset is read-only — no setting mutates source data."
        actions={<button className="btn btn-ghost" onClick={resetSettings}><RotateCcw size={14} /> Reset defaults</button>}
      />

      {/* ============ APPEARANCE ============ */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-[0.85rem] font-bold text-[var(--ink)]"><Palette size={15} className="text-[var(--indigo)]" /> Appearance</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
          {themeOptions.map(t => {
            const active = settings.theme === t.mode;
            return (
              <button key={t.mode} role="radio" aria-checked={active} onClick={() => update({ theme: t.mode })}
                className={`group rounded-2xl border-2 p-4 text-left transition-all ${active ? 'border-[var(--indigo)] bg-[var(--indigo-soft)] shadow-md' : 'border-[var(--border)] hover:border-[var(--border-strong)]'}`}>
                <span className={`inline-flex rounded-xl p-2 ${active ? 'bg-[var(--indigo)] text-white' : 'bg-[var(--surface-2)] text-[var(--muted)] group-hover:text-[var(--ink)]'} transition-colors`}>{t.icon}</span>
                <span className="mt-2 flex items-center justify-between text-[0.82rem] font-bold text-[var(--ink)]">{t.label}{active && <CircleCheck size={15} className="text-[var(--indigo)]" />}</span>
                <span className="mt-0.5 block text-[0.66rem] leading-snug text-[var(--muted)]">{t.desc}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4">
          <p className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--muted)]">Accent color</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ACCENTS.map(a => (
              <button key={a.value} onClick={() => update({ accent: a.value })} title={a.name} aria-label={`Accent ${a.name}`} aria-pressed={settings.accent === a.value}
                className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${settings.accent === a.value ? 'ring-2 ring-offset-2 ring-[var(--ink)] ring-offset-[var(--surface)] scale-110' : ''}`}
                style={{ background: a.value }}>
                {settings.accent === a.value && <Check size={15} className="mx-auto text-white" />}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[0.75rem] font-semibold text-[var(--ink)]">Table density</span>
            <div className="flex rounded-lg border border-[var(--border-strong)] p-0.5">
              {(['comfortable', 'compact'] as Density[]).map(dn => (
                <button key={dn} onClick={() => update({ density: dn })} className={`rounded-md px-3 py-1 text-[0.7rem] font-bold capitalize transition-all ${settings.density === dn ? 'bg-[var(--indigo)] text-white' : 'text-[var(--muted)]'}`}>{dn}</button>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[0.75rem] font-semibold text-[var(--ink)]">
            <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={settings.reducedMotion} onChange={e => update({ reducedMotion: e.target.checked })} />
            Reduce cinematic motion (disables 3D camera drift)
          </label>
        </div>
      </section>

      {/* ============ REGIONAL & DATA ============ */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-[0.85rem] font-bold text-[var(--ink)]"><Gauge size={15} className="text-[var(--indigo)]" /> Regional formatting</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-[0.7rem] font-bold text-[var(--muted)]">Currency
              <select className="select mt-1 w-full" value={settings.currency} onChange={e => update({ currency: e.target.value })}>
                {['USD', 'EUR', 'GBP', 'INR', 'JPY'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-[0.7rem] font-bold text-[var(--muted)]">Number locale
              <select className="select mt-1 w-full" value={settings.numberLocale} onChange={e => update({ numberLocale: e.target.value })}>
                {['en-US', 'en-GB', 'de-DE', 'fr-FR', 'en-IN', 'ja-JP'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label className="text-[0.7rem] font-bold text-[var(--muted)]">Date format
              <select className="select mt-1 w-full" value={settings.dateFormat} onChange={e => update({ dateFormat: e.target.value as any })}>
                <option value="ISO">ISO — 2026-10-23</option>
                <option value="US">US — 10/23/2026</option>
                <option value="EU">EU — 23/10/2026</option>
              </select>
            </label>
            <label className="text-[0.7rem] font-bold text-[var(--muted)]">Default forecast horizon
              <select className="select mt-1 w-full" value={settings.defaultHorizon} onChange={e => update({ defaultHorizon: Number(e.target.value) })}>
                {[3, 6, 12].map(h => <option key={h} value={h}>{h} months</option>)}
              </select>
            </label>
          </div>
          <p className="mt-3 text-[0.68rem] text-[var(--faint)]">Formatting applies immediately to every KPI, chart tooltip, table and exported PDF/CSV.</p>
        </section>

        {/* ============ PROFILE ============ */}
        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-[0.85rem] font-bold text-[var(--ink)]"><UserRound size={15} className="text-[var(--indigo)]" /> Profile</h2>
          <div className="mt-3 flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-extrabold text-white shadow-lg shadow-indigo-500/30">AR</span>
            <div className="min-w-0 flex-1">
              <label className="text-[0.7rem] font-bold text-[var(--muted)]">Display name<input className="input mt-1 w-full" value={settings.displayName} onChange={e => update({ displayName: e.target.value })} /></label>
            </div>
          </div>
          <label className="mt-3 block text-[0.7rem] font-bold text-[var(--muted)]">Work email<input className="input mt-1 w-full font-mono2" type="email" value={settings.email} onChange={e => update({ email: e.target.value })} /></label>
          <p className="mt-2 text-[0.68rem] text-[var(--faint)]">Used as the sender identity in scheduled report delivery (Reports → Schedule).</p>
        </section>
      </div>

      {/* ============ NOTIFICATIONS ============ */}
      <section className="card mt-3 p-5">
        <h2 className="flex items-center gap-2 text-[0.85rem] font-bold text-[var(--ink)]"><BellRing size={15} className="text-[var(--indigo)]" /> Alert rules</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {([
            ['notifyHighChurn', 'High-risk churn spike', 'Alert when High-risk count grows ≥ 10% week-over-week'],
            ['notifyReorder', 'Reorder point breached', 'Notify when any A-class SKU hits Reorder Now status'],
            ['notifyWeekly', 'Weekly insight digest', 'Monday 07:00 anomaly summary: returns, margin, velocity'],
          ] as [keyof typeof settings, string, string][]).map(([key, title, desc]) => (
            <label key={key} className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-all ${(settings as any)[key] ? 'border-[var(--indigo)] bg-[var(--indigo-soft)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'}`}>
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={(settings as any)[key] as boolean} onChange={e => update({ [key]: e.target.checked } as any)} />
              <span><span className="block text-[0.78rem] font-bold text-[var(--ink)]">{title}</span><span className="mt-0.5 block text-[0.66rem] leading-snug text-[var(--muted)]">{desc}</span></span>
            </label>
          ))}
        </div>
      </section>

      {/* ============ DATA GOVERNANCE ============ */}
      <section className="card mt-3 p-5">
        <h2 className="flex items-center gap-2 text-[0.85rem] font-bold text-[var(--ink)]"><Database size={15} className="text-[var(--indigo)]" /> Data & integrity</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Source of truth', 'RetailPulse_Clean_Dataset.csv'],
            ['Rows parsed', report ? report.rows.length.toLocaleString() : '—'],
            ['Currency cells fixed', report ? String(report.currencyFixes) : '—'],
            ['Rows dropped', report ? String(report.droppedRows) : '—'],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-[var(--surface-2)] px-4 py-3">
              <p className="kpi-label">{l}</p>
              <p className="mt-1 truncate font-mono2 text-[0.8rem] font-semibold text-[var(--ink)]" title={v as string}>{v}</p>
            </div>
          ))}
        </div>
        {report && report.warnings.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[0.72rem] text-[var(--muted)]">{report.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => reload()} disabled={status === 'loading'}><RotateCcw size={14} /> Re-parse dataset</button>
          <button className="btn btn-ghost !text-rose-600 dark:!text-rose-400" onClick={clearCaches}><Trash2 size={14} /> Clear local caches & reset settings</button>
        </div>
        <div className="mt-3"><InfoNote><ShieldCheck size={12} className="mr-1 inline" />RetailPulse never mutates the source CSV. Parsing is currency-aware ($3,428.33 → 3428.33), date-aware and missing-value tolerant — the parse audit above is shown exactly as the loader measured it.</InfoNote></div>
      </section>
    </div>
  );
}
