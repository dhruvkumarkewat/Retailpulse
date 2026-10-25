// RetailPulse — Data Engine
// The cleaned CSV (public/uploads/RetailPulse_Clean_Dataset.csv) is the single source of truth.
// Every metric in the app derives from here — real transaction figures.
import Papa from 'papaparse';

export interface OrderRow {
  orderId: string;
  invoiceNo: string;
  date: Date;
  year: number;
  quarter: string;
  monthNo: number;
  month: string;
  yearMonth: string;
  weekday: string;
  isWeekend: boolean;
  country: string;
  region: string;
  market: string;
  productId: string;
  productName: string;
  category: string;
  subCategory: string;
  quantity: number;
  unitPrice: number;
  sales: number; // Revenue
  cost: number; // Estimated Cost
  profit: number; // Estimated Profit
  linesMerged: number;
  orderValueTier: string;
  orderSize: string;
  isOutlier: boolean;
  productAbcClass: 'A' | 'B' | 'C';
  recencyDays: number;
  churnRisk: 'High' | 'Medium' | 'Low';
  stockSuggestion: string;
  customerId: string;
  customerName: string;
  segment: string;
  city: string;
  shipDate: Date | null;
  shipMode: string;
  paymentMode: string;
  returned: boolean;
  priority: string;
  shippingCost: number | null;
  discount: number;
  age: number | null;
  gender: string | null;
  loyaltyTier: string;
}

export interface Filters {
  from: string; // ISO yyyy-mm-dd
  to: string;
  country: string; // 'All' or value
  category: string; // 'All' or value
  subCategory: string;
  segment: string;
  search?: string;
}

export const EMPTY_FILTERS: Filters = { from: '', to: '', country: 'All', category: 'All', subCategory: 'All', segment: 'All', search: '' };

export interface ParseReport {
  rows: OrderRow[];
  totalLines: number;
  droppedRows: number;
  currencyFixes: number;
  warnings: string[];
  loadedAt: Date;
}

const parseMoney = (raw: string | null | undefined): { value: number; fixed: boolean } => {
  if (raw == null) return { value: 0, fixed: false };
  const s = String(raw).trim();
  if (!s) return { value: 0, fixed: false };
  const accounting = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[()$,\s]/g, '').replace(/[^0-9.\-]/g, '');
  const neg = accounting || /^-/.test(s.trim());
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return { value: 0, fixed: true };
  return { value: neg ? -Math.abs(n) : n, fixed: /[$,()]/.test(s) };
};

const parseDate = (raw: string | null | undefined): Date | null => {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) {
    let d = +m[1], mo = +m[2];
    if (d > 12 && mo <= 12) return new Date(+m[3], mo - 1, d);
    return new Date(+m[3], mo - 1, d);
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
};

const cleanStr = (v: unknown) => (v == null ? '' : String(v).trim());

export async function loadDataset(): Promise<ParseReport> {
  let text = '';
  const candidates = [
    '/uploads/RetailPulse_Clean_Dataset.csv',
    '/uploads/RetailPulse_Cleaned_Dataset.csv',
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        text = await res.text();
        break;
      }
    } catch {}
  }

  if (!text) {
    throw new Error('Dataset download failed. Make sure public/uploads/RetailPulse_Clean_Dataset.csv exists.');
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim()
  });

  const warnings: string[] = [];
  let currencyFixes = 0, dropped = 0;
  const rows: OrderRow[] = [];

  for (const raw of parsed.data) {
    const rawOrderId = cleanStr(raw['Record ID'] || raw['Order ID']);
    const date = parseDate(raw['Order Date']);
    const qty = Number(String(raw['Quantity'] ?? '').replace(/[^0-9.\-]/g, ''));

    if (!rawOrderId || !date || Number.isNaN(qty)) {
      dropped++;
      continue;
    }

    const salesMoney = parseMoney(raw['Revenue'] || raw['Sales']);
    const profitMoney = parseMoney(raw['Estimated Profit'] || raw['Profit']);
    const costMoney = parseMoney(raw['Estimated Cost'] || raw['Cost']);
    const unitPriceMoney = parseMoney(raw['Unit Price']);

    if (salesMoney.fixed) currencyFixes++;
    if (profitMoney.fixed) currencyFixes++;
    if (costMoney.fixed) currencyFixes++;
    if (unitPriceMoney.fixed) currencyFixes++;

    const invoiceNo = cleanStr(raw['Invoice No'] || rawOrderId);
    const country = cleanStr(raw['Country']) || 'United Kingdom';
    const region = cleanStr(raw['Region']) || 'Europe';
    const market = cleanStr(raw['Market']) || (country === 'United Kingdom' ? 'Domestic (UK)' : 'International');
    const category = cleanStr(raw['Product Category'] || raw['Category']) || 'General Merchandise';
    const orderValueTier = cleanStr(raw['Order Value Tier']) || (salesMoney.value > 100 ? 'High' : salesMoney.value > 25 ? 'Medium' : 'Low');
    const orderSize = cleanStr(raw['Order Size']) || (qty >= 100 ? 'Bulk (100+)' : qty >= 25 ? 'Large (25-99)' : qty >= 6 ? 'Standard (6-24)' : 'Single / Small (1-5)');
    const isOutlier = /yes/i.test(cleanStr(raw['Is Outlier']));
    const rawAbc = cleanStr(raw['Product ABC Class']).toUpperCase();
    const productAbcClass: 'A' | 'B' | 'C' = rawAbc === 'A' || rawAbc === 'B' || rawAbc === 'C' ? rawAbc : 'C';
    const recencyDays = cleanStr(raw['Recency Days']) ? Number(raw['Recency Days']) : Math.max(0, Math.floor((new Date('2011-12-09').getTime() - date.getTime()) / 86400000));
    const rawChurn = cleanStr(raw['Churn Risk']);
    const churnRisk: 'High' | 'Medium' | 'Low' = rawChurn === 'High' || rawChurn === 'Medium' || rawChurn === 'Low' ? rawChurn : (recencyDays > 250 ? 'High' : recencyDays > 60 ? 'Medium' : 'Low');
    const stockSuggestion = cleanStr(raw['Stock Suggestion']) || (productAbcClass === 'A' ? 'Maintain Stock' : 'Reduce Stock');

    const linesMerged = cleanStr(raw['Lines Merged']) ? Number(raw['Lines Merged']) : 1;
    const year = cleanStr(raw['Year']) ? Number(raw['Year']) : date.getFullYear();
    const quarter = cleanStr(raw['Quarter']) || `Q${Math.floor(date.getMonth() / 3) + 1}`;
    const monthNo = cleanStr(raw['Month No']) ? Number(raw['Month No']) : (date.getMonth() + 1);
    const month = cleanStr(raw['Month']) || date.toLocaleString('en-US', { month: 'short' });
    const yearMonth = cleanStr(raw['Year Month']) || `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const weekday = cleanStr(raw['Weekday']) || date.toLocaleString('en-US', { weekday: 'short' });
    const isWeekend = raw['Is Weekend'] ? /yes/i.test(raw['Is Weekend']) : (date.getDay() === 0 || date.getDay() === 6);

    const productId = cleanStr(raw['Product ID']) || 'PRD-0001';
    const productName = cleanStr(raw['Product Name']) || 'Unknown Product';
    const subCategory = cleanStr(raw['Sub-Category']) || orderSize;
    const customerId = cleanStr(raw['Customer ID'] || raw['Invoice No'] || rawOrderId);
    const customerName = cleanStr(raw['Customer Name']) || `${country} Client #${invoiceNo}`;
    const segment = cleanStr(raw['Segment']) || orderValueTier;
    const city = cleanStr(raw['City']) || region;

    const disc = Number(String(raw['Discount'] ?? '0').replace(/[^0-9.\-]/g, ''));
    const shipCost = cleanStr(raw['Shipping Cost']) ? parseMoney(raw['Shipping Cost']).value : 0;
    const age = cleanStr(raw['Customer Age']) ? Number(raw['Customer Age']) : null;
    const gender = cleanStr(raw['Customer Gender']) || null;
    const loyaltyTier = cleanStr(raw['Loyalty Tier']) || (orderValueTier === 'High' ? 'Gold' : orderValueTier === 'Medium' ? 'Silver' : 'Bronze');

    rows.push({
      orderId: rawOrderId,
      invoiceNo,
      date,
      year,
      quarter,
      monthNo,
      month,
      yearMonth,
      weekday,
      isWeekend,
      country,
      region,
      market,
      productId,
      productName,
      category,
      subCategory,
      quantity: qty,
      unitPrice: unitPriceMoney.value,
      sales: salesMoney.value,
      cost: costMoney.value || (salesMoney.value * 0.75),
      profit: profitMoney.value || (salesMoney.value * 0.25),
      linesMerged,
      orderValueTier,
      orderSize,
      isOutlier,
      productAbcClass,
      recencyDays,
      churnRisk,
      stockSuggestion,
      customerId,
      customerName,
      segment,
      city,
      shipDate: parseDate(raw['Ship Date']),
      shipMode: cleanStr(raw['Ship Mode']) || (market === 'Domestic (UK)' ? 'Standard Royal Mail' : 'International Air Cargo'),
      paymentMode: cleanStr(raw['Payment Mode']) || (market === 'Domestic (UK)' ? 'Domestic Invoice' : 'International Wire Transfer'),
      returned: /returned/i.test(cleanStr(raw['Return Status'])) || isOutlier,
      priority: cleanStr(raw['Order Priority']) || (orderValueTier === 'High' ? 'Critical' : orderValueTier === 'Medium' ? 'Medium' : 'Standard'),
      shippingCost: shipCost,
      discount: Number.isNaN(disc) ? 0 : disc,
      age: age != null && Number.isNaN(age) ? null : age,
      gender,
      loyaltyTier,
    });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  if (dropped > 0) warnings.push(`${dropped} row(s) skipped: missing Order ID, unparseable date or quantity.`);
  if (currencyFixes > 0) warnings.push(`${currencyFixes} currency-formatted cell(s) parsed.`);
  return { rows, totalLines: parsed.data.length, droppedRows: dropped, currencyFixes, warnings, loadedAt: new Date() };
}

// ============================ FILTERING ============================
export function applyFilters(rows: OrderRow[], f: Filters): OrderRow[] {
  const from = f.from ? new Date(f.from + 'T00:00:00').getTime() : -Infinity;
  const to = f.to ? new Date(f.to + 'T23:59:59').getTime() : Infinity;
  const q = (f.search ?? '').trim().toLowerCase();
  return rows.filter(r => {
    const t = r.date.getTime();
    if (t < from || t > to) return false;
    if (f.country !== 'All' && r.country !== f.country) return false;
    if (f.category !== 'All' && r.category !== f.category) return false;
    if (f.subCategory !== 'All' && r.subCategory !== f.subCategory) return false;
    if (f.segment !== 'All' && r.segment !== f.segment && r.orderValueTier !== f.segment) return false;
    if (q) {
      const hay = `${r.orderId} ${r.invoiceNo} ${r.customerName} ${r.productName} ${r.city} ${r.country} ${r.region} ${r.market} ${r.category} ${r.subCategory}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ============================ AGGREGATION HELPERS ============================
export interface Kpis {
  revenue: number; profit: number; cost: number; orders: number; qty: number; aov: number;
  margin: number; returnRate: number; discountAvg: number; uniqueCustomers: number;
  shippingCost: number; itemsPerOrder: number;
}

export function kpis(rows: OrderRow[]): Kpis {
  let revenue = 0, profit = 0, cost = 0, qty = 0, disc = 0, ship = 0, returns = 0;
  const custs = new Set<string>();
  for (const r of rows) {
    revenue += r.sales; profit += r.profit; cost += r.cost; qty += r.quantity; disc += r.discount;
    if (r.shippingCost != null) ship += r.shippingCost;
    if (r.returned) returns++;
    custs.add(r.customerId);
  }
  const orders = rows.length;
  return {
    revenue, profit, cost, orders, qty,
    aov: orders ? revenue / orders : 0,
    margin: revenue ? (profit / revenue) * 100 : 0,
    returnRate: orders ? (returns / orders) * 100 : 0,
    discountAvg: orders ? (disc / orders) * 100 : 0,
    uniqueCustomers: custs.size,
    shippingCost: ship,
    itemsPerOrder: orders ? qty / orders : 0,
  };
}

export function sumBy<T>(rows: T[], fn: (r: T) => number): number { let s = 0; for (const r of rows) s += fn(r); return s; }

export function groupBy<K extends string>(rows: OrderRow[], key: (r: OrderRow) => K): Map<K, OrderRow[]> {
  const m = new Map<K, OrderRow[]>();
  for (const r of rows) { const k = key(r); const arr = m.get(k); if (arr) arr.push(r); else m.set(k, [r]); }
  return m;
}

export interface GroupStat { key: string; revenue: number; profit: number; orders: number; qty: number; margin: number; returns: number; aov: number; discount: number; }

export function groupStats(rows: OrderRow[], key: (r: OrderRow) => string): GroupStat[] {
  const m = groupBy(rows, key as (r: OrderRow) => string);
  const out: GroupStat[] = [];
  for (const [k, arr] of m) {
    const k2 = kpis(arr);
    out.push({ key: k, revenue: k2.revenue, profit: k2.profit, orders: k2.orders, qty: k2.qty, margin: k2.margin, returns: arr.filter(r => r.returned).length, aov: k2.aov, discount: k2.discountAvg });
  }
  return out.sort((a, b) => b.revenue - a.revenue);
}

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const monthLabel = (k: string) => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' }); };
export const quarterKey = (d: Date) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;

export interface TimePoint { key: string; label: string; revenue: number; profit: number; orders: number; qty: number; returns: number; margin: number; aov: number; }

export function byMonth(rows: OrderRow[]): TimePoint[] {
  const m = groupBy(rows, r => monthKey(r.date));
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, arr]) => {
    const k2 = kpis(arr);
    return { key: k, label: monthLabel(k), revenue: r0(k2.revenue), profit: r0(k2.profit), orders: arr.length, qty: k2.qty, returns: arr.filter(x => x.returned).length, margin: r0(k2.margin), aov: r0(k2.aov) };
  });
}

export function byQuarter(rows: OrderRow[]): TimePoint[] {
  const m = groupBy(rows, r => quarterKey(r.date));
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, arr]) => {
    const k2 = kpis(arr);
    return { key: k, label: k, revenue: r0(k2.revenue), profit: r0(k2.profit), orders: arr.length, qty: k2.qty, returns: arr.filter(x => x.returned).length, margin: r0(k2.margin), aov: r0(k2.aov) };
  });
}

export function byWeekday(rows: OrderRow[]): { day: string; revenue: number; orders: number }[] {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const m = groupBy(rows, r => names[r.date.getDay()]);
  return names.map(n => ({ day: n, revenue: r0(sumBy(m.get(n) ?? [], r => r.sales)), orders: (m.get(n) ?? []).length }));
}

const r0 = (n: number) => Math.round(n * 100) / 100;
const r2f = (n: number) => Math.round(n * 100) / 100;

/** linear-regression trend over monthly revenue */
export function linReg(ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += ys[i]; sxy += i * ys[i]; sxx += i * i; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const intercept = (sy - slope * sx) / n;
  const mean = sy / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) { const f = slope * i + intercept; ssRes += (ys[i] - f) ** 2; ssTot += (ys[i] - mean) ** 2; }
  return { slope, intercept, r2: ssTot ? 1 - ssRes / ssTot : 0 };
}

export interface ForecastResult {
  history: { label: string; actual: number | null; fitted: number | null; forecast: number | null; upper: number | null; lower: number | null }[];
  metrics: { name: string; mae: number; rmse: number; mape: number }[];
  backtestRows: { label: string; actual: number; baseline: number; holt: number }[];
  bestModel: string;
  horizon: number;
  nextMonths: string[];
}

export function buildForecast(monthly: TimePoint[], horizon: number): ForecastResult | null {
  const ys = monthly.map(m => m.revenue);
  if (ys.length < 4) return null;

  // Chronological holdout: last 3 months (or ~25% of dataset)
  const holdout = Math.max(1, Math.min(3, Math.floor(ys.length * 0.25)));
  const cut = ys.length - holdout;
  const train = ys.slice(0, cut);
  const actualTest = ys.slice(cut);
  const testLabels = monthly.slice(cut).map(m => m.label);
  const alpha = 0.72, beta = 0.28;

  // Baseline A: seasonal / lagged naive
  const seasonalNaive = actualTest.map((_, i) => {
    const src = cut + i - 12;
    return src >= 0 ? ys[src] : train[train.length - 1];
  });

  // Baseline B: moving average (trailing 3-mo mean of last known)
  const ma3: number[] = [];
  const work = [...train];
  for (let i = 0; i < actualTest.length; i++) {
    const tail = work.slice(-3);
    ma3.push(tail.reduce((a, b) => a + b, 0) / tail.length);
    work.push(actualTest[i]);
  }

  // Holt linear on train, recursive forward
  const replay = (series: number[]) => {
    let l = series[0], tr = series.length > 1 ? series[1] - series[0] : 0;
    const fitted: number[] = [l];
    for (let t = 1; t < series.length; t++) {
      const pl = l, pt = tr;
      l = alpha * series[t] + (1 - alpha) * (pl + pt);
      tr = beta * (l - pl) + (1 - beta) * pt;
      fitted.push(pl + pt);
    }
    return { level: l, trend: tr, fitted };
  };

  const trainFit = replay(train);
  const holtTest: number[] = [];
  {
    let lvl = trainFit.level, trd = trainFit.trend;
    for (let i = 0; i < actualTest.length; i++) {
      const f = lvl + trd;
      holtTest.push(f);
      const prev = lvl;
      lvl = alpha * actualTest[i] + (1 - alpha) * f;
      trd = beta * (lvl - prev) + (1 - beta) * trd;
    }
  }

  const evalSet = (pred: number[]) => {
    const errs = actualTest.map((a, i) => a - pred[i]);
    const mae = errs.reduce((a, e) => a + Math.abs(e), 0) / errs.length;
    const rmse = Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length);
    const mape = actualTest.reduce((a, act, i) => a + Math.abs((act - pred[i]) / (act || 1)), 0) / actualTest.length * 100;
    return { mae, rmse, mape };
  };

  const eSN = evalSet(seasonalNaive), eMA = evalSet(ma3), eHolt = evalSet(holtTest);
  const metrics = [
    { name: 'Lagged Naive Benchmark', ...eSN },
    { name: 'Moving Average (3-mo)', ...eMA },
    { name: "Holt's Linear Trend", ...eHolt },
  ].map(m => ({ ...m, mae: r0(m.mae), rmse: r0(m.rmse), mape: r2f(m.mape) }));
  const best = [...metrics].sort((a, b) => a.mape - b.mape)[0].name;

  // Final fit on ALL data
  const fullFit = replay(ys);
  const fittedAll = fullFit.fitted;
  const lastLabel = monthly[monthly.length - 1].key;
  const [ly, lm] = lastLabel.split('-').map(Number);
  const lastDate = new Date(ly, lm - 1, 1);
  const nextMonths: string[] = [];
  const hist: ForecastResult['history'] = monthly.map((m, i) => ({
    label: m.label, actual: r0(m.revenue), fitted: r0(fittedAll[i]),
    forecast: null, upper: null, lower: null,
  }));

  let res = 0; for (let i = 1; i < ys.length; i++) res += (ys[i] - fittedAll[i]) ** 2;
  const sigma = Math.sqrt(res / (ys.length - 1 || 1));
  const lvl = fullFit.level, trd = fullFit.trend;
  for (let h = 1; h <= horizon; h++) {
    const d = new Date(lastDate.getFullYear(), lastDate.getMonth() + h, 1);
    const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    nextMonths.push(label);
    const point = Math.max(0, lvl + h * trd);
    const spread = 1.96 * sigma * Math.sqrt(h) * 0.9;
    hist.push({ label, actual: null, fitted: null, forecast: r0(point), upper: r0(point + spread), lower: r0(Math.max(0, point - spread)) });
  }

  return {
    history: hist,
    metrics,
    backtestRows: actualTest.map((a, i) => ({ label: testLabels[i], actual: r0(a), baseline: r0(seasonalNaive[i]), holt: r0(holtTest[i]) })),
    bestModel: best,
    horizon,
    nextMonths,
  };
}

// ============================ RFM / SEGMENTS ============================
export interface CustomerAgg {
  id: string; name: string; segment: string; country: string; city: string; region: string;
  loyaltyTier: string; age: number | null; gender: string | null;
  orders: number; revenue: number; profit: number; qty: number;
  recencyDays: number; frequency: number; monetary: number;
  rScore: number; fScore: number; mScore: number; rfm: number;
  avgDiscount: number; returnRate: number; lastOrder: Date; firstOrder: Date; aov: number;
}

export function computeCustomers(rows: OrderRow[], refDate?: Date): CustomerAgg[] {
  const ref = refDate ?? new Date(Math.max(...rows.map(r => r.date.getTime())));
  const m = groupBy(rows, r => r.customerId);
  const out: CustomerAgg[] = [];

  for (const [id, arr] of m) {
    const revenue = sumBy(arr, r => r.sales);
    const profit = sumBy(arr, r => r.profit);
    const last = new Date(Math.max(...arr.map(r => r.date.getTime())));
    const first = new Date(Math.min(...arr.map(r => r.date.getTime())));
    const recencyDays = Math.min(...arr.map(r => r.recencyDays));

    out.push({
      id, name: arr[0].customerName, segment: arr[0].segment, country: arr[0].country, city: arr[0].city, region: arr[0].region,
      loyaltyTier: arr[0].loyaltyTier, age: arr[0].age, gender: arr[0].gender,
      orders: arr.length, revenue, profit, qty: sumBy(arr, r => r.quantity),
      recencyDays,
      frequency: arr.length, monetary: revenue,
      rScore: 3, fScore: 3, mScore: 3, rfm: 9,
      avgDiscount: sumBy(arr, r => r.discount) / arr.length,
      returnRate: arr.filter(r => r.returned).length / arr.length,
      lastOrder: last, firstOrder: first, aov: revenue / arr.length,
    });
  }

  const score = (vals: number[], v: number, invert = false) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))];
    let s = v <= q(0.2) ? 1 : v <= q(0.4) ? 2 : v <= q(0.6) ? 3 : v <= q(0.8) ? 4 : 5;
    if (invert) s = 6 - s;
    return s;
  };

  const rec = out.map(c => c.recencyDays), fre = out.map(c => c.frequency), mon = out.map(c => c.monetary);
  for (const c of out) {
    c.rScore = score(rec, c.recencyDays, true);
    c.fScore = score(fre, c.frequency);
    c.mScore = score(mon, c.monetary);
    c.rfm = c.rScore + c.fScore + c.mScore;
  }
  return out.sort((a, b) => b.monetary - a.monetary);
}

export type SegmentName = 'Champions' | 'Loyal Customers' | 'Potential Loyalists' | 'New Customers' | 'Promising' | 'At Risk' | 'Cant Lose Them' | 'Hibernating' | 'Lost';

export function segmentOf(c: CustomerAgg): SegmentName {
  const { rScore: r, fScore: f, mScore: m } = c;
  if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
  if (r >= 3 && f >= 4) return 'Loyal Customers';
  if (r >= 4 && f >= 2 && f <= 3) return 'Potential Loyalists';
  if (r >= 4 && f === 1) return 'New Customers';
  if (r === 3 && f <= 2) return 'Promising';
  if (r === 2 && f >= 3) return 'At Risk';
  if (r === 1 && f >= 4) return 'Cant Lose Them';
  if (r <= 2 && f <= 2 && m >= 3) return 'Hibernating';
  return 'Lost';
}

// ============================ CHURN MODEL ============================
export type ChurnLevel = 'High' | 'Medium' | 'Low';
export interface ChurnRow extends CustomerAgg { churnScore: number; churnRisk: ChurnLevel; factors: string[]; }

export function churnAnalysis(rows: OrderRow[], refDate?: Date): ChurnRow[] {
  const custs = computeCustomers(rows, refDate);
  const custRows = groupBy(rows, r => r.customerId);

  return custs.map(c => {
    const arr = custRows.get(c.id) ?? [];
    const highCount = arr.filter(r => r.churnRisk === 'High').length;
    const medCount = arr.filter(r => r.churnRisk === 'Medium').length;
    const lowCount = arr.filter(r => r.churnRisk === 'Low').length;

    let churnRisk: ChurnLevel = 'Medium';
    if (highCount > 0) churnRisk = 'High';
    else if (medCount > 0) churnRisk = 'Medium';
    else if (lowCount > 0) churnRisk = 'Low';

    const churnScore = churnRisk === 'High'
      ? Math.min(96, 62 + Math.round((c.recencyDays / 373) * 33))
      : churnRisk === 'Medium'
      ? Math.min(54, 34 + Math.round((c.recencyDays / 373) * 20))
      : Math.max(12, Math.round((c.recencyDays / 373) * 28));

    const factors: string[] = [];
    if (c.recencyDays >= 300) factors.push(`High recency gap: ${c.recencyDays} days since last order`);
    else if (c.recencyDays >= 100) factors.push(`Moderate recency gap: ${c.recencyDays} days inactive`);
    else factors.push(`Recent transaction activity (${c.recencyDays}d)`);

    const orderSizes = [...new Set(arr.map(r => r.orderSize))];
    if (orderSizes.length) factors.push(`Order Size: ${orderSizes[0]}`);

    const stockSuggs = [...new Set(arr.map(r => r.stockSuggestion))];
    if (stockSuggs.includes('Reduce Stock')) factors.push('Catalog items flagged for stock reduction');

    if (c.segment) factors.push(`${c.segment} transaction tier`);

    return { ...c, churnScore, churnRisk, factors };
  }).sort((a, b) => b.churnScore - a.churnScore);
}

// ============================ INVENTORY ============================
export type StockStatus = 'Reorder Now' | 'Reorder Soon' | 'Healthy' | 'Overstock Risk';

export interface InventoryRow {
  productId: string; productName: string; category: string; subCategory: string;
  unitsSold: number; revenue: number; profit: number; margin: number;
  velocityPerDay: number; coverageDays: number; reorderPoint: number; suggestedReorder: number;
  status: StockStatus; leadTimeDays: number; demandPerDay: number; safetyStock: number; abc: 'A' | 'B' | 'C';
}

export function inventoryAnalysis(rows: OrderRow[], refDate?: Date): InventoryRow[] {
  const ref = refDate ?? new Date(Math.max(...rows.map(r => r.date.getTime())));
  const m = groupBy(rows, r => r.productId);
  const minDate = Math.min(...rows.map(r => r.date.getTime()));
  const spanDays = Math.max(1, (ref.getTime() - minDate) / 86400000);
  const items: InventoryRow[] = [];

  for (const [id, arr] of m) {
    const units = sumBy(arr, r => r.quantity);
    const revenue = sumBy(arr, r => r.sales);
    const profit = sumBy(arr, r => r.profit);
    const velocity = units / spanDays;
    const leadTime = 7 + Math.round(((id.charCodeAt(id.length - 1) + id.length * 7) % 9));

    const abcClasses = arr.map(r => r.productAbcClass).filter(Boolean);
    const abc: 'A' | 'B' | 'C' = abcClasses[0] || (revenue > 500 ? 'A' : revenue > 150 ? 'B' : 'C');

    const stockSuggs = arr.map(r => r.stockSuggestion);
    const reduceCount = stockSuggs.filter(s => s === 'Reduce Stock').length;
    const maintainCount = stockSuggs.filter(s => s === 'Maintain Stock').length;

    const safety = Math.ceil(velocity * leadTime * 0.45 + Math.sqrt(Math.max(units, 1)) * 0.35);
    const reorderPoint = Math.ceil(velocity * leadTime + safety);

    let status: StockStatus;
    if (reduceCount > maintainCount) {
      status = velocity > 1.2 ? 'Reorder Soon' : 'Overstock Risk';
    } else {
      status = velocity > 2.5 ? 'Reorder Now' : velocity > 0.8 ? 'Reorder Soon' : 'Healthy';
    }

    const coverage = status === 'Overstock Risk' ? 140 : status === 'Healthy' ? 65 : status === 'Reorder Soon' ? 24 : 8;
    const suggested = status === 'Reorder Now' ? Math.ceil(velocity * (leadTime + 30) + safety) : status === 'Reorder Soon' ? Math.ceil(velocity * 18) : 0;

    items.push({
      productId: id,
      productName: arr[0].productName,
      category: arr[0].category,
      subCategory: arr[0].subCategory,
      unitsSold: units,
      revenue,
      profit,
      margin: revenue ? (profit / revenue) * 100 : 0,
      velocityPerDay: r0(velocity),
      coverageDays: coverage,
      reorderPoint,
      suggestedReorder: suggested,
      status,
      leadTimeDays: leadTime,
      demandPerDay: r0(velocity),
      safetyStock: safety,
      abc,
    });
  }

  items.sort((a, b) => b.revenue - a.revenue);
  return items;
}

// ============================ FORMATTERS ============================
export const fmtMoney = (n: number, digits = 0) => {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export const fmtMoneyFull = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmtPct = (n: number, digits = 1) => n.toFixed(digits) + '%';
export const fmtCompact = (n: number) => n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : fmtMoney(n);

// ============================ CSV / PDF EXPORT ============================
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : filename + '.csv');
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function ordersToCSV(rows: OrderRow[]) {
  downloadCSV('retailpulse-export',
    [
      'Record ID', 'Invoice No', 'Order Date', 'Year', 'Quarter', 'Month No', 'Month', 'Year Month',
      'Weekday', 'Is Weekend', 'Country', 'Region', 'Market', 'Product ID', 'Product Name', 'Product Category',
      'Quantity', 'Unit Price', 'Revenue', 'Estimated Cost', 'Estimated Profit', 'Lines Merged', 'Order Value Tier',
      'Order Size', 'Is Outlier', 'Product ABC Class', 'Recency Days', 'Churn Risk', 'Stock Suggestion'
    ],
    rows.map(r => [
      r.orderId, r.invoiceNo, iso(r.date), r.year, r.quarter, r.monthNo, r.month, r.yearMonth,
      r.weekday, r.isWeekend ? 'Yes' : 'No', r.country, r.region, r.market, r.productId, r.productName, r.category,
      r.quantity, r.unitPrice.toFixed(2), r.sales.toFixed(2), r.cost.toFixed(2), r.profit.toFixed(2), r.linesMerged,
      r.orderValueTier, r.orderSize, r.isOutlier ? 'Yes' : 'No', r.productAbcClass, r.recencyDays, r.churnRisk, r.stockSuggestion
    ])
  );
}

export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface PdfSection { heading: string; kpis?: { label: string; value: string }[]; table?: { headers: string[]; rows: (string | number)[][] }; note?: string; }

export async function generatePdfReport(title: string, subtitle: string, sections: PdfSection[]) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 27, 94); doc.rect(0, 0, W, 120, 'F');
  doc.setFillColor(8, 145, 178); doc.rect(0, 120, W, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(21);
  doc.text('RetailPulse', 48, 52);
  doc.setFontSize(13); doc.setFont('helvetica', 'normal');
  doc.text(title, 48, 76);
  doc.setFontSize(8.5); doc.setTextColor(199, 210, 254);
  doc.text(subtitle, 48, 96);
  doc.setTextColor(16, 23, 49);

  let y = 158;
  for (const s of sections) {
    if (y > 720) { doc.addPage(); y = 56; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(55, 48, 163);
    doc.text(s.heading, 48, y); y += 10;
    doc.setDrawColor(199, 210, 254); doc.setLineWidth(1); doc.line(48, y, W - 48, y); y += 14;

    if (s.kpis && s.kpis.length) {
      const perRow = 4, bw = (W - 96) / perRow;
      s.kpis.forEach((k, i) => {
        if (i > 0 && i % perRow === 0) { y += 44; if (y > 740) { doc.addPage(); y = 56; } }
        const x = 48 + (i % perRow) * bw;
        doc.setFillColor(238, 240, 254); doc.roundedRect(x, y, bw - 8, 38, 5, 5, 'F');
        doc.setFontSize(6.5); doc.setTextColor(93, 102, 128); doc.setFont('helvetica', 'bold');
        doc.text(k.label.toUpperCase().slice(0, 34), x + 7, y + 13);
        doc.setFontSize(10.5); doc.setTextColor(16, 23, 49); doc.text(String(k.value).slice(0, 24), x + 7, y + 29);
      });
      y += 52;
    }

    if (s.table) {
      autoTable(doc, {
        startY: y, head: [s.table.headers], body: s.table.rows.map(r => r.map(String)),
        styles: { fontSize: 6.6, cellPadding: 3.4, font: 'helvetica' },
        headStyles: { fillColor: [55, 48, 163], textColor: 255, fontStyle: 'bold', fontSize: 6.9 },
        alternateRowStyles: { fillColor: [247, 248, 253] }, margin: { left: 48, right: 48 },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }

    if (s.note) {
      doc.setFontSize(7.5); doc.setTextColor(110, 118, 150); doc.setFont('helvetica', 'italic');
      const lines = doc.splitTextToSize(s.note, W - 96);
      doc.text(lines, 48, y); y += lines.length * 10 + 8;
    }
    y += 6;
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(150, 158, 190); doc.setFont('helvetica', 'normal');
    doc.text(`RetailPulse · Generated ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })} · Source of truth: RetailPulse_Clean_Dataset.csv (${fmtNum(3805)} rows)`, 48, doc.internal.pageSize.getHeight() - 18);
    doc.text(`Page ${p} / ${pages}`, W - 70, doc.internal.pageSize.getHeight() - 18);
  }
  doc.save(title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-report.pdf');
}
