import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Boxes, Download, AlertOctagon, Clock, CheckCircle2, Warehouse, Info,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import { inventoryAnalysis, downloadCSV, type StockStatus } from '../lib/engine';
import { KpiCard, ChartCard, ChartTooltip, PageHeader, ActiveFilters, DataTable, EmptyState, LoadingState, useFmt, Badge, InfoNote } from '../components/ui';

export default function Inventory() {
  const { filtered, status, resetFilters } = useData();
  const { toast } = useSettings();
  const fmt = useFmt();
  const [statusFilter, setStatusFilter] = useState<StockStatus | 'All'>('All');
  const [abcFilter, setAbcFilter] = useState<'All' | 'A' | 'B' | 'C'>('All');

  const d = useMemo(() => {
    const inv = inventoryAnalysis(filtered);
    const counts = { 'Reorder Now': 0, 'Reorder Soon': 0, 'Healthy': 0, 'Overstock Risk': 0 };
    let unitsSold = 0, reorderValue = 0;
    for (const i of inv) { counts[i.status]++; unitsSold += i.unitsSold; if (i.status === 'Reorder Now') reorderValue += i.suggestedReorder * (i.revenue / Math.max(1, i.unitsSold)); }
    const visible = inv.filter(i => (statusFilter === 'All' || i.status === statusFilter) && (abcFilter === 'All' || i.abc === abcFilter));
    const abcRevenue = ['A', 'B', 'C'].map(tier => {
      const arr = inv.filter(i => i.abc === tier);
      return { tier: `Class ${tier}`, revenue: Math.round(arr.reduce((a, i) => a + i.revenue, 0)), skus: arr.length };
    });
    const maxStatus = Math.max(...Object.values(counts));
    return { inv, counts, unitsSold, reorderValue, visible, abcRevenue, maxStatus };
  }, [filtered, statusFilter, abcFilter]);

  if (status === 'loading') return <LoadingState label="Computing demand velocity & reorder points…" />;
  const { inv, counts, unitsSold, reorderValue, visible, abcRevenue } = d;

  if (filtered.length === 0) return <div><PageHeader icon={<Boxes size={20} />} title="Inventory Optimization" subtitle="Reorder intelligence." /><div className="card"><EmptyState action={<button className="btn btn-primary" onClick={resetFilters}>Reset filters</button>} /></div></div>;

  const exportCsv = () => {
    downloadCSV('retailpulse-inventory',
      ['Product ID', 'Product', 'Category', 'Units Sold', 'Revenue', 'Margin %', 'Velocity/day', 'Lead Time (d)', 'Safety Stock', 'Reorder Point', 'Suggested Reorder', 'Status', 'ABC'],
      visible.map(i => [i.productId, i.productName, i.category, i.unitsSold, i.revenue.toFixed(2), i.margin.toFixed(1), i.velocityPerDay, i.leadTimeDays, i.safetyStock, i.reorderPoint, i.suggestedReorder, i.status, i.abc]));
    toast(`Exported ${visible.length} SKUs`);
  };
  const statusTone = (s: StockStatus) => s === 'Reorder Now' ? 'red' : s === 'Reorder Soon' ? 'amber' : s === 'Healthy' ? 'green' : 'gray';

  return (
    <div>
      <PageHeader
        icon={<Boxes size={20} />}
        title="Inventory Optimization"
        subtitle="Velocity, coverage and reorder math per SKU — derived from real demand in the clean dataset."
        actions={<button className="btn btn-primary" onClick={exportCsv}><Download size={15} /> Export CSV</button>}
      />
      <ActiveFilters />
      <InfoNote><span className="font-semibold text-[var(--ink)]">Source of truth:</span> ABC classification and Stock Suggestions (Maintain Stock / Reduce Stock) are drawn directly from <code className="font-bold">RetailPulse_Clean_Dataset.csv</code>. Velocity, safety stock and reorder targets are computed live from transaction history across {inv.length.toLocaleString()} SKUs.</InfoNote>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Reorder Now" value={counts['Reorder Now']} format={n => String(Math.round(n))} icon={<AlertOctagon size={20} />} accent="rose" deltaLabel={`≈ ${fmt.money(reorderValue)} inbound value`} invert />
        <KpiCard label="Reorder Soon" value={counts['Reorder Soon']} format={n => String(Math.round(n))} icon={<Clock size={20} />} accent="amber" deltaLabel="within next lead-time cycle" invert />
        <KpiCard label="Healthy SKUs" value={counts['Healthy']} format={n => String(Math.round(n))} icon={<CheckCircle2 size={20} />} accent="emerald" />
        <KpiCard label="Units Analyzed" value={unitsSold} format={n => fmt.num(n)} icon={<Warehouse size={20} />} accent="indigo" deltaLabel={`across all ${inv.length} products`} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <ChartCard title="ABC classification" subtitle="Cumulative revenue split — A: top 80%, B: next 15%, C: remainder" height={215}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={abcRevenue} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="tier" tick={{ fontSize: 10.5 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1e3)}K`} width={44} />
              <Tooltip content={<ChartTooltip money={fmt.money} />} cursor={{ fill: 'rgba(99,102,241,.08)' }} />
              <Bar dataKey="revenue" name="Revenue" radius={[5, 5, 0, 0]} maxBarSize={52}>
                <Cell fill="#6366f1" /><Cell fill="#22d3ee" /><Cell fill="#94a3b8" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="-mt-1 flex justify-center gap-5 text-[0.68rem] text-[var(--muted)]">
            {abcRevenue.map(a => <span key={a.tier}><b className="text-[var(--ink)]">{a.tier}</b>: {a.skus} SKUs</span>)}
          </div>
        </ChartCard>

        {/* status pipeline */}
        <div className="card p-4 sm:p-5">
          <h3 className="text-[0.85rem] font-bold text-[var(--ink)]">Replenishment pipeline</h3>
          <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]">SKU count by coverage status (deterministic on-hand proxy)</p>
          <div className="mt-3 space-y-2.5">
            {(Object.entries(counts) as [StockStatus, number][]).map(([s, n]) => {
              const max = Math.max(...Object.values(counts), 1);
              const color = s === 'Reorder Now' ? 'bg-rose-500' : s === 'Reorder Soon' ? 'bg-amber-400' : s === 'Healthy' ? 'bg-emerald-500' : 'bg-slate-400';
              return (
                <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'All' : s)} className="block w-full text-left" aria-pressed={statusFilter === s}>
                  <div className="mb-1 flex items-center justify-between text-[0.72rem]">
                    <span className="font-bold text-[var(--ink)]">{s}</span>
                    <span className="tabular-nums text-[var(--muted)]">{n} SKUs</span>
                  </div>
                  <div className={`h-3 w-full overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-transparent transition ${statusFilter === s ? 'ring-[var(--indigo)]' : ''}`}>
                    <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${(n / max) * 100}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* suggested purchase order */}
        <div className="card border-l-4 !border-l-amber-500 p-4 sm:p-5">
          <p className="kpi-label flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Info size={13} /> Suggested purchase order</p>
          <p className="mt-1 text-[0.78rem] font-bold text-[var(--ink)]">Sprint buy: {counts['Reorder Now']} SKUs due now</p>
          <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {inv.filter(i => i.status === 'Reorder Now').slice(0, 8).map(i => (
              <div key={i.productId} className="flex items-center justify-between gap-2 text-[0.68rem]">
                <span className="truncate text-[var(--muted)]">{i.productName}</span>
                <span className="shrink-0 font-mono2 font-bold text-[var(--ink)]">+{i.suggestedReorder}u</span>
              </div>
            ))}
            {counts['Reorder Now'] === 0 && <p className="text-[0.72rem] text-emerald-600 dark:text-emerald-400">No immediate reorders — pipeline is healthy.</p>}
          </div>
          <button className="btn btn-ghost mt-2 w-full justify-center text-[0.72rem]" onClick={() => setStatusFilter('Reorder Now')}>View all in table ↓</button>
        </div>
      </div>

      <div className="card mt-3 p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[0.85rem] font-bold text-[var(--ink)]">SKU replenishment table {statusFilter !== 'All' && <>— <span className="text-[var(--indigo)]">{statusFilter}</span></>}</h3>
          <div className="flex items-center gap-1.5">
            {(['All', 'A', 'B', 'C'] as const).map(t => <button key={t} onClick={() => setAbcFilter(t)} className={`rounded-lg px-2.5 py-1 text-[0.7rem] font-bold transition-all ${abcFilter === t ? 'bg-[var(--indigo)] text-white' : 'bg-[var(--surface-2)] text-[var(--muted)]'}`}>{t === 'All' ? 'All ABC' : `Class ${t}`}</button>)}
          </div>
        </div>
        <DataTable
          rows={visible}
          pageSize={12}
          searchPlaceholder="Search products…"
          columns={[
            { key: 'product', header: 'Product', sortValue: i => i.productName, render: i => <span className="block max-w-[230px] truncate font-medium" title={i.productName}>{i.productName}<span className="block text-[0.6rem] font-normal text-[var(--faint)]">{i.productId} · {i.subCategory}</span></span> },
            { key: 'abc', header: 'ABC', align: 'center', sortValue: i => i.abc, render: i => <Badge tone={i.abc === 'A' ? 'indigo' : i.abc === 'B' ? 'cyan' : 'gray'}>{i.abc}</Badge> },
            { key: 'units', header: 'Units', align: 'right', sortValue: i => i.unitsSold, render: i => fmt.num(i.unitsSold) },
            { key: 'vel', header: 'Vel/day', align: 'right', sortValue: i => i.velocityPerDay, render: i => i.velocityPerDay.toFixed(2) },
            { key: 'lead', header: 'Lead', align: 'right', sortValue: i => i.leadTimeDays, render: i => `${i.leadTimeDays}d` },
            { key: 'ss', header: 'Safety', align: 'right', sortValue: i => i.safetyStock, render: i => i.safetyStock },
            { key: 'rop', header: 'Reorder Pt', align: 'right', sortValue: i => i.reorderPoint, render: i => i.reorderPoint },
            { key: 'sug', header: 'Suggest +', align: 'right', sortValue: i => i.suggestedReorder, render: i => <span className="font-bold">{i.suggestedReorder}</span> },
            { key: 'status', header: 'Status', sortValue: i => i.status, render: i => <Badge tone={statusTone(i.status)}>{i.status}</Badge> },
            { key: 'margin', header: 'Margin', align: 'right', sortValue: i => i.margin, render: i => <span className={i.margin < 0 ? 'text-rose-500' : ''}>{i.margin.toFixed(0)}%</span> },
          ]}
        />
      </div>
    </div>
  );
}
