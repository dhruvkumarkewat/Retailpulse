import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Zap, LayoutDashboard, TrendingUp, Users, PieChart, UserX, LineChart, ArrowRight, ArrowDown,
  ChevronDown, Banknote, ShoppingCart, Globe2, Repeat2, Sparkles, Store, Warehouse, Laptop,
} from 'lucide-react';
import CinematicCanvas from '../three/CinematicCanvas';
import { useData } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';
import { kpis, byMonth, sumBy } from '../lib/engine';
import { useFmt, AnimatedNumber, PALETTE } from '../components/ui';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (t: number) => { const c = clamp01(t); return c * c * (3 - 2 * c); };
const chapterFade = (p: number, start: number, end: number, fade = 0.055) => {
  if (p < start - fade || p > end + fade) return 0;
  if (p < start) return smooth((p - (start - fade)) / fade);
  if (p > end) return 1 - smooth((p - end) / fade);
  return 1;
};

// (scroll listeners are attached directly to #main-scroll inside the choreography effect)

export default function Home() {
  const { rows, status } = useData();
  const { settings } = useSettings();
  const fmt = useFmt();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const scrollP = useRef(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const chapterEls = useRef<(HTMLDivElement | null)[]>([]);
  const photoRefs = useRef<(HTMLDivElement | null)[]>([]);
  const photoImgRefs = useRef<(HTMLImageElement | null)[]>([]);

  // live stats from the real dataset
  const stats = useMemo(() => {
    if (!rows.length) return null;
    const k = kpis(rows);
    const monthly = byMonth(rows);
    return { ...k, months: monthly.length };
  }, [rows]);

  // ---------- scroll choreography ----------
  useEffect(() => {
    const el = document.getElementById('main-scroll');
    if (!el) return;
    let raf = 0;
    const update = () => {
      const hero = heroRef.current;
      if (hero) {
        const vh = el.clientHeight;
        const p = clamp01(el.scrollTop / Math.max(1, hero.offsetHeight - vh));
        scrollP.current = p;
        if (progressBarRef.current) progressBarRef.current.style.transform = `scaleX(${p})`;
        // chapter captions
        const ranges: [number, number][] = [[0, 0.30], [0.315, 0.635], [0.65, 1]];
        chapterEls.current.forEach((cap, i) => {
          if (!cap) return;
          const o = chapterFade(p, ranges[i][0], ranges[i][1]);
          cap.style.opacity = String(o);
          cap.style.transform = `translateY(${(1 - o) * 34}px)`;
          cap.style.filter = `blur(${(1 - o) * 7}px)`;
          cap.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
        });
      }
      // photo mask reveals
      const vh = el.clientHeight;
      photoRefs.current.forEach((sec, i) => {
        if (!sec) return;
        const rect = sec.getBoundingClientRect();
        const prog = clamp01((vh * 0.92 - rect.top) / (vh * 0.62 + rect.height * 0.32));
        const e = 1 - Math.pow(1 - prog, 3);
        sec.style.clipPath = `circle(${8 + e * 72}% at 50% 46%)`;
        sec.style.opacity = String(0.25 + e * 0.75);
        const img = photoImgRefs.current[i];
        if (img) img.style.transform = `scale(${1.28 - e * 0.28}) translateY(${(1 - e) * 26}px)`;
      });
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    el.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [status]);

  const reduced = settings.reducedMotion;
  const chapters = [
    {
      eyebrow: 'Chapter 00 — The Platform',
      title: <>Every sale tells a story.<br /><span className="text-blue-400">RetailPulse reads it.</span></>,
      body: '3,805 transactions · 3,742 orders · 1,194 products · 35 countries — parsed live from the clean dataset and rendered into decisions, not dashboards.',
      cta: { label: 'Enter the Executive Dashboard', to: '/dashboard', icon: <LayoutDashboard size={15} /> },
    },
    {
      eyebrow: 'Chapter 01 — Global Signal',
      title: <>One dataset.<br />35 markets.<br /><span className="text-blue-400">Every signal live.</span></>,
      body: 'Follow the revenue arcs. The globe you see is wired to £218.5K of gross merchandise value across 35 countries including United Kingdom, Germany, France, Ireland, Netherlands, Australia, Spain, Switzerland, and 6 regions.',
      cta: { label: 'Explore Country Analysis', to: '/countries', icon: <Globe2 size={15} /> },
    },
    {
      eyebrow: 'Chapter 02 — Decision Ready',
      title: <>From shelf to strategy<br />in <span className="text-blue-400">minutes.</span></>,
      body: 'Real churn risk per customer, ABC classification & stock suggestions per SKU, and back-tested monthly demand forecasts — every number traceable to the clean CSV.',
      cta: { label: 'Open Demand Forecasting', to: '/forecast', icon: <TrendingUp size={15} /> },
    },
  ];

  return (
    <div className="-m-3 sm:-m-5">
      {/* ============ PINNED CINEMATIC HERO (3 chapters) ============ */}
      <div ref={heroRef} className="relative h-[320vh]" aria-label="RetailPulse cinematic introduction">
        <div className="sticky top-0 h-[calc(100vh-104px)] min-h-[540px] overflow-hidden bg-[#090b0e] grain">
          {/* WebGL scene */}
          <CinematicCanvas progressRef={scrollP} className="absolute inset-0" />
          {/* cinematic vignette gradients */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#090b0e]/90 via-[#090b0e]/30 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090b0e]/95 via-transparent to-[#090b0e]/40" />
          <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 180px 40px rgba(0,0,0,.85)' }} />

          {/* ===== chapter captions ===== */}
          <div className="absolute inset-0 z-20">
            {chapters.map((ch, i) => (
              <div key={i} ref={el => { chapterEls.current[i] = el; }}
                className="chapter-caption absolute inset-0 flex flex-col justify-center px-5 sm:px-10 lg:px-16 xl:px-20"
                style={{ opacity: i === 0 ? 1 : 0, pointerEvents: i === 0 ? 'auto' : 'none' }}>
                <p className="font-mono2 text-[0.62rem] font-semibold uppercase tracking-[0.25em] text-blue-400 sm:text-[0.68rem]">{ch.eyebrow}</p>
                <h1 className="mt-3 max-w-3xl text-[2rem] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl xl:text-[3.4rem]">{ch.title}</h1>
                <p className="mt-4 max-w-md text-[0.8rem] leading-relaxed text-slate-300 sm:text-[0.92rem]">{ch.body}</p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link to={ch.cta.to} className="btn !rounded-lg !border-0 bg-blue-600 hover:bg-blue-500 !px-5 !py-2.5 text-[0.8rem] font-semibold text-white shadow-md transition-all">
                    {ch.cta.icon}{ch.cta.label}
                  </Link>
                  {i === 0 && (
                    <button onClick={() => { const el = document.getElementById('main-scroll'); if (el) el.scrollTo({ top: el.clientHeight, behavior: reduced ? 'auto' : 'smooth' }); }}
                      className="flex items-center gap-2 text-[0.75rem] font-semibold text-slate-400 transition-colors hover:text-white">
                      Scroll the story <ArrowDown size={14} className="animate-bounce" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ===== live KPI rail (right) ===== */}
          <div className="absolute right-4 top-1/2 z-20 hidden w-[212px] -translate-y-1/2 flex-col gap-2.5 lg:flex xl:right-10 xl:w-[232px]">
            <div className="flex items-center gap-2 px-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-dot" />
              <p className="font-mono2 text-[0.6rem] font-bold uppercase tracking-[0.22em] text-emerald-400">Live from dataset</p>
            </div>
            {stats && [
              { label: 'Gross revenue', value: stats.revenue, format: (n: number) => fmt.money(n) },
              { label: 'Net profit', value: stats.profit, format: (n: number) => fmt.money(n) },
              { label: 'Orders', value: stats.orders, format: (n: number) => fmt.num(n) },
              { label: 'Avg order value', value: stats.aov, format: (n: number) => fmt.money(n, 2) },
            ].map((k, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-[#11141a]/90 px-4 py-3 shadow-lg backdrop-blur-md transition-colors hover:border-white/20">
                <p className="font-mono2 text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-slate-400">{k.label}</p>
                <p className="mt-1 text-lg font-bold tracking-tight text-white tabular-nums"><AnimatedNumber value={k.value} format={k.format} /></p>
              </div>
            ))}
          </div>

          {/* ===== bottom progress + chapters ===== */}
          <div className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-4 sm:px-10 sm:pb-6 lg:px-16 xl:px-20">
            <div className="mb-2 flex items-center justify-between font-mono2 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
              <span>00 Platform</span><span>01 Global Signal</span><span>02 Decision Ready</span>
            </div>
            <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/10">
              <div ref={progressBarRef} className="h-full w-full origin-left bg-blue-500" style={{ transform: 'scaleX(0)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ============ CHAPTER INDEX ============ */}
      <section className="bg-[var(--bg)] px-5 py-14 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono2 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">The Chapters</p>
          <h2 className="mt-2 max-w-xl text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl">Pick the question.<br />The dataset answers.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { to: '/sales', icon: <LineChart size={20} />, title: 'Sales Analytics', stat: stats ? fmt.money(stats.revenue) : '—', label: 'gross revenue in view', iconBg: 'bg-blue-600' },
              { to: '/segmentation', icon: <PieChart size={20} />, title: 'Segmentation', stat: stats ? fmt.num(stats.uniqueCustomers) : '—', label: 'customers, RFM-scored live', iconBg: 'bg-emerald-600' },
              { to: '/churn', icon: <UserX size={20} />, title: 'Churn Risk', stat: '45 pts', label: 'max recency weight in scoring', iconBg: 'bg-amber-600' },
              { to: '/forecast', icon: <TrendingUp size={20} />, title: 'Demand Forecast', stat: stats ? `${stats.months} mo` : '—', label: 'of history, back-tested', iconBg: 'bg-sky-600' },
            ].map((c, i) => (
              <Link key={i} to={c.to} className="card card-hover group relative overflow-hidden p-5">
                <div className={`inline-flex rounded-lg ${c.iconBg} p-2.5 text-white shadow-sm`}>{c.icon}</div>
                <p className="mt-3 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{c.title}</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--ink)] tabular-nums">{c.stat}</p>
                <p className="mt-0.5 text-[0.68rem] text-[var(--faint)]">{c.label}</p>
                <ArrowRight size={16} className="absolute bottom-4 right-4 text-[var(--faint)] transition-all duration-200 group-hover:translate-x-1 group-hover:text-[var(--indigo)]" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FIELD PHOTOGRAPHS — SCROLL-REVEALED MASKS ============ */}
      <section className="relative bg-[#090b0e] py-16 sm:py-20 border-t border-b border-white/8">
        <div className="px-5 sm:px-10 lg:px-16">
          <p className="font-mono2 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-blue-400">Captured in the Field</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold text-white sm:text-4xl">Where the data <span className="text-blue-400">actually lives</span></h2>
        </div>
        <div className="mt-10 grid gap-6 px-5 sm:grid-cols-3 sm:px-10 lg:px-16">
          {[
            { img: '/images/retail-store.jpg', icon: <Store size={15} />, title: 'The store floor', body: '£218.5K across 11 categories — Seasonal, Home Decor, Kitchen, Garden & more — captured at transaction level.' },
            { img: '/images/warehouse.jpg', icon: <Warehouse size={15} />, title: 'The replenishment aisle', body: 'Real ABC classes and stock suggestions computed per SKU from 13 months of real demand velocity.' },
            { img: '/images/team-analytics.jpg', icon: <Laptop size={15} />, title: 'The operating review', body: 'Executives see the same numbers the analysts see — margin, churn risk and forecast, one source of truth.' },
          ].map((p, i) => (
            <figure key={i}>
              <div ref={el => { photoRefs.current[i] = el; }} className="relative h-[340px] overflow-hidden rounded-2xl border border-white/10 will-change-[clip-path,opacity] sm:h-[420px]" style={{ clipPath: 'circle(8% at 50% 46%)' }}>
                <img ref={el => { photoImgRefs.current[i] = el; }} src={p.img} alt={p.title} loading="lazy" className="h-full w-full object-cover will-change-transform" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090b0e]/90 via-[#090b0e]/20 to-transparent" />
                <figcaption className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="flex items-center gap-1.5 font-mono2 text-[0.58rem] font-bold uppercase tracking-[0.22em] text-blue-400">{p.icon}{p.title}</p>
                  <p className="mt-1.5 text-[0.74rem] leading-snug text-slate-300">{p.body}</p>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </section>

      {/* ============ MANIFESTO + STAT STRIP ============ */}
      <section className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-14 sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-mono2 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-[var(--indigo)]">Why RetailPulse</p>
            <h2 className="font-display mt-3 text-3xl font-light leading-tight tracking-tight text-[var(--ink)]">Dashboards show numbers.<br /><span className="text-[var(--indigo)]">RetailPulse shows decisions.</span></h2>
            <p className="mt-4 max-w-md text-[0.85rem] leading-relaxed text-[var(--muted)]">Every metric in this application is computed at runtime from the cleaned source CSV — currency-aware parsing, missing-value handling, and an honestly back-tested forecast. No mock screenshots, no invented models, no fake precision.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['RFM segmentation', 'Real churn risk scoring', 'Holt’s linear trend + holdout back-test', 'ABC inventory classification'].map(t => <span key={t} className="chip">{t}</span>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { v: stats ? stats.margin : 0, f: (n: number) => n.toFixed(1) + '%', l: 'Net margin across all orders' },
              { v: stats ? stats.aov : 0, f: (n: number) => fmt.money(n, 2), l: 'Average order value' },
              { v: stats ? stats.returnRate : 0, f: (n: number) => n.toFixed(1) + '%', l: 'Outlier / return rate' },
              { v: stats ? stats.uniqueCustomers : 0, f: (n: number) => fmt.num(n), l: 'Unique accounts served' },
            ].map((s, i) => (
              <div key={i} className="card p-5">
                <p className="text-2xl font-extrabold tracking-tight text-[var(--ink)] tabular-nums"><AnimatedNumber value={s.v} format={s.f} /></p>
                <p className="mt-1.5 text-[0.7rem] leading-snug text-[var(--muted)]">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-[var(--bg)] px-5 py-14 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono2 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-[var(--indigo)]">Questions</p>
          <h2 className="font-display mt-2 text-3xl font-light text-[var(--ink)]">Asked in every operating review</h2>
          <div className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {[
              ['Is this real data or a demo?', 'Real, computed live. The application parses RetailPulse_Clean_Dataset.csv (3,805 rows × 29 columns) on load. KPI cards, charts, tables, churn scores, reorder points and the forecast are all derived from it in your browser.'],
              ['How accurate is the demand forecast?', 'It is honest about it. We hold out recent months chronologically, fit Holt’s linear trend and baselines on the training set, and report MAE / RMSE / MAPE for each. The holdout winner is shown with a “back-tested” badge on the Forecasting page.'],
              ['How is churn risk determined?', 'Directly from the real dataset classification (High, Medium, Low) and Recency Days (0 to 373 days). The transparent scoring breaks down dormancy, order size profile and transaction tier drivers.'],
              ['Where does inventory ABC class & stock suggestion come from?', 'Directly from the clean dataset columns Product ABC Class (A, B, C) and Stock Suggestion (Maintain Stock, Reduce Stock), combined with real SKU sales velocity.'],
              ['Can I export everything?', 'Yes — filtered CSV export from the top bar, per-page table exports, plus executive PDF reports generated from jsPDF on the Reports page.'],
            ].map(([q, a], i) => <FaqRow key={i} q={q} a={a} />)}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="relative overflow-hidden bg-[#070b23] px-5 py-20 text-center sm:px-10">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,.32),transparent_65%)]" />
        <p className="font-mono2 relative text-[0.65rem] font-bold uppercase tracking-[0.35em] text-cyan-300">Begin</p>
        <h2 className="font-display relative mx-auto mt-4 max-w-3xl text-4xl font-light leading-[1.05] text-white sm:text-6xl">Your next quarter<br />is already in <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">the data.</span></h2>
        <button onClick={() => navigate('/dashboard')} className="btn relative mt-8 !rounded-full !border-0 bg-gradient-to-r from-cyan-400 to-indigo-500 !px-8 !py-3.5 text-sm font-bold text-slate-950 shadow-[0_0_44px_rgba(99,102,241,.5)] transition-transform hover:scale-105">
          <Zap size={16} fill="currentColor" /> Launch RetailPulse — it’s free with your data
        </button>
        <p className="relative mt-5 font-mono2 text-[0.6rem] uppercase tracking-[0.25em] text-indigo-300/60">3,805 rows · 29 columns · 1 source of truth</p>
      </section>
    </div>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--surface-2)]" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="text-[0.86rem] font-semibold text-[var(--ink)]">{q}</span>
        <ChevronDown size={16} className={`shrink-0 text-[var(--muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-4 text-[0.8rem] leading-relaxed text-[var(--muted)]">{a}</div>}
    </div>
  );
}
