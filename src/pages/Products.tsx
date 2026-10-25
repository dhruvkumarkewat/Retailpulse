import React, { useMemo, useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, BarChart, Bar,
} from 'recharts';
import {
  Package, Download, TrendingUp, TrendingDown, Layers, Boxes, Star,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import { groupStats, groupBy, kpis, sumBy, downloadCSV, byMonth } from '../lib/engine';
import { KpiCard, ChartCard, ChartTooltip, PageHeader, ActiveFilters, DataTable, EmptyState, LoadingState, PALETTE, useFmt, Badge, InfoNote } from '../components/ui';

export default function Products() {
  const { filtered, status, resetFilters } = useData();
  const { toast } = useSettings();
  const fmt = useFmt();
  const [catSel, setCatSel] = useState<string>('All');

  const d = useMemo(() => {
    const base = catSel === 'All' ? filtered : filtered.filter(r => r.category === catSel);
    const categories = groupStats(filtered, r => r.category);
    const subs = groupStats(base, r => r.subCategory);
    const products = groupStats(base, r => r.productName);
    const k = kpis(base);
    // star product matrix data: x = units, y = margin, z = revenue
    const scatter = products.slice(0, 80).map(p => ({ name: p.key, units: p.qty, margin: +p.margin.toFixed(1), revenue: Math.round(p.revenue), category: p.key, orders: p.orders }));
    const topProfit = [...products].sort((a, b) => b.profit - a.profit)[0];
    const worst = [...products].sort((a, b) => a.margin - b.margin).filter(p => p.orders >= 3)[0];
    const catSet = [...new Set(filtered.map(r => r.category))];
    return { categories, subs, products, k, scatter, topProfit, worst, catSet, base };
  }, [filtered, catSel]);

  if (status === 'loading') return <LoadingState label="Ranking 1,194 products…" />;
  const { categories, subs, products, k, scatter, topProfit, worst, catSet } = d;

  if (filtered.length === 0) return <div><PageHeader icon={<Package size={20} />} title="Product Analytics" subtitle="Category architecture." /><div className="card"><EmptyState action={<button className="btn btn-primary" onClick={resetFilters}>Reset filters</button>} /></div></div>;

  const exportCsv = () => {
    downloadCSV('retailpulse-products',
      ['Product', 'Revenue', 'Profit', 'Orders', 'Units', 'Margin %', 'AOV', 'Returns'],
      products.map(p => [p.key, p.revenue.toFixed(2), p.profit.toFixed(2), p.orders, p.qty, p.margin.toFixed(1), p.aov.toFixed(2), p.returns]));
    toast(`Exported ${products.length} products`);
  };

  return (
    <div>
      <PageHeader
        icon={<Package size={20} />}
        title="Product Analytics"
        subtitle="Category → sub-category → SKU economics: what sells, what earns, what quietly leaks margin."
        actions={
          <>
            <div className="flex rounded-lg border border-[var(--border-strong)] p-0.5">
              {['All', ...catSet].map(c => (
                <button key={c} onClick={() => setCatSel(c)} className={`rounded-md px-2.5 py-1 text-[0.68rem] font-bold transition-all ${catSel === c ? 'bg-[var(--indigo)] text-white shadow' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{c}</button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={exportCsv}><Download size={15} /> Export CSV</button>
          </>
        }
      />
      <ActiveFilters />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Active SKUs" value={new Set(d.base.map(r => r.productId)).size} format={n => String(Math.round(n))} icon={<Boxes size={20} />} accent="indigo" />
        <KpiCard label="Units Sold" value={k.qty} format={n => fmt.num(n)} icon={<Layers size={20} />} accent="cyan" />
        <KpiCard label="Star Earner" value={topProfit?.profit ?? 0} format={n => fmt.money(n)} icon={<Star size={20} />} accent="amber" deltaLabel={topProfit ? topProfit.key.slice(0, 26) : ''} />
        <KpiCard label="Margin Watchlist" value={worst?.margin ?? 0} format={n => n.toFixed(1) + '%'} icon={<TrendingDown size={20} />} accent="rose" deltaLabel={worst ? worst.key.slice(0, 26) : 'no margin-negative SKU'} invert />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        {/* star matrix */}
        <ChartCard className="xl:col-span-2" title="Star-product matrix" subtitle="Units sold (x) vs margin % (y) · bubble = revenue · hover for detail" height={310}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" />
              <XAxis type="number" dataKey="units" name="Units" tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} label={{ value: 'Units sold →', position: 'insideBottom', offset: -2, fontSize: 10, fill: 'var(--muted)' }} />
              <YAxis type="number" dataKey="margin" name="Margin" tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} width={40} />
              <ZAxis type="number" dataKey="revenue" range={[40, 320]} />
              <Tooltip cursor={{ strokeDasharray: '4 4' }} content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--tooltip-bg)] px-3 py-2 text-[0.72rem] shadow-lg"><p className="max-w-[220px] font-bold text-[var(--tooltip-ink)]">{p.name}</p><p className="mt-0.5 text-[var(--muted)]">{p.units} units · {p.margin}% margin · {fmt.money(p.revenue)}</p></div>;
              }} />
              <Scatter data={scatter}>
                {scatter.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.72} stroke="var(--surface)" strokeWidth={0.6} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* sub-category ranking */}
        <ChartCard title="Sub-category profitability" subtitle={catSel === 'All' ? 'All categories, ranked by revenue' : `${catSel} sub-categories`} height={310}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...subs].slice(0, 10).reverse()} layout="vertical" margin={{ top: 2, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="key" width={96} tick={{ fontSize: 9.5 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip money={fmt.money} />} cursor={{ fill: 'rgba(99,102,241,.07)' }} />
              <Bar dataKey="profit" name="Profit" radius={[0, 5, 5, 0]} maxBarSize={13}>
                {subs.slice(0, 10).map((s, i) => <Cell key={i} fill={s.profit < 0 ? '#f43f5e' : PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* category roll-up cards */}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {categories.map(c => (
          <div key={c.key} className="card card-hover p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-[0.8rem] font-bold text-[var(--ink)]">{c.key}</p>
              <Badge tone={c.margin < 8 ? 'amber' : 'green'}>{c.margin.toFixed(1)}% margin</Badge>
            </div>
            <p className="mt-2 text-xl font-extrabold tracking-tight tabular-nums text-[var(--ink)]">{fmt.money(c.revenue)}</p>
            <div className="mt-1.5 flex items-center justify-between text-[0.68rem] text-[var(--muted)]"><span>{fmt.num(c.orders)} orders · {fmt.num(c.qty)} units</span><span className={c.profit < 0 ? 'font-bold text-rose-500' : ''}>{fmt.money(c.profit)} profit</span></div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${(c.revenue / (k.revenue || 1)) * 100}%` }} /></div>
          </div>
        ))}
      </div>

      <div className="card mt-3 p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[0.85rem] font-bold text-[var(--ink)]">SKU scorecard — {products.length} products</h3>
          <InfoNote>Red margin = below water after discount. Click headers to sort.</InfoNote>
        </div>
        <DataTable
          rows={products}
          pageSize={12}
          searchPlaceholder="Search products…"
          columns={[
            { key: 'product', header: 'Product', sortValue: p => p.key, render: p => <span className="block max-w-[260px] truncate font-medium" title={p.key}>{p.key}</span> },
            { key: 'revenue', header: 'Revenue', align: 'right', sortValue: p => p.revenue, render: p => fmt.money(p.revenue) },
            { key: 'profit', header: 'Profit', align: 'right', sortValue: p => p.profit, render: p => <span className={p.profit < 0 ? 'font-bold text-rose-500' : ''}>{fmt.money(p.profit)}</span> },
            { key: 'orders', header: 'Orders', align: 'right', sortValue: p => p.orders, render: p => fmt.num(p.orders) },
            { key: 'qty', header: 'Units', align: 'right', sortValue: p => p.qty, render: p => fmt.num(p.qty) },
            { key: 'aov', header: 'AOV', align: 'right', sortValue: p => p.aov, render: p => fmt.money(p.aov, 2) },
            { key: 'margin', header: 'Margin', align: 'right', sortValue: p => p.margin, render: p => <Badge tone={p.margin < 0 ? 'red' : p.margin < 10 ? 'amber' : 'green'}>{p.margin.toFixed(1)}%</Badge> },
          ]}
        />
      </div>
    </div>
  );
}
