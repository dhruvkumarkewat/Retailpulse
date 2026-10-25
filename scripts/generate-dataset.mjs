// Deterministic generator for RetailPulse_Cleaned_Dataset.csv
// 3,806 rows x 26 columns. Source of truth for the whole application.
import { writeFileSync } from 'fs';

// ---------- seeded PRNG ----------
let _s = 987654321;
function rand() {
  _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
void pick;
const weightedPick = (pairs) => { // [value, weight][]
  let total = 0; for (const [, w] of pairs) total += w;
  let r = rand() * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1][0];
};
const gauss = () => (rand() + rand() + rand() + rand() - 2) * 1.15; // approx normal
const r2 = (n) => Math.round(n * 100) / 100;
const fmtMoney = (n) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) * (n < 0 ? -1 : 1);
const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => (/[",\n]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));

const START = new Date(2023, 0, 1), END = new Date(2026, 8, 30);
const TOTAL_DAYS = Math.floor((END - START) / 86400000);

// ---------- reference data ----------
const FIRST = ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Elizabeth','David','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Christopher','Nancy','Daniel','Lisa','Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley','Steven','Kimberly','Paul','Emily','Andrew','Donna','Joshua','Michelle','Kevin','Carol','Brian','Amanda','George','Dorothy','Timothy','Melissa','Ronald','Deborah','Edward','Stephanie','Jason','Rebecca','Jeffrey','Laura','Ryan','Sharon','Jacob','Cynthia','Gary','Kathleen','Nicholas','Amy','Eric','Angela','Jonathan','Shirley','Stephen','Brenda','Justin','Pamela','Brandon','Emma','Benjamin','Nicole','Samuel','Helen','Gregory','Samantha','Alexander','Katherine','Patrick','Christine','Frank','Debra','Raymond','Rachel','Carlos','Elena','Priya','Wei','Yuki','Hans','Sofia','Liam','Olivia','Noah','Ava'];
const LAST = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Gomez','Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes','Stewart','Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Alvarez','Castillo','Shah','Patel','Kim','Chen','Wang','Tanaka','Sato','Muller','Schmidt','Fischer','Rossi','Ferrari','Dubois','Bernard','Silva','Santos'];

const COUNTRIES = [
  { name: 'United States', region: 'North America', weight: 0.40, cities: ['New York','Los Angeles','Chicago','Houston','Phoenix','Seattle','Atlanta','Boston','Denver','Miami'] },
  { name: 'United Kingdom', region: 'Europe', weight: 0.115, cities: ['London','Manchester','Birmingham','Leeds','Glasgow','Bristol'] },
  { name: 'Germany', region: 'Europe', weight: 0.10, cities: ['Berlin','Munich','Hamburg','Frankfurt','Cologne','Stuttgart'] },
  { name: 'Canada', region: 'North America', weight: 0.085, cities: ['Toronto','Vancouver','Montreal','Calgary','Ottawa'] },
  { name: 'Australia', region: 'Asia-Pacific', weight: 0.065, cities: ['Sydney','Melbourne','Brisbane','Perth','Adelaide'] },
  { name: 'France', region: 'Europe', weight: 0.06, cities: ['Paris','Lyon','Marseille','Toulouse','Nice'] },
  { name: 'India', region: 'Asia-Pacific', weight: 0.055, cities: ['Mumbai','Delhi','Bengaluru','Chennai','Pune','Hyderabad'] },
  { name: 'Japan', region: 'Asia-Pacific', weight: 0.05, cities: ['Tokyo','Osaka','Nagoya','Fukuoka','Sapporo'] },
  { name: 'Brazil', region: 'South America', weight: 0.035, cities: ['Sao Paulo','Rio de Janeiro','Brasilia','Curitiba'] },
  { name: 'Mexico', region: 'North America', weight: 0.03, cities: ['Mexico City','Guadalajara','Monterrey','Puebla'] },
];
const countryPairs = COUNTRIES.map(c => [c, c.weight]);

const CATALOG = {
  'Furniture': {
    weight: 0.27,
    sub: {
      'Chairs':      { margin: 0.135, price: [95, 680],   brand: ['ErgoAlign','ComfortPro','VivaSit','ZenForm'],  noun: ['Task Chair','Executive Chair','Lounge Chair','Mesh Chair','Drafting Stool'] },
      'Tables':      { margin: 0.078, price: [165, 990],  brand: ['Nordica','HausLine','TerraWood','OfficeAxis'], noun: ['Conference Table','Standing Desk','Side Table','Work Table','Coffee Table'] },
      'Bookcases':   { margin: 0.098, price: [88, 540],   brand: ['ShelfCraft','Modula','Woodline','StackTheory'],noun: ['Bookcase','Library Shelf','Display Case','Corner Shelf'] },
      'Furnishings': { margin: 0.215, price: [22, 245],   brand: ['Lumen','AuraDecor','SoftNest','GlowHaus'],     noun: ['Desk Lamp','Area Rug','Wall Art Frame','Planter','Throw Pillow'] },
    },
  },
  'Office Supplies': {
    weight: 0.335,
    sub: {
      'Storage':     { margin: 0.175, price: [42, 430],   brand: ['VaultPro','StoreRight','SecureCase','BoxLine'], noun: ['Filing Cabinet','Storage Drawer','Document Safe','Organizer Cart'] },
      'Binders':     { margin: 0.245, price: [4, 30],     brand: ['FlexBind','PaperMate Pro','ClipRight','BindRight'],noun: ['View Binder','Presentation Binder','Round Ring Binder'] },
      'Art':         { margin: 0.305, price: [6, 95],     brand: ['ChromaKit','BrightStroke','Inkwell','ColorForge'],noun: ['Marker Set','Watercolor Set','Sketch Pencil Set','Acrylic Paint Set'] },
      'Paper':       { margin: 0.265, price: [5, 48],     brand: ['BrightSheet','PurePaper','EcoWhite','ClearPrint'],noun: ['Copy Paper Ream','Recycled Paper','Cardstock Pack','Photo Paper'] },
      'Supplies':    { margin: 0.255, price: [8, 62],     brand: ['OfficeCore','DeskPro','StapleRight','ClearPath'],noun: ['Stapler','Tape Dispenser','Scissors Set','Desk Organizer','Rubber Bands Box'] },
      'Labels':      { margin: 0.33,  price: [4, 26],     brand: ['TagRight','LabelMark','PrintTag','ClearLabel'], noun: ['Shipping Labels','Laser Labels','Asset Tags','Return Address Labels'] },
    },
  },
  'Technology': {
    weight: 0.395,
    sub: {
      'Phones':      { margin: 0.16,  price: [235, 1250], brand: ['Nexa','Vantix','Orbitel','Cypher'],            noun: ['Smartphone','Business Phone','VoIP Handset'] },
      'Accessories': { margin: 0.28,  price: [12, 128],   brand: ['VoltEdge','ClickWave','SyncLine','AirLink'],   noun: ['Wireless Mouse','USB-C Hub','Mechanical Keyboard','Bluetooth Headset','Webcam HD','Laptop Stand'] },
      'Copiers':     { margin: 0.17,  price: [560, 2450], brand: ['DocuMax','PrintCore','Xeroxiline','LaserJet Pro'],noun: ['Laser Copier','Multifunction Printer','Color Copier'] },
      'Machines':    { margin: 0.19,  price: [135, 820],  brand: ['BindMaster','CutLine Pro','SealTech','PunchPro'],noun: ['Laminator','Binding Machine','Paper Shredder','Label Printer'] },
    },
  },
};

// build product catalog
const PRODUCTS = [];
let pid = 1;
for (const [cat, catDef] of Object.entries(CATALOG)) {
  for (const [sub, def] of Object.entries(catDef.sub)) {
    for (const noun of def.noun) {
      for (const brand of def.brand) {
        if (rand() < 0.62) { // sample subset per noun/brand combo for ~160 SKUs
          const price = r2(def.price[0] + Math.pow(rand(), 1.35) * (def.price[1] - def.price[0]));
          const model = `${brand.substring(0, 3).toUpperCase()}-${100 + Math.floor(rand() * 900)}${pick(['X','Pro','Max','Lite',''])}`;
          PRODUCTS.push({
            id: `PROD-${String(pid++).padStart(4, '0')}`,
            name: `${brand} ${noun} ${model}`,
            category: cat, subCategory: sub,
            basePrice: price, margin: def.margin,
          });
        }
      }
    }
  }
}

// ---------- customers (900) ----------
const SEGMENTS = ['Consumer', 'Corporate', 'Home Office'];
const customers = [];
const usedNames = new Set();
for (let i = 1; i <= 900; i++) {
  let nm;
  do { nm = `${pick(FIRST)} ${pick(LAST)}`; } while (usedNames.has(nm));
  usedNames.add(nm);
  const country = weightedPick(countryPairs);
  const tier = weightedPick([['Bronze', 0.34], ['Silver', 0.33], ['Gold', 0.23], ['Platinum', 0.10]]);
  const tierBoost = { Bronze: 0.62, Silver: 1.0, Gold: 1.45, Platinum: 2.15 }[tier];
  customers.push({
    id: `CUST-${String(i).padStart(4, '0')}`,
    name: nm,
    segment: weightedPick([['Consumer', 0.50], ['Corporate', 0.32], ['Home Office', 0.18]]),
    country: country.name, region: country.region, city: pick(country.cities),
    age: Math.round(19 + Math.pow(rand(), 1.5) * 49),
    gender: weightedPick([['Male', 0.46], ['Female', 0.475], ['Other', 0.015], ['Non-binary', 0.05]]),
    loyaltyTier: tier,
    weight: (0.42 + Math.pow(rand(), 1.75) * 2.1) * tierBoost,
  });
}
// customer sampling lookup by weight
const custPairs = customers.map(c => [c, c.weight]);
const custTotal = custPairs.reduce((a, [, w]) => a + w, 0);
function sampleCustomer() {
  let r = rand() * custTotal;
  for (const [c, w] of custPairs) { r -= w; if (r <= 0) return c; }
  return customers[customers.length - 1];
}

// ---------- transactions ----------
const monthWeight = (m) => [1.06, 0.87, 0.97, 0.94, 1.0, 0.97, 0.92, 1.05, 1.06, 1.09, 1.28, 1.24][m];
function sampleDate() {
  for (let tries = 0; tries < 60; tries++) {
    const t = rand();
    const skewed = Math.pow(t, 0.82); // growth toward recent years
    const d = new Date(START.getTime() + skewed * (END - START));
    const growth = 0.68 + 0.75 * (d - START) / (END - START);
    if (rand() < monthWeight(d.getMonth()) * growth) return d;
  }
  return new Date(START.getTime() + rand() * (END - START));
}
const qtyWeights = [[1,.22],[2,.20],[3,.16],[4,.13],[5,.08],[6,.07],[7,.04],[8,.03],[9,.02],[10,.02],[11,.012],[12,.008],[13,.005],[14,.005]];
const discWeights = [[0,.46],[0.05,.09],[0.10,.17],[0.15,.07],[0.20,.11],[0.25,.02],[0.30,.05],[0.35,.01],[0.40,.02]];

const TARGET = 3806;
const rows = [];
while (rows.length < TARGET) {
  const date = sampleDate();
  const cust = sampleCustomer();
  // category weights (segment influence: corporate leans tech)
  let catPick = [['Technology', 0.395], ['Office Supplies', 0.335], ['Furniture', 0.27]];
  if (cust.segment === 'Corporate') catPick = [['Technology', 0.47], ['Office Supplies', 0.33], ['Furniture', 0.20]];
  if (cust.segment === 'Home Office') catPick = [['Technology', 0.40], ['Office Supplies', 0.30], ['Furniture', 0.30]];
  const category = weightedPick(catPick);
  const subs = Object.entries(CATALOG[category].sub);
  const [subCategory, sdef] = subs[Math.floor(rand() * subs.length)];
  const candidates = PRODUCTS.filter(p => p.subCategory === subCategory);
  let product = candidates.length ? pick(candidates) : PRODUCTS[Math.floor(rand() * PRODUCTS.length)];
  const unitPrice = r2(product.basePrice * (0.82 + rand() * 0.42));
  const quantity = Number(weightedPick(qtyWeights));
  const discount = Number(weightedPick(discWeights));
  const sales = r2(unitPrice * quantity * (1 - discount));
  let margin = sdef.margin + gauss() * 0.075 - discount * 0.62;
  margin = Math.max(-0.48, Math.min(0.55, margin));
  const profit = r2(sales * margin);
  const shipMode = weightedPick([['Standard Class', 0.50], ['Second Class', 0.29], ['First Class', 0.18], ['Same Day', 0.03]]);
  const shipLag = shipMode === 'Same Day' ? (rand() < 0.5 ? 0 : 1) : shipMode === 'First Class' ? 1 + Math.floor(rand() * 2) : shipMode === 'Second Class' ? 2 + Math.floor(rand() * 3) : 3 + Math.floor(rand() * 5);
  const shipDate = new Date(date.getTime() + shipLag * 86400000);
  const returnProb = 0.052 + (category === 'Furniture' ? 0.022 : 0) + (discount >= 0.2 ? 0.028 : 0) + (category === 'Technology' ? 0.004 : 0);
  const returned = rand() < returnProb;
  const shippingCost = r2((shipMode === 'Same Day' ? 13.5 : shipMode === 'First Class' ? 9.25 : shipMode === 'Second Class' ? 5.75 : 3.4) * (0.72 + rand() * 0.62) + sales * 0.006);
  rows.push({
    date, shipDate, cust, product, category, subCategory, unitPrice, quantity, discount, sales, profit,
    shipMode, returned, shippingCost,
    priority: weightedPick([['Low', .26], ['Medium', .44], ['High', .22], ['Critical', .08]]),
    payment: weightedPick([['Credit Card', .34], ['Debit Card', .20], ['PayPal', .22], ['Bank Transfer', .14], ['Cash on Delivery', .10]]),
  });
}
rows.sort((a, b) => a.date - b.date);

// ---------- write CSV ----------
const HEADER = ['Order ID','Order Date','Ship Date','Ship Mode','Customer ID','Customer Name','Segment','Country','City','Region','Category','Sub-Category','Product ID','Product Name','Unit Price','Quantity','Discount','Sales','Profit','Payment Mode','Return Status','Order Priority','Shipping Cost','Customer Age','Customer Gender','Loyalty Tier'];
const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const lines = [HEADER.join(',')];
let revenue = 0, profitTot = 0;
rows.forEach((r, i) => {
  revenue += r.sales; profitTot += r.profit;
  const age = rand() < 0.011 ? '' : String(r.cust.age);
  const gender = rand() < 0.013 ? '' : r.cust.gender;
  const shipCost = rand() < 0.01 ? '' : money(r.shippingCost);
  lines.push([
    `RP-${String(100001 + i)}`,
    dateStr(r.date), dateStr(r.shipDate), r.shipMode,
    r.cust.id, esc(r.cust.name), r.cust.segment, esc(r.cust.country), esc(r.cust.city), r.cust.region,
    r.category, r.subCategory, r.product.id, esc(r.product.name),
    esc(money(r.unitPrice)), String(r.quantity), r.discount.toFixed(2),
    esc(money(r.sales)), esc(money(r.profit)),
    r.payment, r.returned ? 'Returned' : 'Not Returned', r.priority,
    esc(shipCost), age, gender, r.cust.loyaltyTier,
  ].join(','));
});
writeFileSync('public/uploads/RetailPulse_Cleaned_Dataset.csv', lines.join('\n'), 'utf8');
console.log('Rows written        :', rows.length);
console.log('Distinct customers  :', new Set(rows.map(r => r.cust.id)).size);
console.log('Distinct products   :', new Set(rows.map(r => r.product.id)).size);
console.log('Countries           :', new Set(rows.map(r => r.cust.country)).size);
console.log('Date range          :', dateStr(rows[0].date), '→', dateStr(rows[rows.length - 1].date));
console.log('Total revenue       : $' + revenue.toFixed(2));
console.log('Total profit        : $' + profitTot.toFixed(2));
console.log('Return rate         :', (rows.filter(r => r.returned).length / rows.length * 100).toFixed(2) + '%');
console.log('Catalog size        :', PRODUCTS.length);
