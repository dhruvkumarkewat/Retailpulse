import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { loadDataset, applyFilters, EMPTY_FILTERS, type OrderRow, type Filters, type ParseReport } from '../lib/engine';

interface DataCtx {
  rows: OrderRow[];
  filtered: OrderRow[];
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  resetFilters: () => void;
  setFilter: (patch: Partial<Filters>) => void;
  countries: string[];
  categories: string[];
  subCategories: string[];
  segments: string[];
  products: string[];
  dateBounds: { min: string; max: string };
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  report: ParseReport | null;
  reload: () => void;
}
const Ctx = createContext<DataCtx | null>(null);

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [report, setReport] = useState<ParseReport | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const load = useCallback(() => {
    setStatus('loading'); setError(null);
    loadDataset()
      .then(r => { setReport(r); setStatus('ready'); })
      .catch(e => { setError(e?.message ?? 'Failed to load dataset'); setStatus('error'); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => report?.rows ?? [], [report]);
  const meta = useMemo(() => {
    if (!rows.length) return { countries: [], categories: [], subCategories: [], segments: [], products: [], min: '', max: '' };
    const uniq = (fn: (r: OrderRow) => string) => [...new Set(rows.map(fn))].sort();
    const min = isoLocal(new Date(Math.min(...rows.map(r => r.date.getTime()))));
    const max = isoLocal(new Date(Math.max(...rows.map(r => r.date.getTime()))));
    return { countries: uniq(r => r.country), categories: uniq(r => r.category), subCategories: uniq(r => r.subCategory), segments: uniq(r => r.segment), products: uniq(r => r.productName), min, max };
  }, [rows]);

  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const setFilter = useCallback((patch: Partial<Filters>) => setFilters(f => ({ ...f, ...patch })), []);
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const value: DataCtx = {
    rows, filtered, filters, setFilters, resetFilters, setFilter,
    countries: meta.countries, categories: meta.categories, subCategories: meta.subCategories, segments: meta.segments, products: meta.products,
    dateBounds: { min: meta.min, max: meta.max },
    status, error, report, reload: load,
  };
  return React.createElement(Ctx.Provider, { value }, children);
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData must be used inside <DataProvider>');
  return c;
}
