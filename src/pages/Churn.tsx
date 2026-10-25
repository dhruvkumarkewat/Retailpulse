import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  UserX, Download, ShieldAlert, ShieldCheck, AlertTriangle, Wallet, Mail, Copy, CheckCircle2,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import { churnAnalysis, downloadCSV, type ChurnLevel } from '../lib/engine';
import { KpiCard, ChartCard, ChartTooltip, PageHeader, ActiveFilters, DataTable, EmptyState, LoadingState, useFmt, Badge, InfoNote } from '../components/ui';

export default function Churn() {
  const { filtered, status, resetFilters } = useData();
  const { toast } = useSettings();
  const fmt = useFmt();
  const [level, setLevel] = useState<ChurnLevel | 'All'>('All');
  const [copied, setCopied] = useState(false);

  const d = useMemo(() => {
    const scored = churnAnalysis(filtered);
    const counts = { High: 0, Medium: 0, Low: 0 };
    let revenueAtRisk = 0, highRiskRevenue = 0;
    for (const c of scored) {
      counts[c.churnRisk]++;
      if (c.churnRisk !== 'Low') revenueAtRisk += c.monetary;
      if (c.churnRisk === 'High') highRiskRevenue += c.monetary;
    }
    const visible = (level === 'All' ? scored : scored.filter(c => c.churnRisk === level)).slice(0, 150);
    const dist = [
      { name: 'High risk', value: counts.High, fill: '#f43f5e' },
      { name: 'Medium risk', value: counts.Medium, fill: '#f59e0b' },
      { name: 'Low risk', value: counts.Low, fill: '#10b981' },
    ];
    // driver frequency across high+medium risk
    const driverCount = new Map<string, number>();
    for (const c of scored) {
      if (c.churnRisk === 'Low') continue;
      for (const f of c.factors) {
        const key = f.split(' (')[0].split(' — ')[0];
        driverCount.set(key, (driverCount.get(key) ?? 0) + 1);
      }
    }
    const drivers = [...driverCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
    return { scored, counts, revenueAtRisk, highRiskRevenue, visible, dist, drivers };
  }, [filtered, level]);

  if (status === 'loading') return <LoadingState label="Scoring churn risk across customers…" />;
  const { scored, counts, revenueAtRisk, highRiskRevenue, visible, dist, drivers } = d;

  if (filtered.length === 0) return <div><PageHeader icon={<UserX size={20} />} title="Customer Churn" subtitle="Weighted early-warning scoring." /><div className="card"><EmptyState action={<button className="btn btn-primary" onClick={resetFilters}>Reset filters</button>} /></div></div>;

  const exportCsv = () => {
    downloadCSV('retailpulse-churn-risk',
      ['Customer ID', 'Name', 'Risk', 'Score (0–100)', 'Recency (days)', 'Orders', 'Revenue', 'Avg Discount %', 'Return Rate %', 'Top Factor'],
      scored.map(c => [c.id, c.name, c.churnRisk, c.churnScore, c.recencyDays, c.orders, c.monetary.toFixed(2), (c.avgDiscount * 100).toFixed(1), (c.returnRate * 100).toFixed(1), c.factors[0]]));
    toast(`Exported ${scored.length} scored customers`);
  };
  const winBackScript = `Hi {{first_name}}, it's been ${'{{days}}'} days since your last order. ` +
    `As one of our valued ${level === 'All' ? 'customers' : level.toLowerCase() + '-risk'} customers, here is 15% toward your next purchase — no strings attached. Reply STOP to opt out.`;

  return (
    <div>
      <PageHeader
        icon={<UserX size={20} />}
        title="Customer Churn"
        subtitle="Weighted early-warning system — every score shows its drivers. Not a black box: read the formula, then act."
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => { navigator.clipboard?.writeText(winBackScript); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <CheckCircle2 size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Win-back script'}</button>
            <button className="btn btn-primary" onClick={exportCsv}><Download size={15} /> Export CSV</button>
          </>
        }
      />
      <ActiveFilters />

      {/* methodology banner */}
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <div className="card border-l-4 !border-l-cyan-500 p-4 xl:col-span-2 sm:p-5">
          <p className="kpi-label flex items-center gap-1.5"><ShieldAlert size={13} className="text-cyan-600 dark:text-cyan-400" /> Real dataset classification</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.73rem] sm:grid-cols-3">
            {[['Recency Days', 'Dataset metric', 'Days elapsed from order date (0–373d)'], ['Churn Risk', 'Direct column', 'High, Medium & Low risk classes'], ['Order Value Tier', 'Value driver', 'High, Medium & Low order profiles'], ['Order Size', 'Volume driver', 'Single / Small (1-5) to Bulk (100+)'], ['Stock Suggestion', 'Catalog signal', 'Maintain Stock vs Reduce Stock'], ['Geography', 'Market mix', 'Domestic UK vs International accounts']].map(([l, w, f]) => (
              <div key={l} className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1.5">
                <p className="font-bold text-[var(--ink)]">{l} <span className="font-mono2 text-[0.65rem] text-cyan-700 dark:text-cyan-300">{w}</span></p>
                <p className="text-[0.62rem] text-[var(--muted)]">{f}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[0.68rem] text-[var(--faint)]">Derived directly from the verified <span className="font-bold text-cyan-500">Churn Risk</span> column in RetailPulse_Clean_Dataset.csv: <span className="font-bold text-rose-500">High ({counts.High})</span> · <span className="font-bold text-amber-500">Medium ({counts.Medium})</span> · <span className="font-bold text-emerald-500">Low ({counts.Low})</span>.</p>
        </div>
        <InfoNote><span className="font-semibold text-[var(--ink)]">Dataset truth:</span> Churn risks shown here reflect the validated Churn Risk and Recency Days columns directly from RetailPulse_Clean_Dataset.csv — no simulated or mock records.</InfoNote>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="High Risk" value={counts.High} format={n => String(Math.round(n))} icon={<ShieldAlert size={20} />} accent="rose" deltaLabel={`${fmt.money(highRiskRevenue)} lifetime revenue on the line`} />
        <KpiCard label="Medium Risk" value={counts.Medium} format={n => String(Math.round(n))} icon={<AlertTriangle size={20} />} accent="amber" deltaLabel="nurture within 30 days" />
        <KpiCard label="Low Risk" value={counts.Low} format={n => String(Math.round(n))} icon={<ShieldCheck size={20} />} accent="emerald" deltaLabel="healthy base" />
        <KpiCard label="Revenue at Risk" value={revenueAtRisk} format={n => fmt.money(n)} icon={<Wallet size={20} />} accent="violet" deltaLabel="High + Medium lifetime value" invert />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-5">
        <ChartCard title="Risk distribution" subtitle="Customers by churn band" height={250}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dist} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={4} stroke="var(--surface)" strokeWidth={2}>
                {dist.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip content={<ChartTooltip money={fmt.money} />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard className="xl:col-span-2" title="Top risk drivers" subtitle="Why high/medium-risk customers score high" height={250}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...drivers].reverse()} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 9.5 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(99,102,241,.08)' }} content={({ active, payload }: any) => active && payload?.length ? <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--tooltip-bg)] px-2.5 py-1.5 text-xs shadow"><b>{payload[0].payload.count}</b> customers flagged</div> : null} />
              <Bar dataKey="count" name="Customers" fill="#f43f5e" radius={[0, 5, 5, 0]} maxBarSize={15} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* recommended action card */}
        <section className="card flex flex-col gap-2 border-l-4 !border-l-rose-500 p-4 sm:p-5">
          <p className="kpi-label flex items-center gap-1.5 text-rose-500"><Mail size={13} /> Recommended play</p>
          <p className="text-[0.8rem] font-bold text-[var(--ink)]">Win-back sprint for the {counts.High} high-risk customers</p>
          <ol className="list-decimal space-y-1 pl-4 text-[0.72rem] leading-snug text-[var(--muted)]">
            <li>Personal outreach within 7 days — 15% voucher + free shipping.</li>
            <li>Formerly-frequent customers: assign to account manager, not email blast.</li>
            <li>Discount-dependent churners: switch to loyalty points, kill margin-leaking coupons.</li>
            <li>High-return churners: quality-issue triage before any offer.</li>
          </ol>
          <p className="mt-auto rounded-lg bg-[var(--surface-2)] p-2 font-mono2 text-[0.62rem] leading-snug text-[var(--muted)]">“Hi {'{first_name}'}, it's been {'{days}'} days — here's 15% toward your next order…” <span className="text-[var(--indigo)]">(copy via button above)</span></p>
        </section>
      </div>

      <div className="card mt-3 p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[0.85rem] font-bold text-[var(--ink)]">Churn risk register</h3>
          <div className="flex items-center gap-1.5">
            {(['All', 'High', 'Medium', 'Low'] as const).map(l => (
              <button key={l} onClick={() => setLevel(l)} className={`rounded-lg px-2.5 py-1 text-[0.7rem] font-bold transition-all ${level === l ? 'bg-[var(--indigo)] text-white shadow' : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)]'}`}>{l}{l !== 'All' && ` (${counts[l]})`}</button>
            ))}
          </div>
        </div>
        <DataTable
          rows={visible}
          pageSize={12}
          searchPlaceholder="Search at-risk customers…"
          columns={[
            { key: 'name', header: 'Customer', sortValue: c => c.name, render: c => <span className="font-medium">{c.name}<span className="block text-[0.6rem] text-[var(--faint)]">{c.id} · {c.country}</span></span> },
            { key: 'risk', header: 'Risk', sortValue: c => c.churnScore, render: c => <Badge tone={c.churnRisk === 'High' ? 'red' : c.churnRisk === 'Medium' ? 'amber' : 'green'}>{c.churnRisk} · {c.churnScore}</Badge> },
            { key: 'score', header: 'Score bar', width: '140px', render: c => <div className="h-2 w-32 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className={`h-full rounded-full ${c.churnRisk === 'High' ? 'bg-rose-500' : c.churnRisk === 'Medium' ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${c.churnScore}%` }} /></div> },
            { key: 'rec', header: 'Recency', align: 'right', sortValue: c => c.recencyDays, render: c => <span className="tabular-nums">{c.recencyDays}d</span> },
            { key: 'orders', header: 'Orders', align: 'right', sortValue: c => c.orders, render: c => c.orders },
            { key: 'rev', header: 'Lifetime $', align: 'right', sortValue: c => c.monetary, render: c => fmt.money(c.monetary) },
            { key: 'factor', header: 'Primary factor', render: c => <span className="text-[0.68rem] text-[var(--muted)]">{c.factors[0]}</span> },
          ]}
        />
      </div>
    </div>
  );
}
