import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Cell, ReferenceLine,
} from 'recharts';
import {
  LineChart as LineChartIcon, Banknote, TrendingUp, ShoppingCart, Receipt, ArrowUpRight, ArrowDownRight,
  Download, BadgePercent,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import {
  kpis, byMonth, byQuarter, byWeekday, groupStats, linReg, downloadCSV,
  type OrderRow,
} from '../lib/engine';
import { KpiCard, ChartCard, ChartTooltip, PageHeader, ActiveFilters, DataTable, EmptyState, LoadingState, PALETTE, useFmt, Badge } from '../components/ui';

export default function Sales() {
  const { filtered, filters, status, resetFilters } = useData();
  const { toast } = useSettings();
  const fmt = useFmt();
  const [view, setView] = useState<'monthly' | 'quarterly'>('monthly');
  const [discountMode, setDiscountMode] = useState<'bucket' | 'band'>('bucket');

  const d = useMemo(() => {
    const time = view === 'monthly' ? byMonth(filtered) : byQuarter(filtered);
    const reg = linReg(time.map(t => t.revenue));
    const timeWithTrend = time.map((t, i) => ({ ...t, trend: Math.round(reg.intercept + reg.slope * i) }));
    const k = kpis(filtered);
    const aovSeries = time.map(t => ({ ...t, label: t.label }));
    const weekday = byWeekday(filtered);
    const payment = groupStats(filtered, r => r.paymentMode);
    const shipMode = groupStats(filtered, r => r.shipMode);
    const products = groupStats(filtered, r => r.productName).slice(0, 8);
    // discount band analysis
    const bands: Record<string, OrderRow[]> = { '0%': [], '1–10%': [], '11–20%': [], '21–30%': [], '31%+': [] };
    for (const r of filtered) {
      const disc = r.discount * 100;
      const key = disc === 0 ? '0%' : disc <= 10 ? '1–10%' : disc <= 20 ? '11–20%' : disc <= 30 ? '21–30%' : '31%+';
      bands[key].push(r);
    }
    const discountBands = Object.entries(bands).map(([band, arr]) => {
      const kk = kpis(arr);
      const ret = arr.filter(r => r.returned).length;
      return { band, revenue: Math.round(kk.revenue), profit: Math.round(kk.profit), orders: arr.length, margin: +kk.margin.toFixed(1), returnRate: arr.length ? +((ret / arr.length) * 100).toFixed(1) : 0, avgDisc: +(arr.reduce((a, r) => a + r.discount * 100, 0) / (arr.length || 1)).toFixed(1) };
    });
    // simple prev half comparison
    const sorted = [...filtered].sort((a, b) => a.date.getTime() - b.date.getTime());
    const mid = Math.floor(sorted.length / 2);
    const kFirst = kpis(sorted.slice(0, mid)), kSecond = kpis(sorted.slice(mid));
    return { time: timeWithTrend, k, aovSeries, weekday, payment, shipMode, products, discountBands, reg, deltaRevenue: kFirst.revenue > 0 ? ((kSecond.revenue - kFirst.revenue) / kFirst.revenue) * 100 : null };
  }, [filtered, view]);

  if (status === 'loading') return <LoadingState />;
  const { time, k, aovSeries, weekday, payment, shipMode, products, discountBands, reg, deltaRevenue } = d;

  const exportCsv = () => {
    downloadCSV('retailpulse-sales-export',
      ['Period', 'Revenue', 'Profit', 'Orders', 'Quantity', 'Margin %', 'AOV', 'Returns'],
      time.map(t => [t.label, t.revenue.toFixed(2), t.profit.toFixed(2), t.orders, t.qty, t.margin.toFixed(2), t.aov.toFixed(2), t.returns]));
    toast(`Exported ${time.length} rows to CSV`);
  };

  return (
    <div>
      <PageHeader
        icon={<LineChartIcon size={20} />}
        title="Sales Analytics"
        subtitle="Revenue architecture: trend, seasonality, weekday mix, discount economics, payment & shipping behaviour."
        actions={
          <button className="btn btn-primary" onClick={exportCsv}><Download size={15} /> Export CSV</button>
        }
      />
      <ActiveFilters />
      {filtered.length === 0 ? <div className="card"><EmptyState action={<button className="btn btn-primary" onClick={resetFilters}>Reset filters</button>} /></div> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Revenue" value={k.revenue} format={n => fmt.money(n)} delta={deltaRevenue} deltaLabel="2nd half vs 1st half" icon={<Banknote size={20} />} accent="indigo" />
            <KpiCard label="Profit" value={k.profit} format={n => fmt.money(n)} icon={<TrendingUp size={20} />} accent="emerald" />
            <KpiCard label="Orders" value={k.orders} format={n => fmt.num(n)} icon={<ShoppingCart size={20} />} accent="cyan" />
            <KpiCard label="Avg Order Value" value={k.aov} format={n => fmt.money(n, 2)} icon={<Receipt size={20} />} accent="violet" />
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <ChartCard className="xl:col-span-2" title={`Revenue, profit & linear trend — ${view}`} subtitle={`Least-squares fit: ${reg.slope >= 0 ? '+' : ''}${fmt.money(reg.slope)} per ${view === 'monthly' ? 'month' : 'quarter'} · R² = ${reg.r2.toFixed(2)}`} height={300}
              right={
                <div className="flex rounded-lg border border-[var(--border-strong)] p-0.5">
                  {(['monthly', 'quarterly'] as const).map(v => (
                    <button key={v} onClick={() => setView(v)} className={`rounded-md px-2.5 py-1 text-[0.68rem] font-bold capitalize transition-all ${view === v ? 'bg-[var(--indigo)] text-white shadow' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{v}</button>
                  ))}
                </div>
              }>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={time} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis yAxisId="rev" tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1e3)}K`} width={44} />
                  <YAxis yAxisId="prof" orientation="right" tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1e3)}K`} width={40} />
                  <Tooltip content={<ChartTooltip money={fmt.money} />} cursor={{ fill: 'rgba(99,102,241,.08)' }} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Bar yAxisId="prof" dataKey="profit" name="Profit" fill="#22d3ee" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Line yAxisId="rev" type="monotone" dataKey="trend" name="Trend (OLS)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Average order value" subtitle="AOV per period — pricing power signal" height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={aovSeries} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9.5 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} domain={['dataMin - 20', 'dataMax + 20']} tickFormatter={(v: number) => `$${Math.round(v)}`} width={40} />
                  <Tooltip content={<ChartTooltip money={fmt.money} />} />
                  <ReferenceLine y={k.aov} stroke="#a78bfa" strokeDasharray="5 4" label={{ value: `avg ${fmt.money(k.aov)}`, position: 'insideTopRight', fontSize: 10, fill: '#a78bfa' }} />
                  <Line type="monotone" dataKey="aov" name="AOV" stroke="#a78bfa" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <ChartCard title="Weekday rhythm" subtitle="Revenue and order count by day of week" height={230}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weekday} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10.5 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1e3)}K`} width={42} />
                  <YAxis yAxisId="r" orientation="right" hide />
                  <Tooltip content={<ChartTooltip money={fmt.money} />} cursor={{ fill: 'rgba(99,102,241,.08)' }} />
                  <Bar yAxisId="l" dataKey="revenue" name="Revenue" fill="#818cf8" radius={[5, 5, 0, 0]} maxBarSize={34} />
                  <Line yAxisId="r" dataKey="orders" name="orders" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Payment mode" subtitle="Where transactions close" height={230}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payment} layout="vertical" margin={{ top: 2, right: 8, left: 8, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="key" width={108} tick={{ fontSize: 9.5 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip money={fmt.money} />} cursor={{ fill: 'rgba(99,102,241,.07)' }} />
                  <Bar dataKey="orders" name="Orders" radius={[0, 5, 5, 0]} maxBarSize={16}>
                    {payment.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Ship mode" subtitle="Fulfillment speed mix by orders & revenue" height={230}>
              <div className="h-full overflow-y-auto">
                <table className="w-full">
                  <thead><tr><th className="th">Mode</th><th className="th text-right">Orders</th><th className="th text-right">Revenue</th><th className="th text-right">AOV</th></tr></thead>
                  <tbody>
                    {shipMode.map(s => (
                      <tr key={s.key} className="tr-hover">
                        <td className="td text-[0.76rem] font-semibold">{s.key}</td>
                        <td className="td text-right tabular-nums">{fmt.num(s.orders)}</td>
                        <td className="td text-right tabular-nums">{fmt.money(s.revenue)}</td>
                        <td className="td text-right tabular-nums">{fmt.money(s.aov, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </div>

          {/* discount economics */}
          <div className="mt-3 grid gap-3 lg:grid-cols-5">
            <ChartCard className="lg:col-span-3" title="Discount economics" subtitle="Margin and return behaviour by discount depth — the profit leak detector" height={210}
              right={<Badge tone="amber"><BadgePercent size={11} />Watch ≥ 20%</Badge>}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={discountBands} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="band" tick={{ fontSize: 10.5 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="m" tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} width={36} />
                  <Tooltip content={<ChartTooltip money={fmt.money} />} cursor={{ fill: 'rgba(99,102,241,.08)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="m" dataKey="margin" name="margin" fill="#34d399" radius={[5, 5, 0, 0]} maxBarSize={44} />
                  <Line yAxisId="m" dataKey="returnRate" name="returnRate" stroke="#fb7185" strokeWidth={2.4} dot={{ r: 3.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
            <div className="card flex flex-col justify-center gap-2 p-4 sm:p-5">
              <p className="kpi-label">Reading the discount table</p>
              {[
                { band: '0%', note: 'Full-price velocity — healthiest margin' },
                { band: '1–10%', note: 'Nudge territory — typical loyalty reward' },
                { band: '11–20%', note: 'Promotional — watch margin compression' },
                { band: '21–30%', note: 'Deep promo — returns spike risk' },
                { band: '31%+', note: 'Clearance zone — margin may invert' },
              ].map(row => {
                const stat = discountBands.find(b => b.band === row.band)!;
                return (
                  <div key={row.band} className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-1.5 text-[0.72rem] last:border-0">
                    <span className="font-bold text-[var(--ink)]">{row.band}</span>
                    <span className="hidden text-[var(--muted)] xl:block">{row.note}</span>
                    <span className={`tabular-nums font-semibold ${stat.margin < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{stat.margin}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* top products table */}
          <div className="card mt-3 p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[0.85rem] font-bold text-[var(--ink)]">Top 8 products by revenue</h3>
                <p className="text-[0.7rem] text-[var(--muted)]">Sortable · searchable · exports to CSV</p>
              </div>
              <button className="btn btn-ghost !py-1.5 text-[0.72rem]" onClick={() => { downloadCSV('retailpulse-top-products', ['Product', 'Revenue', 'Profit', 'Orders', 'Qty', 'Margin %'], products.map(p => [p.key, p.revenue.toFixed(2), p.profit.toFixed(2), p.orders, p.qty, p.margin.toFixed(1)])); toast('Top products exported'); }}><Download size={13} /> CSV</button>
            </div>
            <DataTable<typeof products[number]>
              rows={products}
              pageSize={8}
              columns={[
                { key: 'product', header: 'Product', sortValue: p => p.key, render: p => <span className="block max-w-[280px] truncate font-medium text-[var(--ink)]" title={p.key}>{p.key}</span> },
                { key: 'revenue', header: 'Revenue', align: 'right', sortValue: p => p.revenue, render: p => fmt.money(p.revenue) },
                { key: 'profit', header: 'Profit', align: 'right', sortValue: p => p.profit, render: p => <span className={p.profit < 0 ? 'font-semibold text-rose-500' : ''}>{fmt.money(p.profit)}</span> },
                { key: 'orders', header: 'Orders', align: 'right', sortValue: p => p.orders, render: p => fmt.num(p.orders) },
                { key: 'qty', header: 'Qty', align: 'right', sortValue: p => p.qty, render: p => fmt.num(p.qty) },
                { key: 'margin', header: 'Margin', align: 'right', sortValue: p => p.margin, render: p => <Badge tone={p.margin < 0 ? 'red' : p.margin < 12 ? 'amber' : 'green'}>{p.margin.toFixed(1)}%</Badge> },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
