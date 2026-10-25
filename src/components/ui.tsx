import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar, ComposedChart, ReferenceLine,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus, Search, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, Inbox, Loader2, X, Info } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useData } from '../context/DataContext';

/* ================= formatting context ================= */
export function useFmt() {
  const { settings } = useSettings();
  const symbol = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥' }[settings.currency] ?? '$';
  const money = (n: number, digits = 0) => {
    const v = Number.isFinite(n) ? n : 0;
    return (v < 0 ? '-' : '') + symbol + Math.abs(v).toLocaleString(settings.numberLocale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };
  const full = (n: number) => (n < 0 ? '-' : '') + symbol + Math.abs(n).toLocaleString(settings.numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (n: number) => Math.round(n).toLocaleString(settings.numberLocale);
  const pct = (n: number, d = 1) => n.toFixed(d) + '%';
  const compact = (n: number) => Math.abs(n) >= 1e6 ? symbol + (n / 1e6).toFixed(2) + 'M' : Math.abs(n) >= 1e3 ? symbol + (n / 1e3).toFixed(1) + 'K' : money(n, 0);
  return { money, full, num, pct, compact, symbol };
}

/* ================= animated counter ================= */
export function AnimatedNumber({ value, format, duration = 900 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  const reduced = useSettings().settings.reducedMotion;
  useEffect(() => {
    if (reduced) { setDisplay(value); return; }
    const from = prev.current, to = value, start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(2, -9 * t);
      setDisplay(from + (to - from) * (t < 1 ? e : 1));
      if (t < 1) raf = requestAnimationFrame(step); else prev.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);
  return <>{format(display)}</>;
}

/* ================= KPI card ================= */
export function KpiCard({ label, value, format, delta, deltaLabel, icon, accent = 'indigo', invert = false }: {
  label: string; value: number; format: (n: number) => string; delta?: number | null; deltaLabel?: string;
  icon: React.ReactNode; accent?: 'indigo' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet'; invert?: boolean;
}) {
  const iconAccents: Record<string, string> = {
    indigo: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/15',
    cyan: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 dark:bg-sky-500/15',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15',
    violet: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 dark:bg-slate-500/15',
  };
  const good = delta == null ? null : (invert ? delta < 0 : delta >= 0);
  return (
    <motion.div layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
      className="card card-hover relative overflow-hidden p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="kpi-label">{label}</p>
          <p className="mt-1.5 text-[1.42rem] sm:text-2xl font-bold tracking-tight text-[var(--ink)] tabular-nums leading-none">
            <AnimatedNumber value={value} format={format} />
          </p>
          {delta != null && (
            <p className={`mt-2 inline-flex items-center gap-1 text-[0.7rem] font-semibold ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {Math.abs(delta) < 0.05 ? <Minus size={12} /> : good ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
              <span className="font-normal text-[var(--faint)]">{deltaLabel ?? 'vs prior period'}</span>
            </p>
          )}
        </div>
        <div className={`shrink-0 rounded-xl p-2.5 ${iconAccents[accent] || iconAccents.indigo}`}>{icon}</div>
      </div>
    </motion.div>
  );
}

/* ================= chart card wrapper ================= */
export function ChartCard({ title, subtitle, right, children, className = '', height = 280 }: {
  title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; height?: number;
}) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[0.85rem] font-bold tracking-tight text-[var(--ink)]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]">{subtitle}</p>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
      <div style={{ height }}>{children}</div>
    </section>
  );
}

export function ChartTooltip({ active, payload, label, money }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--tooltip-bg)] px-3 py-2 shadow-[var(--shadow-md)] text-[0.75rem]">
      <p className="mb-1 font-bold text-[var(--tooltip-ink)]">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-[var(--muted)]">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
          <span className="capitalize">{p.name}:</span>
          <span className="ml-auto font-semibold text-[var(--tooltip-ink)] tabular-nums">
            {typeof p.value === 'number'
              ? (/revenue|profit|sales|aov|forecast|fitted|actual|baseline|holt|value|upper|lower/i.test(p.name) ? money(p.value) : p.value.toLocaleString('en-US', { maximumFractionDigits: 1 }))
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}
export const PALETTE = ['#2563eb', '#059669', '#0284c7', '#d97706', '#64748b', '#475569', '#dc2626', '#0891b2', '#0d9488', '#94a3b8'];
export const axisTick = { fontSize: 10.5 };
export function gridColor() { return 'var(--chart-grid)'; }

/* ================= empty / error / loading states ================= */
export function EmptyState({ title = 'No data for this selection', hint = 'Try widening the date range or clearing a filter.', action }: { title?: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)] p-4"><Inbox size={26} className="text-[var(--faint)]" /></div>
      <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
      <p className="max-w-sm text-xs text-[var(--muted)]">{hint}</p>
      {action}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10"><AlertTriangle size={26} className="text-rose-500" /></div>
      <p className="text-sm font-semibold text-[var(--ink)]">Something went wrong</p>
      <p className="max-w-md text-xs text-[var(--muted)] font-mono2">{message}</p>
      {onRetry && <button className="btn btn-ghost mt-1" onClick={onRetry}>Try again</button>}
    </div>
  );
}
export function LoadingState({ label = 'Crunching the dataset…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16" role="status" aria-live="polite">
      <Loader2 size={30} className="animate-spin text-[var(--indigo)]" />
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20" />)}</div>
    </div>
  );
}

/* ================= sortable table ================= */
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => number | string;
  align?: 'left' | 'right' | 'center';
  width?: string;
}
export function DataTable<T>({ columns, rows, pageSize = 12, searchable = true, searchPlaceholder = 'Search table…', footer, exportName }: {
  columns: Column<T>[]; rows: T[]; pageSize?: number; searchable?: boolean; searchPlaceholder?: string; footer?: React.ReactNode; exportName?: string;
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [rows.length, query]);

  const processed = useMemo(() => {
    let out = rows;
    const q = query.trim().toLowerCase();
    if (q) out = out.filter(r => columns.some(c => String(c.sortValue ? c.sortValue(r) : '').toLowerCase().includes(q) || false) || JSON.stringify(r, (_, v) => v instanceof Date ? v.toISOString() : v).toLowerCase().includes(q));
    if (sortKey) {
      const col = columns.find(c => c.key === sortKey);
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const av = col.sortValue!(a), bv = col.sortValue!(b);
          return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * dir;
        });
      }
    }
    return out;
  }, [rows, query, sortKey, dir, columns]);

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const pageRows = processed.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      {searchable && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="relative w-full max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={searchPlaceholder} aria-label="Search table"
              className="input w-full !pl-8 !py-1.5 text-xs" />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--faint)] hover:text-[var(--ink)]"><X size={13} /></button>}
          </div>
          <span className="text-[0.68rem] font-medium text-[var(--muted)] tabular-nums">{processed.length.toLocaleString()} row{processed.length === 1 ? '' : 's'}</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full border-collapse">
          <thead className="bg-[var(--surface-2)]/60">
            <tr>
              {columns.map(c => (
                <th key={c.key} className={`th ${c.sortValue ? 'th-sortable' : ''} ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}
                  style={{ width: c.width }}
                  onClick={() => { if (!c.sortValue) return; if (sortKey === c.key) setDir(d => (d === 1 ? -1 : 1)); else { setSortKey(c.key); setDir(-1); } }}
                  aria-sort={sortKey === c.key ? (dir === 1 ? 'ascending' : 'descending') : undefined}>
                  <span className="inline-flex items-center gap-1">{c.header}
                    {c.sortValue && (sortKey === c.key ? (dir === 1 ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-40" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="tr-hover">
                {columns.map(c => <td key={c.key} className={`td ${c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : ''}`}>{c.render(row)}</td>)}
              </tr>
            ))}
            {pageRows.length === 0 && <tr><td colSpan={columns.length}><EmptyState title="No matching rows" hint={`Nothing in the table matches “${query}”.`} /></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[0.7rem] text-[var(--muted)]">
        <div>{footer}</div>
        <div className="flex items-center gap-1.5">
          <button className="btn btn-ghost !px-2 !py-1 text-[0.7rem]" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Previous page">Prev</button>
          <span className="tabular-nums font-medium">Page {page + 1} / {totalPages}</span>
          <button className="btn btn-ghost !px-2 !py-1 text-[0.7rem]" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} aria-label="Next page">Next</button>
        </div>
      </div>
    </div>
  );
}

/* ================= badges ================= */
export function Badge({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'indigo' | 'cyan' | 'gray' | 'violet'; children: React.ReactNode }) {
  const map = {
    green: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30',
    red: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30',
    indigo: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    cyan: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    gray: 'bg-slate-500/12 text-slate-600 dark:text-slate-300 border-slate-500/25',
    violet: 'bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/30',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.66rem] font-semibold ${map[tone]}`}>{children}</span>;
}

export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/8 px-3 py-2 text-[0.72rem] leading-snug text-[var(--muted)]">
      <Info size={13} className="mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
      <span>{children}</span>
    </div>
  );
}

/* ================= page scaffold ================= */
export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle: string; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && <div className="hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-2.5 text-white shadow-lg shadow-indigo-600/25 sm:block">{icon}</div>}
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[var(--ink)] sm:text-2xl">{title}</h1>
          <p className="mt-0.5 max-w-2xl text-[0.78rem] leading-snug text-[var(--muted)]">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ================= active-filter chips ================= */
export function ActiveFilters() {
  const { filters, setFilter, resetFilters, dateBounds } = useData();
  const chips: { label: string; clear: () => void }[] = [];
  if (filters.from !== '' || filters.to !== '') chips.push({ label: `${filters.from || dateBounds.min} → ${filters.to || dateBounds.max}`, clear: () => setFilter({ from: '', to: '' }) });
  if (filters.country !== 'All') chips.push({ label: `Country: ${filters.country}`, clear: () => setFilter({ country: 'All' }) });
  if (filters.category !== 'All') chips.push({ label: `Category: ${filters.category}`, clear: () => setFilter({ category: 'All', subCategory: 'All' }) });
  if (filters.segment !== 'All') chips.push({ label: `Segment: ${filters.segment}`, clear: () => setFilter({ segment: 'All' }) });
  if (filters.search) chips.push({ label: `Search: “${filters.search}”`, clear: () => setFilter({ search: '' }) });
  if (!chips.length) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--faint)]">Active filters</span>
      {chips.map((c, i) => (
        <button key={i} onClick={c.clear} className="chip hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors">
          {c.label}<X size={11} />
        </button>
      ))}
      <button onClick={resetFilters} className="text-[0.68rem] font-semibold text-[var(--indigo)] hover:underline">Clear all</button>
    </div>
  );
}
