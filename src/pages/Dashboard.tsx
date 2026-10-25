import React, { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  LayoutDashboard, Banknote, TrendingUp, ShoppingCart, Receipt, Percent, Users, FileText, RotateCcw, Package,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import {
  kpis, byMonth, byQuarter, groupStats, applyFilters, fmtMoney, fmtPct, fmtNum, iso,
  type OrderRow,
} from '../lib/engine';
import { KpiCard, ChartCard, ChartTooltip, PageHeader, ActiveFilters, EmptyState, LoadingState, PALETTE, useFmt } from '../components/ui';

function priorWindow(rows: OrderRow[], filters: ReturnType<typeof useData>['filters']) {
  if (!rows.length) return [];
  const min = rows.reduce((m, r) => Math.min(m, r.date.getTime()), Infinity);
  const max = rows.reduce((m, r) => Math.max(m, r.date.getTime()), -Infinity);
  const from = filters.from ? new Date(filters.from + 'T00:00:00').getTime() : min;
  const to = filters.to ? new Date(filters.to + 'T23:59:59').getTime() : max;
  const span = to - from;
  const pt = new Date(from - 86400000);
  const pf = new Date(from - span - 86400000);
  if (pt.getTime() < min - 86400000 * 31) return []; // no meaningful prior window
  return applyFilters(rows, { ...filters, from: iso(pf), to: iso(pt) });
}

export default function Dashboard() {
  const { rows, filtered, filters, status, resetFilters } = useData();
  const { settings, toast } = useSettings();
  const fmt = useFmt();

  const data = useMemo(() => {
    const k = kpis(filtered);
    const prevRows = priorWindow(rows, filters);
    const kp = kpis(prevRows);
    const monthly = byMonth(filtered);
    const quarterly = byQuarter(filtered);
    const categories = groupStats(filtered, r => r.category);
    const segments = groupStats(filtered, r => r.segment);
    const countries = groupStats(filtered, r => r.country).slice(0, 6);
    const delta = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : null;
    return {
      k, kp, monthly, quarterly, categories, segments, countries,
      d: {
        revenue: delta(k.revenue, kp.revenue), profit: delta(k.profit, kp.profit),
        orders: delta(k.orders, kp.orders), aov: delta(k.aov, kp.aov),
        customers: delta(k.uniqueCustomers, kp.uniqueCustomers),
        margin: kp.revenue ? k.margin - kp.margin : null,
        returns: kp.orders ? k.returnRate - kp.returnRate : null,
      },
      prevWindow: prevRows.length > 0,
    };
  }, [filtered, rows, filters]);

  if (status === 'loading') return <LoadingState label="Parsing 3,805 rows and aggregating KPIs…" />;
  const { k, kp, monthly, quarterly, categories, segments, countries, d, prevWindow: hasPrev } = data;

  const pdf = async () => {
    const { generatePdfReport } = await import('../lib/engine');
    await generatePdfReport('Executive Dashboard', `Reporting window: ${filters.from || 'dataset start'} → ${filters.to || 'dataset end'} · Filters — Country: ${filters.country}, Category: ${filters.category}, Segment: ${filters.segment}`, [
      {
        heading: 'Headline KPIs',
        kpis: [
          { label: 'Gross revenue', value: fmt.money(k.revenue) },
          { label: 'Net profit', value: fmt.money(k.profit) },
          { label: 'Orders', value: fmt.num(k.orders) },
          { label: 'Avg order value', value: fmt.money(k.aov, 2) },
          { label: 'Net margin', value: fmtPct(k.margin) },
          { label: 'Return rate', value: fmtPct(k.returnRate) },
          { label: 'Unique customers', value: fmt.num(k.uniqueCustomers) },
          { label: 'Units sold', value: fmt.num(k.qty) },
        ],
      },
      {
        heading: 'Quarterly performance',
        table: {
          headers: ['Quarter', 'Revenue', 'Profit', 'Orders', 'Margin'],
          rows: quarterly.map(q => [q.label, fmt.money(q.revenue), fmt.money(q.profit), String(q.orders), fmtPct(q.margin)]),
        },
      },
      {
        heading: 'Category performance',
        table: {
          headers: ['Category', 'Revenue', 'Profit', 'Orders', 'AOV'],
          rows: categories.map(c => [c.key, fmt.money(c.revenue), fmt.money(c.profit), String(c.orders), fmt.money(c.aov, 2)]),
        },
        note: 'Generated from RetailPulse_Clean_Dataset.csv (single source of truth). All figures computed at generation time from filtered rows; no manual overrides.',
      },
    ]);
    toast('Executive PDF downloaded');
  };

  return (
    <div>
      <PageHeader
        icon={<LayoutDashboard size={20} />}
        title="Executive Dashboard"
        subtitle="Board-level pulse: revenue, profit, orders, customers and margin — every figure computed live from the filtered dataset."
        actions={
          <>
            <span className="chip">{hasPrev ? 'vs prior equal-length window' : 'prior window unavailable — 2023 starts the dataset'}</span>
            <button className="btn btn-primary" onClick={pdf}><FileText size={15} /> Export PDF</button>
          </>
        }
      />
      <ActiveFilters />

      {filtered.length === 0 ? (
        <div className="card"><EmptyState action={<button className="btn btn-primary" onClick={resetFilters}><RotateCcw size={14} /> Reset filters</button>} /></div>
      ) : (
        <>
          {/* ============ KPI GRID ============ */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Gross Revenue" value={k.revenue} format={n => fmt.money(n)} delta={d.revenue} icon={<Banknote size={20} />} accent="indigo" deltaLabel={hasPrev ? 'vs prior window' : ''} />
            <KpiCard label="Net Profit" value={k.profit} format={n => fmt.money(n)} delta={d.profit} icon={<TrendingUp size={20} />} accent="emerald" deltaLabel={hasPrev ? 'vs prior window' : ''} />
            <KpiCard label="Orders" value={k.orders} format={n => fmt.num(n)} delta={d.orders} icon={<ShoppingCart size={20} />} accent="cyan" deltaLabel={hasPrev ? 'vs prior window' : ''} />
            <KpiCard label="Avg Order Value" value={k.aov} format={n => fmt.money(n, 2)} delta={d.aov} icon={<Receipt size={20} />} accent="violet" deltaLabel={hasPrev ? 'vs prior window' : ''} />
            <KpiCard label="Net Margin" value={k.margin} format={n => fmtPct(n)} delta={d.margin} icon={<Percent size={20} />} accent="amber" deltaLabel="pp vs prior window" />
            <KpiCard label="Unique Customers" value={k.uniqueCustomers} format={n => fmt.num(n)} delta={d.customers} icon={<Users size={20} />} accent="rose" deltaLabel={hasPrev ? 'vs prior window' : ''} />
          </div>

          {/* ============ REVENUE & PROFIT TREND ============ */}
          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <ChartCard className="xl:col-span-2" title="Revenue vs Profit — monthly" subtitle="Gross merchandise value and realized profit per calendar month" height={272}
              right={<span className="chip">{monthly.length} months</span>}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.38} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} /></linearGradient>
                    <linearGradient id="gProf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.32} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${v}`} width={44} />
                  <Tooltip content={<ChartTooltip money={fmt.money} />} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2.4} fill="url(#gRev)" dot={false} activeDot={{ r: 4.5 }} />
                  <Area type="monotone" dataKey="profit" name="Profit" stroke="#22d3ee" strokeWidth={2.4} fill="url(#gProf)" dot={false} activeDot={{ r: 4.5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* category donut */}
            <ChartCard title="Revenue by category" subtitle="Share of gross merchandise value" height={272}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categories} dataKey="revenue" nameKey="key" innerRadius={58} outerRadius={86} paddingAngle={3} strokeWidth={2} stroke="var(--surface)">
                    {categories.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip money={fmt.money} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ============ QUARTERLY + COUNTRIES + SEGMENTS ============ */}
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <ChartCard title="Quarterly revenue & profit" subtitle="Fiscal quarters across the filtered window" height={240}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quarterly} margin={{ top: 6, right: 0, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9.5 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${Math.round(v / 1e3)}K`} width={42} />
                  <Tooltip content={<ChartTooltip money={fmt.money} />} cursor={{ fill: 'rgba(99,102,241,.07)' }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[5, 5, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="profit" name="Profit" fill="#22d3ee" radius={[5, 5, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top countries" subtitle="By gross revenue — top 6 markets" height={240}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...countries].reverse()} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="key" width={92} tick={{ fontSize: 10 }} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip money={fmt.money} />} cursor={{ fill: 'rgba(99,102,241,.07)' }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#818cf8" radius={[0, 5, 5, 0]} maxBarSize={15}>
                    {countries.map((_, i) => <Cell key={i} fill={PALETTE[(countries.length - 1 - i) % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* segment scoreboard */}
            <section className="card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-[0.85rem] font-bold tracking-tight text-[var(--ink)]">Segment scoreboard</h3>
                  <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]">Revenue · margin · return rate per segment</p>
                </div>
                <Package size={16} className="text-[var(--faint)]" />
              </div>
              <div className="space-y-3">
                {segments.map(s => {
                  const share = k.revenue ? (s.revenue / k.revenue) * 100 : 0;
                  const retRate = s.orders ? (s.returns / s.orders) * 100 : 0;
                  return (
                    <div key={s.key}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.74rem]">
                        <span className="font-bold text-[var(--ink)]">{s.key}</span>
                        <span className="tabular-nums text-[var(--muted)]">{fmt.money(s.revenue)} · <span className={retRate > 10 ? 'font-semibold text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}>{retRate.toFixed(1)}% returns</span></span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-700" style={{ width: `${share}%` }} />
                      </div>
                      <p className="mt-0.5 text-[0.62rem] text-[var(--faint)]">{share.toFixed(1)}% of revenue · {fmt.money(s.profit)} profit · {s.orders.toLocaleString()} orders</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-[0.68rem] leading-snug text-[var(--muted)]">
                <span className="font-bold text-amber-600 dark:text-amber-400">Watch:</span> {filtered.filter(r => r.returned).length} returned orders in window ({fmtPct(k.returnRate)}). Discount ≥ 20% orders show materially higher return propensity.
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
