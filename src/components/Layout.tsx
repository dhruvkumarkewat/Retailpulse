import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, LineChart, Users, PieChart, UserX, Boxes, Globe2, Package,
  TrendingUp, FileBarChart, Settings, Search, Sun, Moon, Monitor, Menu, X,
  Zap, RotateCcw, Download, Bell, ChevronsLeft, ChevronsRight, Home,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import { ordersToCSV } from '../lib/engine';
import { Toast } from './Toast';

const NAV: { section?: string; items: { to: string; label: string; icon: React.ReactNode }[] }[] = [
  { items: [{ to: '/', label: 'Home', icon: <Home size={17} /> }, { to: '/dashboard', label: 'Executive Dashboard', icon: <LayoutDashboard size={17} /> }] },
  {
    section: 'Analyze',
    items: [
      { to: '/sales', label: 'Sales Analytics', icon: <LineChart size={17} /> },
      { to: '/customers', label: 'Customer Analytics', icon: <Users size={17} /> },
      { to: '/segmentation', label: 'Customer Segmentation', icon: <PieChart size={17} /> },
      { to: '/churn', label: 'Customer Churn', icon: <UserX size={17} /> },
    ],
  },
  {
    section: 'Operate',
    items: [
      { to: '/inventory', label: 'Inventory Optimization', icon: <Boxes size={17} /> },
      { to: '/countries', label: 'Country Analysis', icon: <Globe2 size={17} /> },
      { to: '/products', label: 'Product Analytics', icon: <Package size={17} /> },
      { to: '/forecast', label: 'Demand Forecasting', icon: <TrendingUp size={17} /> },
    ],
  },
  {
    section: 'Manage',
    items: [
      { to: '/reports', label: 'Reports', icon: <FileBarChart size={17} /> },
      { to: '/settings', label: 'Settings', icon: <Settings size={17} /> },
    ],
  },
];

export default function Layout() {
  const { status, error, reload, filters, setFilter, resetFilters, countries, categories, segments, dateBounds, filtered } = useData();
  const { settings, update, resolvedTheme, toast } = useSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = settings.sidebarCollapsed;

  React.useEffect(() => { setMobileOpen(false); window.scrollTo(0, 0); }, [location.pathname]);

  const cycleTheme = () => update({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' });
  const themeIcon = settings.theme === 'system' ? <Monitor size={16} /> : resolvedTheme === 'dark' ? <Moon size={16} /> : <Sun size={16} />;

  const sidebarBody = (
    <>
      {/* brand */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/8 px-4">
        <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-600 shadow-sm">
          <Zap size={18} strokeWidth={2.5} className="text-white" fill="white" />
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0a0c10]" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[1.05rem] font-bold leading-none tracking-tight text-white">RetailPulse</p>
            <p className="mt-1 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Commercial Intelligence</p>
          </div>
        )}
      </div>
      {/* nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]" aria-label="Primary navigation">
        {NAV.map((group, gi) => (
          <div key={gi}>
            {group.section && !collapsed && <p className="sidebar-section">{group.section}</p>}
            {group.section && collapsed && <div className="mx-2 my-2 border-t border-white/8" />}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = location.pathname === item.to;
                return (
                  <button key={item.to} onClick={() => navigate(item.to)} className={`sidebar-link w-full ${active ? 'active' : ''} ${collapsed ? 'justify-center !px-2' : ''}`}
                    aria-current={active ? 'page' : undefined} title={collapsed ? item.label : undefined}>
                    <span className={active ? 'text-blue-400' : 'text-slate-400'}>{item.icon}</span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {/* dataset footer card */}
      {!collapsed ? (
        <div className="mx-3 mb-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-slate-300">Source of truth</p>
            <span className="flex h-2 w-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /></span>
          </div>
          <p className="mt-1.5 font-mono2 text-[0.6rem] leading-relaxed text-slate-400">RetailPulse_Clean_Dataset.csv</p>
          <div className="mt-1.5 flex items-center justify-between text-[0.68rem] font-semibold text-white/90"><span>3,805 rows · 29 cols</span><span className="text-emerald-400">Verified</span></div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full w-full bg-blue-500" /></div>
        </div>
      ) : (
        <div className="mb-3 flex justify-center"><span title="Dataset: 3,805 rows live" className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-400/10"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></span></div>
      )}
      <button onClick={() => update({ sidebarCollapsed: !collapsed })} className="hidden h-10 shrink-0 items-center justify-center border-t border-white/8 text-slate-400 transition-colors hover:text-white lg:flex" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
      </button>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* desktop sidebar */}
      <aside className={`relative z-30 hidden h-full shrink-0 flex-col bg-[#0a0c10] border-r border-white/8 shadow-xl transition-[width] duration-300 lg:flex ${collapsed ? 'w-[72px]' : 'w-[262px]'}`}>
        {sidebarBody}
      </aside>
      {/* mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" />
            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 flex h-full w-[270px] flex-col bg-[#0a0c10] border-r border-white/8 lg:hidden">
              <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 text-slate-400 hover:text-white" aria-label="Close menu"><X size={20} /></button>
              {sidebarBody}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ============ GLOBAL FILTER / COMMAND BAR ============ */}
        <header className="z-20 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md">
          <div className="flex h-16 items-center gap-2 px-3 sm:px-4">
            <button className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-2)] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
            {/* search */}
            <div className="relative hidden min-w-0 flex-1 md:block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
              <input value={filters.search ?? ''} onChange={e => setFilter({ search: e.target.value })} placeholder="Search orders, customers, products, cities…" aria-label="Global search"
                className="input w-full !rounded-full !border-transparent !bg-[var(--surface-2)] !py-2 !pl-9 focus:!bg-[var(--surface)]" />
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <button onClick={() => update({ sidebarCollapsed: settings.sidebarCollapsed })} className="hidden" aria-hidden="true" />
              <button onClick={() => ordersToCSV(filtered)} className="btn btn-ghost !px-2.5" title="Export filtered rows as CSV"><Download size={15} /><span className="hidden xl:inline">Export CSV</span></button>
              <button onClick={() => { resetFilters(); toast('Filters reset — full dataset in view'); }} className="btn btn-ghost !px-2.5" title="Reset all filters"><RotateCcw size={15} /><span className="hidden xl:inline">Reset</span></button>
              <button onClick={cycleTheme} className="btn btn-ghost !px-2.5" title={`Toggle theme (currently ${resolvedTheme})`} aria-label="Toggle light/dark theme">{themeIcon}<span className="hidden xl:inline">{resolvedTheme === 'dark' ? 'Dark' : 'Light'}</span></button>
              <button className="relative btn btn-ghost !px-2.5" title="Notifications" onClick={() => toast('3 insights need attention: 27 high-risk churn customers, 12 reorders due, forecast variance +6%')} aria-label="Notifications">
                <Bell size={15} /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
              </button>
              <button className="ml-0.5 flex items-center gap-2 rounded-full border border-[var(--border-strong)] py-1 pl-1 pr-2 transition-colors hover:border-[var(--indigo)]" onClick={() => navigate('/settings')} title="Account & settings">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-700 text-[0.62rem] font-bold text-white">AR</span>
                <span className="hidden text-left leading-tight sm:block"><span className="block text-[0.7rem] font-bold text-[var(--ink)]">{settings.displayName}</span><span className="block text-[0.58rem] font-medium text-[var(--faint)]">Head of Retail Ops</span></span>
              </button>
            </div>
          </div>
          {/* filter row */}
          <div className="flex items-center gap-2 overflow-x-auto border-t border-[var(--border)] px-3 py-2 [scrollbar-width:none] sm:px-4">
            <span className="hidden shrink-0 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--faint)] sm:block">Filters</span>
            <label className="flex shrink-0 items-center gap-1.5">
              <span className="sr-only">From date</span>
              <input type="date" className="select !py-1.5 text-[0.72rem]" value={filters.from} min={dateBounds.min} max={dateBounds.max} onChange={e => setFilter({ from: e.target.value })} aria-label="From date" />
            </label>
            <span className="shrink-0 text-[var(--faint)]">→</span>
            <input type="date" className="select !py-1.5 text-[0.72rem]" value={filters.to} min={dateBounds.min} max={dateBounds.max} onChange={e => setFilter({ to: e.target.value })} aria-label="To date" />
            <select className="select shrink-0 !py-1.5 text-[0.72rem]" value={filters.country} onChange={e => setFilter({ country: e.target.value })} aria-label="Country filter">
              <option value="All">All Countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="select shrink-0 !py-1.5 text-[0.72rem]" value={filters.category} onChange={e => setFilter({ category: e.target.value, subCategory: 'All' })} aria-label="Category filter">
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="select shrink-0 !py-1.5 text-[0.72rem]" value={filters.segment} onChange={e => setFilter({ segment: e.target.value })} aria-label="Segment filter">
              <option value="All">All Segments</option>
              {segments.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {/* mobile search */}
            <div className="relative min-w-[150px] flex-1 md:hidden">
              <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
              <input value={filters.search ?? ''} onChange={e => setFilter({ search: e.target.value })} placeholder="Search…" aria-label="Search" className="input w-full !py-1.5 !pl-7 text-[0.72rem]" />
            </div>
          </div>
        </header>

        {/* ============ PAGE CONTENT ============ */}
        <main className="relative min-h-0 flex-1 overflow-y-auto" id="main-scroll">
          {status === 'error' ? (
            <div className="p-6"><div className="card"><ErrorBlock message={error ?? 'Unknown error'} onRetry={reload} /></div></div>
          ) : (
            <div className="mx-auto max-w-[1600px] p-3 sm:p-5">
              <Outlet />
            </div>
          )}
        </main>
      </div>
      <Toast />
    </div>
  );
}
function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { reload } = useData();
  void reload;
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="text-base font-bold text-rose-600 dark:text-rose-400">Dataset failed to load</p>
      <p className="max-w-md font-mono2 text-xs text-[var(--muted)]">{message}</p>
      <p className="max-w-md text-xs text-[var(--muted)]">The app needs <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5">public/uploads/RetailPulse_Clean_Dataset.csv</code> to compute analytics. Verify the file exists, then retry.</p>
      <button className="btn btn-primary" onClick={onRetry}><RotateCcw size={14} /> Reload dataset</button>
    </div>
  );
}
