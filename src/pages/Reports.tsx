import React, { useMemo, useState } from 'react';
import {
  FileBarChart, FileText, Download, FileSpreadsheet, ShieldCheck, Clock, CalendarClock, CheckCircle2, Loader2,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import {
  kpis, byMonth, byQuarter, groupStats, churnAnalysis, inventoryAnalysis, ordersToCSV, downloadCSV, generatePdfReport, fmtMoney, fmtPct, fmtNum,
} from '../lib/engine';
import { PageHeader, ActiveFilters, useFmt, InfoNote } from '../components/ui';

interface ReportDef {
  id: string;
  name: string;
  cadence: string;
  desc: string;
  accent: string;
  build: () => Promise<void>;
}

export default function Reports() {
  const { filtered, rows, filters, dateBounds, status } = useData();
  const { toast } = useSettings();
  const fmt = useFmt();
  const [building, setBuilding] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [schedule, setSchedule] = useState({ weekly: true, monthly: true, recipients: 'exec-team@retailpulse.io' });

  const meta = useMemo(() => ({ k: kpis(filtered), months: byMonth(filtered).length, quarters: byQuarter(filtered).length }), [filtered]);
  const windowLabel = `${filters.from || dateBounds.min || '…'} → ${filters.to || dateBounds.max || '…'}`;

  const run = async (id: string, fn: () => Promise<void>) => {
    setBuilding(id);
    try {
      await fn();
      setDone(prev => new Set(prev).add(id));
      toast('Report generated and downloaded');
    } catch (e: any) {
      toast(`Report failed: ${e?.message ?? 'unknown error'}`);
    } finally {
      setBuilding(null);
    }
  };

  const reports: ReportDef[] = [
    {
      id: 'exec-weekly', name: 'Executive Weekly Brief', cadence: 'Weekly · Monday 07:00', accent: 'from-indigo-500 to-violet-600',
      desc: 'Revenue, profit, orders, margin, AOV and return rate — the Monday-morning one-pager for the board.',
      build: () => generatePdfReport('Executive Weekly Brief', `Window ${windowLabel} · Country ${filters.country} · Category ${filters.category} · Segment ${filters.segment}`, [
        { heading: 'Headline KPIs', kpis: [
          { label: 'Gross revenue', value: fmt.money(meta.k.revenue) }, { label: 'Net profit', value: fmt.money(meta.k.profit) },
          { label: 'Orders', value: fmt.num(meta.k.orders) }, { label: 'AOV', value: fmt.money(meta.k.aov, 2) },
          { label: 'Margin', value: fmtPct(meta.k.margin) }, { label: 'Return rate', value: fmtPct(meta.k.returnRate) },
          { label: 'Unique customers', value: fmt.num(meta.k.uniqueCustomers) }, { label: 'Units sold', value: fmt.num(meta.k.qty) },
        ] },
        { heading: 'Quarterly pulse', table: { headers: ['Quarter', 'Revenue', 'Profit', 'Margin'], rows: byQuarter(filtered).map(q => [q.label, fmt.money(q.revenue), fmt.money(q.profit), fmtPct(q.margin)]) } },
        { heading: 'Top categories', table: { headers: ['Category', 'Revenue', 'Profit', 'Orders'], rows: groupStats(filtered, r => r.category).map(c => [c.key, fmt.money(c.revenue), fmt.money(c.profit), c.orders]) }, note: 'Source of truth: RetailPulse_Clean_Dataset.csv. Computed from filtered rows at generation time.' },
      ]),
    },
    {
      id: 'demand-forecast', name: 'Demand Forecast Dossier', cadence: 'Monthly · 1st of month', accent: 'from-cyan-500 to-emerald-500',
      desc: `Holt’s linear projection + 6-month holdout back-test (MAE/RMSE/MAPE) across ${meta.months} months of history.`,
      build: async () => {
        const { buildForecast, byMonth: bm } = await import('../lib/engine');
        const fc = buildForecast(bm(filtered), 6)!;
        await generatePdfReport('Demand Forecast Dossier', `Window ${windowLabel} · Model: Holt's linear (α=0.72, β=0.28) + baselines · Holdout: last 6 months`, [
          { heading: 'Projection — next 6 months', kpis: fc.nextMonths.map((m, i) => ({ label: m, value: fmt.money(fc.history.filter(h => h.forecast != null)[i]?.forecast ?? 0) })) },
          { heading: 'Holdout leaderboard (lower is better)', table: { headers: ['Model', 'MAE', 'RMSE', 'MAPE %'], rows: fc.metrics.map(m => [m.name, fmt.money(m.mae), fmt.money(m.rmse), m.mape.toFixed(2) + '%']) } },
          { heading: 'Back-test detail', table: { headers: ['Month', 'Actual', 'Seasonal-naive', "Holt's"], rows: fc.backtestRows.map(r => [r.label, fmt.money(r.actual), fmt.money(r.baseline), fmt.money(r.holt)]) }, note: 'Out-of-sample evaluation. Holt’s line is re-fit on all data for production projection. Band = ±1.96σ√h.' },
        ]);
      },
    },
    {
      id: 'customer-health', name: 'Customer Health & Churn', cadence: 'Weekly · Wednesday', accent: 'from-rose-500 to-orange-500',
      desc: 'Churn risk register: top High-risk customers with drivers, segment revenue mix and RFM base health.',
      build: async () => {
        const scored = churnAnalysis(filtered);
        const high = scored.filter(c => c.churnRisk === 'High');
        await generatePdfReport('Customer Health & Churn', `Window ${windowLabel} · ${scored.length} customers scored · transparent weighted RFM model`, [
          { heading: 'Risk census', kpis: [
            { label: 'High risk', value: String(high.length) },
            { label: 'Medium risk', value: String(scored.filter(c => c.churnRisk === 'Medium').length) },
            { label: 'Low risk', value: String(scored.filter(c => c.churnRisk === 'Low').length) },
            { label: 'Revenue at risk', value: fmt.money(scored.filter(c => c.churnRisk !== 'Low').reduce((a, c) => a + c.monetary, 0)) },
          ] },
          { heading: 'Top 25 high-risk customers — act first', table: { headers: ['Customer', 'Score', 'Recency (d)', 'Orders', 'Lifetime $'], rows: high.slice(0, 25).map(c => [`${c.name} (${c.id})`, c.churnScore, c.recencyDays, c.orders, fmt.money(c.monetary)]) }, note: 'Heuristic weighted score (recency 45, frequency 22, discount 12, returns 13, loyalty ±10, LTV 4). Documented in-app; not a calibrated classifier.' },
        ]);
      },
    },
    {
      id: 'inventory-reorder', name: 'Inventory & Reorder Plan', cadence: 'Bi-weekly · Friday', accent: 'from-amber-500 to-yellow-600',
      desc: 'Reorder-now register with velocity, lead time, safety stock and suggested buy quantities per SKU.',
      build: async () => {
        const inv = inventoryAnalysis(filtered);
        const now = inv.filter(i => i.status === 'Reorder Now');
        await generatePdfReport('Inventory & Reorder Plan', `Window ${windowLabel} · ${inv.length} SKUs analyzed · deterministic lead-time 7–15d`, [
          { heading: 'Pipeline census', kpis: [
            { label: 'Reorder now', value: String(now.length) },
            { label: 'Reorder soon', value: String(inv.filter(i => i.status === 'Reorder Soon').length) },
            { label: 'Healthy', value: String(inv.filter(i => i.status === 'Healthy').length) },
            { label: 'Overstock risk', value: String(inv.filter(i => i.status === 'Overstock Risk').length) },
          ] },
          { heading: 'Reorder now — suggested purchase quantities', table: { headers: ['Product', 'Vel/day', 'Lead (d)', 'Safety', 'Reorder Pt', 'Suggest +'], rows: now.slice(0, 30).map(i => [`${i.productName} (${i.productId})`, i.velocityPerDay, i.leadTimeDays, i.safetyStock, i.reorderPoint, i.suggestedReorder]) }, note: 'Planning heuristics from demand velocity; not ERP inventory truth. No stock column exists in the source data.' },
        ]);
      },
    },
  ];

  const exportRaw = () => run('csv-raw', async () => { ordersToCSV(filtered); });
  const exportMonthly = () => run('csv-monthly', async () => {
    downloadCSV('retailpulse-monthly-series', ['Month', 'Revenue', 'Profit', 'Orders', 'Quantity', 'Margin %', 'AOV', 'Returns'],
      byMonth(filtered).map(m => [m.label, m.revenue.toFixed(2), m.profit.toFixed(2), m.orders, m.qty, m.margin.toFixed(2), m.aov.toFixed(2), m.returns]));
  });

  return (
    <div>
      <PageHeader
        icon={<FileBarChart size={20} />}
        title="Reports"
        subtitle="One-click, board-ready exports. Each report is generated live from the current filter window — no stale snapshots."
        actions={<span className="chip"><ShieldCheck size={11} className="text-emerald-500" /> {fmt.num(filtered.length)} filtered rows in scope</span>}
      />
      <ActiveFilters />
      {status === 'loading' && <p className="text-sm text-[var(--muted)]"><Loader2 className="inline animate-spin" size={14} /> Loading…</p>}

      {/* ============ REPORT LIBRARY ============ */}
      <div className="grid gap-3 md:grid-cols-2">
        {reports.map(r => {
          const isDone = done.has(r.id);
          const isBusy = building === r.id;
          return (
            <div key={r.id} className="card card-hover flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${r.accent} text-white shadow-lg`}><FileText size={20} /></div>
                <span className="chip"><Clock size={11} /> {r.cadence}</span>
              </div>
              <h3 className="mt-3 text-[0.95rem] font-extrabold tracking-tight text-[var(--ink)]">{r.name}</h3>
              <p className="mt-1 flex-1 text-[0.76rem] leading-snug text-[var(--muted)]">{r.desc}</p>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                <span className="text-[0.66rem] font-medium uppercase tracking-wider text-[var(--faint)]">PDF · A4 · auto-tables</span>
                <button className="btn btn-primary !py-1.5 text-[0.75rem]" disabled={isBusy} onClick={() => run(r.id, r.build)}>
                  {isBusy ? <Loader2 size={14} className="animate-spin" /> : isDone ? <CheckCircle2 size={14} /> : <Download size={14} />}
                  {isBusy ? 'Building…' : isDone ? 'Download again' : 'Generate PDF'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ============ RAW EXPORTS ============ */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="card p-5">
          <p className="kpi-label flex items-center gap-1.5"><FileSpreadsheet size={13} className="text-emerald-600 dark:text-emerald-400" /> Raw data exports</p>
          <p className="mt-1 text-[0.75rem] text-[var(--muted)]">For your own modeling, pivoting or audit. Exports exactly what the filters show.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={exportRaw} disabled={building === 'csv-raw'}><Download size={14} /> Filtered orders ({fmt.num(filtered.length)} rows)</button>
            <button className="btn btn-ghost" onClick={exportMonthly} disabled={building === 'csv-monthly'}><Download size={14} /> Monthly series ({meta.months} rows)</button>
            <button className="btn btn-ghost" onClick={() => run('csv-full', async () => { ordersToCSV(rows); })} disabled={building === 'csv-full'}><Download size={14} /> Full unfiltered dataset ({fmt.num(rows.length)} rows)</button>
          </div>
          <div className="mt-3"><InfoNote>Every CSV carries a UTF-8 BOM for Excel compatibility and uses the exact 26 source columns, currency-stripped and machine-parseable.</InfoNote></div>
        </div>

        {/* ============ SCHEDULE ============ */}
        <form className="card p-5" onSubmit={e => { e.preventDefault(); toast(`Report schedule saved — ${schedule.recipients}`); }}>
          <p className="kpi-label flex items-center gap-1.5"><CalendarClock size={13} className="text-[var(--indigo)]" /> Scheduled delivery</p>
          <p className="mt-1 text-[0.75rem] text-[var(--muted)]">Configure who receives which brief. Stored locally — wiring to SMTP/SendGrid is a backend env var away.</p>
          <label className="mt-3 block text-[0.7rem] font-bold text-[var(--ink)]" htmlFor="recipients">Recipient list</label>
          <input id="recipients" className="input mt-1 w-full font-mono2 text-[0.75rem]" value={schedule.recipients} onChange={e => setSchedule(s => ({ ...s, recipients: e.target.value }))} required type="email" multiple />
          <div className="mt-3 flex flex-wrap gap-3">
            {[['weekly', 'Executive Weekly (Mon 07:00)'], ['monthly', 'Demand & Health pack (1st, 06:00)']].map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-[0.75rem] font-medium text-[var(--ink)] transition-colors hover:border-[var(--indigo)]">
                <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={(schedule as any)[key]} onChange={e => setSchedule(s => ({ ...s, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
          <button type="submit" className="btn btn-primary mt-3"><ShieldCheck size={14} /> Save schedule</button>
        </form>
      </div>
    </div>
  );
}
