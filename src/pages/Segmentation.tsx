import React, { useMemo, useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis, BarChart, Bar, Legend,
} from 'recharts';
import {
  PieChart as PieIcon, Download, Crown, Shield, Sparkles, UserPlus, MinusCircle, AlertTriangle, Skull, MoonStar, Rocket,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import { computeCustomers, segmentOf, downloadCSV, type SegmentName } from '../lib/engine';
import { KpiCard, ChartCard, ChartTooltip, PageHeader, ActiveFilters, DataTable, EmptyState, LoadingState, useFmt, Badge, InfoNote } from '../components/ui';

const SEGMENT_META: Record<SegmentName, { tone: 'green' | 'violet' | 'cyan' | 'indigo' | 'amber' | 'red' | 'gray'; icon: React.ReactNode; desc: string }> = {
  'Champions': { tone: 'green', icon: <Crown size={14} />, desc: 'Best recency, frequency and monetary scores — reward and upsell.' },
  'Loyal Customers': { tone: 'violet', icon: <Shield size={14} />, desc: 'Consistent buyers with strong frequency — deepen relationship.' },
  'Potential Loyalists': { tone: 'cyan', icon: <Sparkles size={14} />, desc: 'Recent with moderate frequency — push to loyalty tier.' },
  'New Customers': { tone: 'indigo', icon: <UserPlus size={14} />, desc: 'Single recent order — onboard and cross-sell.' },
  'Promising': { tone: 'cyan', icon: <Rocket size={14} />, desc: 'Mid recency, low frequency — nurture with targeted offers.' },
  'At Risk': { tone: 'amber', icon: <AlertTriangle size={14} />, desc: 'Were frequent, going quiet — win-back before churn.' },
  'Cant Lose Them': { tone: 'red', icon: <MinusCircle size={14} />, desc: 'High-value, inactive now — personal outreach required.' },
  'Hibernating': { tone: 'gray', icon: <MoonStar size={14} />, desc: 'Low recency and frequency — low-cost reactivation only.' },
  'Lost': { tone: 'red', icon: <Skull size={14} />, desc: 'Dormant across the board — cheapest possible reactivation.' },
};

export default function Segmentation() {
  const { filtered, status, resetFilters } = useData();
  const { toast } = useSettings();
  const fmt = useFmt();
  const [activeSegment, setActiveSegment] = useState<SegmentName | 'All'>('All');

  const d = useMemo(() => {
    const custs = computeCustomers(filtered).map(c => ({ ...c, seg: segmentOf(c) }));
    const summary = (Object.keys(SEGMENT_META) as SegmentName[]).map(name => {
      const arr = custs.filter(c => c.seg === name);
      const rev = arr.reduce((a, c) => a + c.revenue, 0);
      return { name, count: arr.length, revenue: Math.round(rev), avgMonetary: arr.length ? rev / arr.length : 0, share: custs.length ? (arr.length / custs.length) * 100 : 0, avgRecency: arr.length ? arr.reduce((a, c) => a + c.recencyDays, 0) / arr.length : 0 };
    }).filter(s => s.count > 0).sort((a, b) => b.revenue - a.revenue);
    const visible = activeSegment === 'All' ? custs : custs.filter(c => c.seg === activeSegment);
    const avgRfm = custs.length ? custs.reduce((a, c) => a + c.rfm, 0) / custs.length : 0;
    return { custs, summary, visible, avgRfm, champions: summary.find(s => s.name === 'Champions')?.count ?? 0 };
  }, [filtered, activeSegment]);

  if (status === 'loading') return <LoadingState label="Computing RFM quintiles…" />;
  const { custs, summary, visible, avgRfm, champions } = d;

  if (filtered.length === 0) return <div><PageHeader icon={<PieIcon size={20} />} title="Customer Segmentation" subtitle="RFM-based micro segments." /><div className="card"><EmptyState action={<button className="btn btn-primary" onClick={resetFilters}>Reset filters</button>} /></div></div>;

  const exportCsv = () => {
    downloadCSV('retailpulse-segmentation',
      ['Customer ID', 'Name', 'Segment (RFM)', 'R', 'F', 'M', 'RFM Score', 'Recency (days)', 'Orders', 'Revenue', 'Profit', 'Country'],
      custs.map(c => [c.id, c.name, c.seg, c.rScore, c.fScore, c.mScore, c.rfm, c.recencyDays, c.orders, c.revenue.toFixed(2), c.profit.toFixed(2), c.country]));
    toast(`Exported ${custs.length} segmented profiles`);
  };

  return (
    <div>
      <PageHeader
        icon={<PieIcon size={20} />}
        title="Customer Segmentation"
        subtitle="RFM scoring — Recency, Frequency, Monetary — quintile-ranked per customer, then bucketed into 9 actionable segments."
        actions={<button className="btn btn-primary" onClick={exportCsv}><Download size={15} /> Export CSV</button>}
      />
      <ActiveFilters />
      <InfoNote>Scores are quintiles (1–5) computed within the currently filtered window. Recency is inverted — a customer buying <em>today</em> scores 5, one idle for 12 months scores 1. Segment names follow standard RFM marketing practice.</InfoNote>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Champions" value={champions} format={n => String(Math.round(n))} icon={<Crown size={20} />} accent="emerald" deltaLabel="best-value customers" />
        <KpiCard label="Avg RFM Score" value={avgRfm} format={n => n.toFixed(1) + ' / 15'} icon={<Sparkles size={20} />} accent="violet" deltaLabel="base health indicator" />
        <KpiCard label="Customers Scored" value={custs.length} format={n => String(Math.round(n))} icon={<PieIcon size={20} />} accent="indigo" />
        <KpiCard label="Segments Active" value={summary.length} format={n => String(Math.round(n))} icon={<Rocket size={20} />} accent="cyan" deltaLabel="of 9 possible buckets" />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-5">
        {/* RFM scatter */}
        <ChartCard className="xl:col-span-3" title="Recency vs Monetary map" subtitle="Bubble size = order frequency · colored by segment" height={340}
          right={<select className="select !py-1.5 text-[0.72rem]" value={activeSegment} onChange={e => setActiveSegment(e.target.value as any)} aria-label="Filter scatter by segment"><option value="All">All segments</option>{Object.keys(SEGMENT_META).map(s => <option key={s} value={s}>{s}</option>)}</select>}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" />
              <XAxis type="number" dataKey="recencyDays" name="Recency" tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} label={{ value: 'Recency (days since last order) →', position: 'insideBottom', offset: -2, fontSize: 10, fill: 'var(--muted)' }} reversed />
              <YAxis type="number" dataKey="monetary" name="Monetary" tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1e3)}K`} width={44} />
              <ZAxis type="number" dataKey="frequency" range={[28, 260]} />
              <Tooltip cursor={{ strokeDasharray: '4 4' }} content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--tooltip-bg)] px-3 py-2 text-[0.72rem] shadow-lg">
                    <p className="font-bold text-[var(--tooltip-ink)]">{p.name} <span className="font-mono2 text-[0.6rem] text-[var(--faint)]">{p.id}</span></p>
                    <p className="mt-0.5 text-[var(--muted)]">{p.seg} · {p.orders} orders · {fmt.money(p.monetary)}</p>
                    <p className="text-[var(--muted)]">Recency {p.recencyDays}d · R{p.rScore} F{p.fScore} M{p.mScore}</p>
                  </div>
                );
              }} />
              <Scatter data={visible} fillOpacity={0.75} stroke="var(--surface)" strokeWidth={0.6}>
                {visible.map((c, i) => <Cell key={i} fill={Object.keys(SEGMENT_META).indexOf(c.seg) % 2 === 0 ? '#6366f1' : ['#22d3ee', '#a78bfa', '#34d399', '#f59e0b', '#fb7185', '#60a5fa', '#f472b6', '#94a3b8'][Object.keys(SEGMENT_META).indexOf(c.seg) % 8]} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* segment summary list */}
        <div className="card flex flex-col p-4 sm:p-5 xl:col-span-2">
          <h3 className="text-[0.85rem] font-bold text-[var(--ink)]">Segment playbook</h3>
          <p className="mb-2 mt-0.5 text-[0.7rem] text-[var(--muted)]">Ranked by revenue contribution — click to filter the table below.</p>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {summary.map(s => (
              <button key={s.name} onClick={() => setActiveSegment(activeSegment === s.name ? 'All' : s.name)}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all ${activeSegment === s.name ? 'border-[var(--indigo)] bg-[var(--indigo-soft)] ring-1 ring-[var(--indigo)]' : 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]'}`}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--indigo)]">{SEGMENT_META[s.name].icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[0.76rem] font-bold text-[var(--ink)]">{s.name}</span>
                    <span className="text-[0.72rem] font-semibold tabular-nums text-[var(--muted)]">{fmt.money(s.revenue)}</span>
                  </span>
                  <span className="mt-0.5 block text-[0.63rem] text-[var(--faint)]">{s.count} customers · avg recency {Math.round(s.avgRecency)}d · {s.share.toFixed(0)}% of base</span>
                </span>
                <Badge tone={SEGMENT_META[s.name].tone}>{s.count}</Badge>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-3 p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[0.85rem] font-bold text-[var(--ink)]">Scored customers {activeSegment !== 'All' && <>— <span className="text-[var(--indigo)]">{activeSegment}</span></>}</h3>
          <p className="text-[0.68rem] text-[var(--muted)]">{visible.length} of {custs.length} customers</p>
        </div>
        <DataTable
          rows={visible.slice(0, 120)}
          pageSize={10}
          searchPlaceholder="Search customers…"
          columns={[
            { key: 'name', header: 'Customer', sortValue: c => c.name, render: c => <span className="font-medium">{c.name}<span className="block text-[0.6rem] text-[var(--faint)]">{c.id}</span></span> },
            { key: 'seg', header: 'Segment', sortValue: c => c.seg, render: c => <Badge tone={SEGMENT_META[c.seg].tone}>{c.seg}</Badge> },
            { key: 'r', header: 'R', align: 'center', sortValue: c => c.rScore, render: c => <span className="tabular-nums font-bold">{c.rScore}</span> },
            { key: 'f', header: 'F', align: 'center', sortValue: c => c.fScore, render: c => <span className="tabular-nums font-bold">{c.fScore}</span> },
            { key: 'm', header: 'M', align: 'center', sortValue: c => c.mScore, render: c => <span className="tabular-nums font-bold">{c.mScore}</span> },
            { key: 'rfm', header: 'RFM', align: 'center', sortValue: c => c.rfm, render: c => <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 font-mono2 text-[0.72rem] font-bold">{c.rfm}</span> },
            { key: 'rec', header: 'Recency', align: 'right', sortValue: c => c.recencyDays, render: c => <span className="tabular-nums">{c.recencyDays}d</span> },
            { key: 'rev', header: 'Revenue', align: 'right', sortValue: c => c.revenue, render: c => fmt.money(c.revenue) },
          ]}
        />
      </div>
    </div>
  );
}
