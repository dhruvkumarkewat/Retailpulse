import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, Download, Gauge, Target, FlaskConical, CircleCheck, Info, LineChart,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import { byMonth, buildForecast, downloadCSV } from '../lib/engine';
import { KpiCard, ChartCard, ChartTooltip, PageHeader, ActiveFilters, EmptyState, LoadingState, useFmt, Badge, InfoNote } from '../components/ui';

export default function Forecast() {
  const { filtered, status, resetFilters } = useData();
  const { settings, toast } = useSettings();
  const fmt = useFmt();
  const [horizon, setHorizon] = useState<number>(settings.defaultHorizon);

  const monthly = useMemo(() => byMonth(filtered), [filtered]);
  const result = useMemo(() => buildForecast(monthly, horizon), [monthly, horizon]);

  if (status === 'loading') return <LoadingState label="Replaying monthly history…" />;

  if (filtered.length === 0 || !result) {
    return <div><PageHeader icon={<TrendingUp size={20} />} title="Demand Forecasting" subtitle="Back-tested monthly demand projection." />
      <div className="card"><EmptyState title={filtered.length === 0 ? 'No data for this selection' : 'Not enough monthly history in this window'} hint="The model needs ≥ 14 months of monthly revenue. Widen the date range." action={<button className="btn btn-primary" onClick={resetFilters}>Reset filters</button>} /></div></div>;
  }

  const futureOnly = result.history.filter(h => h.forecast != null);
  const fcTotal = futureOnly.reduce((a, h) => a + (h.forecast ?? 0), 0);
  const lastActual = [...result.history].reverse().find(h => h.actual != null)!;
  const firstFc = futureOnly[0];
  const momentum = lastActual.actual! > 0 ? ((firstFc.forecast! - lastActual.actual!) / lastActual.actual!) * 100 : 0;
  const holdout = result.metrics;
  const bestIsNaive = result.bestModel.startsWith('Seasonal');

  const exportCsv = () => {
    downloadCSV('retailpulse-demand-forecast',
      ['Month', 'Actual', 'Fitted', 'Forecast', 'Lower 95%', 'Upper 95%'],
      result.history.map(h => [h.label, h.actual?.toFixed(2) ?? '', h.fitted?.toFixed(2) ?? '', h.forecast?.toFixed(2) ?? '', h.lower?.toFixed(2) ?? '', h.upper?.toFixed(2) ?? '']));
    toast('Forecast series exported');
  };

  return (
    <div>
      <PageHeader
        icon={<TrendingUp size={20} />}
        title="Demand Forecasting"
        subtitle="Holt's linear trend with a strict chronological holdout. Baselines benchmarked. Confidence bands shown. No black box."
        actions={
          <>
            <div className="flex items-center rounded-lg border border-[var(--border-strong)] p-0.5" role="group" aria-label="Forecast horizon">
              {[3, 6, 12].map(h => <button key={h} onClick={() => setHorizon(h)} className={`rounded-md px-3 py-1.5 text-[0.72rem] font-bold transition-all ${horizon === h ? 'bg-[var(--indigo)] text-white shadow' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{h} mo</button>)}
            </div>
            <button className="btn btn-primary" onClick={exportCsv}><Download size={15} /> Export CSV</button>
          </>
        }
      />
      <ActiveFilters />
      <InfoNote><span className="font-semibold text-[var(--ink)]">Read this first:</span> the last 6 months were <em>never shown to the model during fitting</em>. The table below scores predictions on that untouched window. The production line is fit on all {result.history.filter(h => h.actual != null).length} months. If a naive baseline beats Holt’s on your filter window, RetailPulse says so out loud.</InfoNote>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={`Next ${horizon}-month demand`} value={fcTotal} format={n => fmt.money(n)} icon={<TrendingUp size={20} />} accent="indigo" deltaLabel={`projected gross revenue`} />
        <KpiCard label="First forecast month" value={firstFc.forecast ?? 0} format={n => fmt.money(n)} icon={<LineChart size={20} />} accent="cyan" delta={momentum} deltaLabel="vs last actual month" />
        <KpiCard label="Holdout MAPE (best)" value={Math.min(...holdout.map(m => m.mape))} format={n => n.toFixed(1) + '%'} icon={<Target size={20} />} accent="emerald" deltaLabel="mean abs % error, 6-mo holdout" invert />
        <KpiCard label="Holdout Winner" value={1} format={() => result.bestModel.split(' ')[0]} icon={<FlaskConical size={20} />} accent="violet" deltaLabel={result.bestModel} />
      </div>

      {/* main forecast chart */}
      <ChartCard className="mt-3" title="Monthly revenue — history, holdout, projection" subtitle="Dashed region = out-of-sample projection with 95% prediction interval" height={330}
        right={bestIsNaive ? <Badge tone="amber">Naive baseline won holdout — tread carefully</Badge> : <Badge tone="green"><CircleCheck size={11} />Holt’s trend won holdout</Badge>}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={result.history} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9.5 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={22} />
            <YAxis tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1e3)}K`} width={44} />
            <Tooltip content={<ChartTooltip money={fmt.money} />} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
            <Area dataKey="upper" name="95% band (upper)" stroke="none" fill="#a5b4fc" fillOpacity={0.3} legendType="square" />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="#6366f1" strokeWidth={2.6} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="fitted" name="Fitted" stroke="#94a3b8" strokeWidth={1.4} strokeDasharray="2 3" dot={false} />
            <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#f59e0b" strokeWidth={2.6} strokeDasharray="7 4" dot={{ r: 3.5, fill: '#f59e0b' }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        {/* holdout leaderboard */}
        <div className="card p-4 sm:p-5">
          <p className="kpi-label flex items-center gap-1.5"><Gauge size={13} className="text-[var(--indigo)]" /> Holdout scoreboard — last 6 months, never trained on</p>
          <table className="mt-2 w-full">
            <thead><tr><th className="th">Model</th><th className="th text-right">MAE ↓</th><th className="th text-right">RMSE ↓</th><th className="th text-right">MAPE ↓</th><th className="th"></th></tr></thead>
            <tbody>
              {[...holdout].sort((a, b) => a.mape - b.mape).map((m, i) => (
                <tr key={m.name} className={`tr-hover ${i === 0 ? 'bg-emerald-500/5' : ''}`}>
                  <td className="td text-[0.78rem] font-semibold">{m.name}</td>
                  <td className="td text-right tabular-nums">{fmt.money(m.mae)}</td>
                  <td className="td text-right tabular-nums">{fmt.money(m.rmse)}</td>
                  <td className="td text-right tabular-nums font-bold">{m.mape.toFixed(2)}%</td>
                  <td className="td">{i === 0 && <Badge tone="green">Winner</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[0.66rem] leading-snug text-[var(--faint)]">Lower is better on all three. Baselines: seasonal-naive repeats the value 12 months prior; 3-month moving average projects the trailing quarter mean. Holt’s uses α=0.72, β=0.28.</p>
        </div>

        {/* month-by-month projection */}
        <div className="card p-4 sm:p-5">
          <p className="kpi-label">Projection by month — {horizon} months out</p>
          <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
            {futureOnly.map((h) => {
              const pctOfMax = (h.forecast ?? 0) / Math.max(...futureOnly.map(f => f.forecast ?? 1));
              return (
                <div key={h.label} className="flex items-center gap-2 text-[0.74rem]">
                  <span className="w-12 shrink-0 font-mono2 font-semibold text-[var(--muted)]">{h.label}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded-md bg-[var(--surface-2)]"><div className="h-full rounded-md bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${pctOfMax * 100}%` }} /></div>
                  <span className="w-20 shrink-0 text-right font-bold tabular-nums text-[var(--ink)]">{fmt.money(h.forecast ?? 0)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-[0.68rem] leading-snug text-[var(--muted)]">
            <span className="font-bold text-amber-600 dark:text-amber-400">Planning guidance:</span> order ≈ {fmt.money(Math.min(...futureOnly.map(h => h.forecast ?? 0)))}–{fmt.money(Math.max(...futureOnly.map(h => h.forecast ?? 0)))} monthly revenue capacity. If two consecutive actual months land below the lower band, re-check the trend assumption — seasonality dominates Q4 volume (Nov +28%, Dec +24% vs average month).
          </div>
        </div>
      </div>

      {/* backtest detail */}
      <div className="card mt-3 p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[0.85rem] font-bold text-[var(--ink)]">Holdout autopsy — actual vs both contenders</h3>
          <Badge tone="indigo">Last 6 months · out-of-sample</Badge>
        </div>
        <table className="w-full">
          <thead><tr><th className="th">Month</th><th className="th text-right">Actual</th><th className="th text-right">Seasonal naive</th><th className="th text-right">Holt’s</th><th className="th text-right">SN error %</th><th className="th text-right">Holt error %</th></tr></thead>
          <tbody>
            {result.backtestRows.map(r => {
              const snErr = r.actual ? ((r.actual - r.baseline) / r.actual) * 100 : 0;
              const hErr = r.actual ? ((r.actual - r.holt) / r.actual) * 100 : 0;
              return (
                <tr key={r.label} className="tr-hover">
                  <td className="td font-semibold">{r.label}</td>
                  <td className="td text-right tabular-nums font-bold">{fmt.money(r.actual)}</td>
                  <td className="td text-right tabular-nums">{fmt.money(r.baseline)}</td>
                  <td className="td text-right tabular-nums">{fmt.money(r.holt)}</td>
                  <td className={`td text-right tabular-nums ${Math.abs(snErr) > 15 ? 'text-rose-500' : ''}`}>{snErr >= 0 ? '+' : ''}{snErr.toFixed(1)}%</td>
                  <td className={`td text-right tabular-nums ${Math.abs(hErr) > 15 ? 'text-rose-500' : ''}`}>{hErr >= 0 ? '+' : ''}{hErr.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
