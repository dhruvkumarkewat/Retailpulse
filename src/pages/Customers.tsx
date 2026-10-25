import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie,
} from 'recharts';
import {
  Users, Download, Banknote, UserCheck, Repeat2, Crown, Search, CheckCircle2, Globe, Layers,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import { computeCustomers, kpis, downloadCSV, groupStats } from '../lib/engine';
import { KpiCard, ChartCard, ChartTooltip, PageHeader, ActiveFilters, DataTable, EmptyState, LoadingState, PALETTE, useFmt, Badge, InfoNote } from '../components/ui';

export default function Customers() {
  const { filtered, status, resetFilters } = useData();
  const { toast } = useSettings();
  const fmt = useFmt();

  const d = useMemo(() => {
    const custs = computeCustomers(filtered);
    const k = kpis(filtered);

    // Real Order Size distribution from dataset
    const orderSizes = groupStats(filtered, r => r.orderSize);

    // Real Market Split (Domestic vs International) from dataset
    const marketSplit = groupStats(filtered, r => r.market);

    // Real Order Value Tier split from dataset
    const tiers = groupStats(filtered, r => r.orderValueTier);

    // Real Region distribution
    const regions = groupStats(filtered, r => r.region);

    const top = custs.slice(0, 40);
    const repeat = custs.filter(c => c.orders >= 2).length;
    const oneAndDone = custs.length - repeat;
    const clv = custs.length ? sumRevenue(custs) / custs.length : 0;

    return { custs, k, orderSizes, marketSplit, tiers, regions, top, repeat, oneAndDone, clv };
  }, [filtered]);

  if (status === 'loading') return <LoadingState label="Building customer 360° profiles…" />;
  const { custs, k, orderSizes, marketSplit, tiers, regions, top, repeat, oneAndDone, clv } = d;

  if (filtered.length === 0) return <div><PageHeader icon={<Users size={20} />} title="Customer Analytics" subtitle="Customer intelligence from every transaction." /><div className="card"><EmptyState action={<button className="btn btn-primary" onClick={resetFilters}>Reset filters</button>} /></div></div>;

  const exportCsv = () => {
    downloadCSV('retailpulse-customers',
      ['Customer ID', 'Account', 'Tier', 'Country', 'Region', 'Orders', 'Revenue', 'Profit', 'Recency (days)', 'Frequency', 'Monetary', 'AOV', 'Return Rate %'],
      custs.map(c => [c.id, c.name, c.segment, c.country, c.region, c.orders, c.revenue.toFixed(2), c.profit.toFixed(2), c.recencyDays, c.frequency, c.monetary.toFixed(2), c.aov.toFixed(2), (c.returnRate * 100).toFixed(1)]));
    toast(`Exported ${custs.length} customer profiles`);
  };

  return (
    <div>
      <PageHeader
        icon={<Users size={20} />}
        title="Customer Analytics"
        subtitle={`360° view: ${custs.length.toLocaleString()} customer accounts profiled from transaction behaviour — value tier, order size, repeat rate and geography.`}
        actions={<button className="btn btn-primary" onClick={exportCsv}><Download size={15} /> Export CSV</button>}
      />
      <ActiveFilters />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Account LTV (avg)" value={clv} format={n => fmt.money(n)} icon={<Banknote size={20} />} accent="indigo" deltaLabel="lifetime revenue / account" />
        <KpiCard label="Repeat Accounts" value={repeat} format={n => fmt.num(n)} icon={<Repeat2 size={20} />} accent="emerald" delta={custs.length ? (repeat / custs.length) * 100 : null} deltaLabel="% with ≥2 transactions" />
        <KpiCard label="Single-Order Accounts" value={oneAndDone} format={n => fmt.num(n)} icon={<UserCheck size={20} />} accent="amber" delta={custs.length ? (oneAndDone / custs.length) * 100 : null} deltaLabel="% single-transaction accounts" invert />
        <KpiCard label="Active Accounts" value={custs.length} format={n => fmt.num(n)} icon={<Crown size={20} />} accent="violet" deltaLabel="in filtered reporting window" />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        {/* Order Size Band */}
        <ChartCard title="Revenue by order size" subtitle="Single / Small vs Standard vs Large vs Bulk" height={240}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={orderSizes} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="key" tick={{ fontSize: 9.5 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1e3)}K`} width={42} />
              <Tooltip content={<ChartTooltip money={fmt.money} />} cursor={{ fill: 'rgba(99,102,241,.08)' }} />
              <Bar dataKey="revenue" name="Revenue" radius={[5, 5, 0, 0]} maxBarSize={40}>
                {orderSizes.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Market Split (Domestic vs International) */}
        <ChartCard title="Market split" subtitle="Domestic (UK) vs International revenue" height={240}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={marketSplit} dataKey="revenue" nameKey="key" innerRadius={52} outerRadius={80} paddingAngle={3} stroke="var(--surface)" strokeWidth={2}>
                {marketSplit.map((_, i) => <Cell key={i} fill={i === 0 ? '#6366f1' : '#22d3ee'} />)}
              </Pie>
              <Tooltip content={<ChartTooltip money={fmt.money} />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Order Value Tier Breakdown */}
        <ChartCard title="Order value tiers" subtitle="High, Medium & Low order tier revenue share" height={240}>
          <div className="flex h-full flex-col justify-center gap-2.5">
            {tiers.map(t => {
              const share = k.revenue ? (t.revenue / k.revenue) * 100 : 0;
              return (
                <div key={t.key} className="flex items-center gap-2">
                  <Badge tone={t.key === 'High' ? 'amber' : t.key === 'Medium' ? 'indigo' : 'gray'}>{t.key} Tier</Badge>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400" style={{ width: `${share}%` }} />
                  </div>
                  <span className="w-24 text-right text-[0.7rem] font-semibold tabular-nums text-[var(--muted)]">{fmt.money(t.revenue)}</span>
                </div>
              );
            })}
            <InfoNote>Every metric, order size band and value tier is computed live from RetailPulse_Clean_Dataset.csv.</InfoNote>
          </div>
        </ChartCard>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <ChartCard className="xl:col-span-1" title="Region revenue & profit" subtitle="Revenue across 6 global regions" height={215}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regions} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="key" tick={{ fontSize: 9.5 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1e3)}K`} width={42} />
              <Tooltip content={<ChartTooltip money={fmt.money} />} cursor={{ fill: 'rgba(99,102,241,.08)' }} />
              <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[5, 5, 0, 0]} maxBarSize={36} />
              <Bar dataKey="profit" name="Profit" fill="#34d399" radius={[5, 5, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* top customers table */}
        <div className="card p-4 sm:p-5 xl:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[0.85rem] font-bold text-[var(--ink)]">Top 40 customer accounts by revenue</h3>
              <p className="text-[0.7rem] text-[var(--muted)]">Sortable, searchable — click column headers</p>
            </div>
          </div>
          <DataTable
            rows={top}
            pageSize={9}
            searchPlaceholder="Search accounts, invoices, countries…"
            columns={[
              { key: 'name', header: 'Account / Invoice', sortValue: c => c.name, render: c => <span className="font-medium text-[var(--ink)]">{c.name}<span className="block text-[0.62rem] font-normal text-[var(--faint)]">{c.id} · {c.country}</span></span> },
              { key: 'segment', header: 'Value Tier', sortValue: c => c.segment, render: c => <Badge tone={c.segment === 'High' ? 'amber' : 'indigo'}>{c.segment}</Badge> },
              { key: 'orders', header: 'Orders', align: 'right', sortValue: c => c.orders, render: c => fmt.num(c.orders) },
              { key: 'revenue', header: 'Revenue', align: 'right', sortValue: c => c.revenue, render: c => <span className="font-semibold">{fmt.money(c.revenue)}</span> },
              { key: 'profit', header: 'Profit', align: 'right', sortValue: c => c.profit, render: c => <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmt.money(c.profit)}</span> },
              { key: 'recency', header: 'Recency', align: 'right', sortValue: c => c.recencyDays, render: c => <span className="tabular-nums">{c.recencyDays}d</span> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
const sumRevenue = (custs: { revenue: number }[]) => custs.reduce((a, c) => a + c.revenue, 0);
