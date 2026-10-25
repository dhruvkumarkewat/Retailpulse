import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ComposedChart, Line,
} from 'recharts';
import {
  Globe2, Download, TrendingUp, Banknote, ShoppingCart, MapPin, Trophy, Search, X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import { groupStats, groupBy, kpis, byMonth, downloadCSV, sumBy } from '../lib/engine';
import { KpiCard, ChartCard, ChartTooltip, PageHeader, ActiveFilters, DataTable, EmptyState, LoadingState, PALETTE, useFmt, Badge, InfoNote } from '../components/ui';

export default function Countries() {
  const { filtered, status, resetFilters } = useData();
  const { toast } = useSettings();
  const fmt = useFmt();
  const [selected, setSelected] = useState<string | null>(null);

  const d = useMemo(() => {
    const countries = groupStats(filtered, r => r.country);
    const regions = groupStats(filtered, r => r.region);
    const drill = selected ? groupStats(filtered.filter(r => r.country === selected), r => r.city) : [];
    const drillMonthly = selected ? byMonth(filtered.filter(r => r.country === selected)) : [];
    const sel = countries.find(c => c.key === selected);
    return { countries, regions, drill, drillMonthly, sel };
  }, [filtered, selected]);

  if (status === 'loading') return <LoadingState label="Aggregating 35 markets…" />;
  const { countries, regions, drill, drillMonthly, sel } = d;

  if (filtered.length === 0) return <div><PageHeader icon={<Globe2 size={20} />} title="Country Analysis" subtitle="35 markets." /><div className="card"><EmptyState action={<button className="btn btn-primary" onClick={resetFilters}>Reset filters</button>} /></div></div>;

  const exportCsv = () => {
    downloadCSV('retailpulse-countries',
      ['Country', 'Revenue', 'Profit', 'Orders', 'Qty', 'Margin %', 'AOV', 'Returns', 'Share of Revenue %'],
      (() => { const total = sumBy(countries, c => c.revenue) || 1; return countries.map(c => [c.key, c.revenue.toFixed(2), c.profit.toFixed(2), c.orders, c.qty, c.margin.toFixed(1), c.aov.toFixed(2), c.returns, ((c.revenue / total) * 100).toFixed(2)]); })());
    toast('Country analysis exported');
  };
  const totalRevenue = sumBy(countries, c => c.revenue);
  const leader = countries[0] || { key: 'United Kingdom', revenue: 0, orders: 0, profit: 0, margin: 0, returns: 0 };
  const ukRevenue = countries.find(c => c.key === 'United Kingdom')?.revenue ?? 0;

  return (
    <div>
      <PageHeader
        icon={<Globe2 size={20} />}
        title="Country Analysis"
        subtitle="35 global markets across 6 regions — revenue, profitability and order volume per geography. Click a country to drill down."
        actions={<button className="btn btn-primary" onClick={exportCsv}><Download size={15} /> Export CSV</button>}
      />
      <ActiveFilters />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Markets Covered" value={countries.length} format={n => String(Math.round(n))} icon={<Globe2 size={20} />} accent="indigo" />
        <KpiCard label="Leading Market" value={leader.revenue} format={n => fmt.money(n)} icon={<Trophy size={20} />} accent="amber" deltaLabel={leader.key} />
        <KpiCard label="Regions" value={regions.length} format={n => String(Math.round(n))} icon={<MapPin size={20} />} accent="cyan" deltaLabel="Europe · APAC · Americas · ME · Africa" />
        <KpiCard label="International Share" value={totalRevenue > 0 ? ((totalRevenue - ukRevenue) / totalRevenue) * 100 : 0} format={n => n.toFixed(1) + '%'} icon={<TrendingUp size={20} />} accent="emerald" deltaLabel="non-UK international export" />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-5">
        <ChartCard className="xl:col-span-3" title="Revenue by market" subtitle="Click a bar to drill down into its cities" height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={countries} margin={{ top: 6, right: 4, left: 0, bottom: 34 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="key" interval={0} tick={{ fontSize: 9, angle: -32, textAnchor: 'end', height: 60 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1e3)}K`} width={44} />
              <Tooltip content={<ChartTooltip money={fmt.money} />} cursor={{ fill: 'rgba(99,102,241,.08)' }} />
              <Bar dataKey="revenue" name="Revenue" radius={[5, 5, 0, 0]} maxBarSize={44} onClick={(d: any) => setSelected(sel?.key === d?.key ? null : d?.key ?? null)} className="cursor-pointer">
                {countries.map((c, i) => <Cell key={i} fill={c.key === selected ? '#f59e0b' : PALETTE[i % PALETTE.length]} opacity={selected && c.key !== selected ? 0.35 : 1} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard className="xl:col-span-2" title="Region economics" subtitle="Revenue vs profit by region" height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regions} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="key" tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1e3)}K`} width={44} />
              <Tooltip content={<ChartTooltip money={fmt.money} />} cursor={{ fill: 'rgba(99,102,241,.08)' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[5, 5, 0, 0]} maxBarSize={38} />
              <Bar dataKey="profit" name="Profit" fill="#22d3ee" radius={[5, 5, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ============ DRILL-DOWN PANEL ============ */}
      {selected && sel && (
        <div className="card mt-3 border-2 !border-[var(--indigo)]/40 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="kpi-label flex items-center gap-1.5 text-[var(--indigo)]"><MapPin size={13} /> Drill-down — {selected}</p>
              <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">{sel.orders.toLocaleString()} orders · {fmt.money(sel.revenue)} revenue · {fmt.money(sel.profit)} profit · {sel.margin.toFixed(1)}% margin · {((sel.returns / sel.orders) * 100).toFixed(1)}% returns</p>
            </div>
            <button className="btn btn-ghost !px-2.5" onClick={() => setSelected(null)} aria-label="Close drill-down"><X size={15} /> Close</button>
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <ChartCard title={`Monthly revenue — ${selected}`} subtitle="Time series inside the drill-down" height={210}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={drillMonthly} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9.5 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={26} />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1e3)}K`} width={40} />
                  <Tooltip content={<ChartTooltip money={fmt.money} />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#818cf8" radius={[3, 3, 0, 0]} maxBarSize={14} />
                  <Line dataKey="profit" name="Profit" stroke="#22d3ee" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="City breakdown" subtitle="Revenue by city, descending" height={210}>
              <div className="h-full overflow-y-auto">
                <table className="w-full">
                  <thead><tr><th className="th">City</th><th className="th text-right">Orders</th><th className="th text-right">Revenue</th><th className="th text-right">Margin</th></tr></thead>
                  <tbody>{drill.map(c => <tr key={c.key} className="tr-hover"><td className="td font-semibold">{c.key}</td><td className="td text-right tabular-nums">{c.orders}</td><td className="td text-right tabular-nums">{fmt.money(c.revenue)}</td><td className="td text-right tabular-nums">{c.margin.toFixed(1)}%</td></tr>)}</tbody>
                </table>
              </div>
            </ChartCard>
          </div>
        </div>
      )}

      <div className="card mt-3 p-4 sm:p-5">
        <h3 className="mb-2 text-[0.85rem] font-bold text-[var(--ink)]">Full market scorecard</h3>
        <DataTable
          rows={countries}
          pageSize={10}
          searchPlaceholder="Search countries…"
          columns={[
            { key: 'country', header: 'Country', sortValue: c => c.key, render: c => <button className="font-semibold text-[var(--indigo)] hover:underline" onClick={() => setSelected(selected === c.key ? null : c.key)}>{c.key}</button> },
            { key: 'revenue', header: 'Revenue', align: 'right', sortValue: c => c.revenue, render: c => fmt.money(c.revenue) },
            { key: 'profit', header: 'Profit', align: 'right', sortValue: c => c.profit, render: c => <span className={c.profit < 0 ? 'text-rose-500' : ''}>{fmt.money(c.profit)}</span> },
            { key: 'orders', header: 'Orders', align: 'right', sortValue: c => c.orders, render: c => fmt.num(c.orders) },
            { key: 'qty', header: 'Units', align: 'right', sortValue: c => c.qty, render: c => fmt.num(c.qty) },
            { key: 'margin', header: 'Margin', align: 'right', sortValue: c => c.margin, render: c => <Badge tone={c.margin < 5 ? 'amber' : 'green'}>{c.margin.toFixed(1)}%</Badge> },
            { key: 'aov', header: 'AOV', align: 'right', sortValue: c => c.aov, render: c => fmt.money(c.aov, 2) },
            { key: 'returns', header: 'Returns', align: 'right', sortValue: c => c.returns, render: c => c.returns },
          ]}
        />
      </div>
    </div>
  );
}
