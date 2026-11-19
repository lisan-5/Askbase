/**
 * Lumen Coffee Roasters — a deterministic sample business (Jan 2025 → Oct 2026).
 *
 * Generated in the browser so the demo needs no files or servers. A few stories are
 * baked in for questions to discover:
 *  - the Ember Grinder X sells below cost once discounts apply (loses money),
 *  - TikTok grows from nothing into a top channel during 2026,
 *  - a roasting defect causes a refund spike in March 2026,
 *  - the Starter subscription plan churns much faster than the others.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START = Date.UTC(2025, 0, 1);
const END = Date.UTC(2026, 9, 31);
const DAY = 86_400_000;

const COUNTRIES: [string, string[], number][] = [
  ["United States", ["New York", "Austin", "Seattle", "Chicago", "Denver"], 0.38],
  ["United Kingdom", ["London", "Manchester", "Bristol"], 0.14],
  ["Germany", ["Berlin", "Munich", "Hamburg"], 0.12],
  ["Netherlands", ["Amsterdam", "Utrecht", "Rotterdam"], 0.08],
  ["Canada", ["Toronto", "Vancouver", "Montreal"], 0.1],
  ["Sweden", ["Stockholm", "Gothenburg", "Uppsala"], 0.06],
  ["France", ["Paris", "Lyon"], 0.07],
  ["Australia", ["Melbourne", "Sydney"], 0.05],
];
const CHANNELS = [
  "organic",
  "instagram",
  "google_ads",
  "referral",
  "tiktok",
  "newsletter",
] as const;
const FIRST = [
  "Ava",
  "Liam",
  "Mia",
  "Noah",
  "Emma",
  "Leo",
  "Sofia",
  "Elias",
  "Maja",
  "Jonas",
  "Chloe",
  "Omar",
  "Hana",
  "Lucas",
  "Zoe",
  "Arjun",
  "Ines",
  "Felix",
  "Nora",
  "Theo",
  "Lea",
  "Sam",
  "Ida",
  "Max",
  "Yara",
  "Ben",
  "Alba",
  "Kai",
  "Mila",
  "Hugo",
];
const LAST = [
  "Smith",
  "Berg",
  "Müller",
  "Jansen",
  "Brown",
  "Lund",
  "Martin",
  "Novak",
  "Rossi",
  "Kim",
  "Garcia",
  "Okafor",
  "Haile",
  "Schmidt",
  "Dubois",
  "Walker",
  "Nilsson",
  "Bakker",
  "Weber",
  "Clarke",
];

export const PRODUCTS = [
  {
    product_id: 1,
    name: "Morning Light Blend 1kg",
    category: "Coffee",
    unit_price: 32,
    unit_cost: 13.5,
  },
  {
    product_id: 2,
    name: "Ethiopia Guji Single Origin 250g",
    category: "Coffee",
    unit_price: 18,
    unit_cost: 7.2,
  },
  {
    product_id: 3,
    name: "Colombia Huila 250g",
    category: "Coffee",
    unit_price: 16,
    unit_cost: 6.4,
  },
  {
    product_id: 4,
    name: "Decaf Night Owl 250g",
    category: "Coffee",
    unit_price: 15,
    unit_cost: 6.1,
  },
  {
    product_id: 5,
    name: "Espresso Forte 1kg",
    category: "Coffee",
    unit_price: 34,
    unit_cost: 14.2,
  },
  {
    product_id: 6,
    name: "Cold Brew Concentrate 1L",
    category: "Coffee",
    unit_price: 14,
    unit_cost: 5.9,
  },
  {
    product_id: 7,
    name: "Ember Grinder X",
    category: "Equipment",
    unit_price: 189,
    unit_cost: 171,
  },
  { product_id: 8, name: "Pour-Over Kit", category: "Equipment", unit_price: 59, unit_cost: 24 },
  {
    product_id: 9,
    name: "Glass Carafe 600ml",
    category: "Equipment",
    unit_price: 29,
    unit_cost: 11,
  },
  { product_id: 10, name: "Lumen Mug", category: "Merch", unit_price: 22, unit_cost: 7.5 },
  { product_id: 11, name: "Canvas Tote", category: "Merch", unit_price: 18, unit_cost: 5 },
  { product_id: 12, name: "Gift Card $50", category: "Gift", unit_price: 50, unit_cost: 50 },
] as const;

const PLANS = [
  { plan: "Starter", mrr: 19, monthlyChurn: 0.11 },
  { plan: "Pro Roaster", mrr: 39, monthlyChurn: 0.035 },
  { plan: "Office", mrr: 129, monthlyChurn: 0.02 },
] as const;

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const money = (n: number) => Math.round(n * 100) / 100;

function pickWeighted<T>(r: () => number, items: readonly T[], weights: readonly number[]) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Channel mix shifts over time: TikTok takes off in 2026. */
function channelWeights(t: number) {
  const months = (t - START) / (30 * DAY);
  const tiktok = months < 12 ? 0.01 : Math.min(0.32, 0.02 + (months - 12) * 0.035);
  return [0.3, 0.2, 0.22, 0.12, tiktok, 0.08];
}

export interface DemoTables {
  customers: Record<string, string | number | null>[];
  products: Record<string, string | number | null>[];
  orders: Record<string, string | number | null>[];
  order_items: Record<string, string | number | null>[];
  subscriptions: Record<string, string | number | null>[];
  marketing_spend: Record<string, string | number | null>[];
}

export function generateDemo(seed = 20260214): DemoTables {
  const r = rng(seed);
  const customers: DemoTables["customers"] = [];
  const orders: DemoTables["orders"] = [];
  const items: DemoTables["order_items"] = [];
  const subs: DemoTables["subscriptions"] = [];

  // customers arrive over time, faster as the business grows
  let id = 1000;
  for (let t = START; t < END; t += DAY) {
    const growth = 1 + ((t - START) / (END - START)) * 1.6;
    const n = Math.floor(r() * 5 * growth);
    for (let k = 0; k < n; k++) {
      const [country, cities] = pickWeighted(
        r,
        COUNTRIES,
        COUNTRIES.map((c) => c[2]),
      );
      const first = FIRST[Math.floor(r() * FIRST.length)];
      const last = LAST[Math.floor(r() * LAST.length)];
      customers.push({
        customer_id: ++id,
        name: `${first} ${last}`,
        country,
        city: cities[Math.floor(r() * cities.length)],
        signup_date: iso(t + Math.floor(r() * DAY)),
        acquisition_channel: pickWeighted(r, CHANNELS, channelWeights(t)),
        segment: r() < 0.08 ? "wholesale" : "retail",
      });
    }
  }

  // orders: each customer orders a few times after signing up
  let orderId = 50_000;
  for (const c of customers) {
    const signup = Date.parse(c.signup_date as string);
    const wholesale = c.segment === "wholesale";
    const visits = 1 + Math.floor(r() ** 1.6 * (wholesale ? 14 : 7));
    let t = signup;
    for (let v = 0; v < visits && t < END; v++) {
      const date = t;
      t += Math.floor((10 + r() * 70) * DAY);
      const lines = 1 + Math.floor(r() * (wholesale ? 4 : 2.4));
      const chosen = new Set<number>();
      let subtotal = 0;
      const lineRows: DemoTables["order_items"] = [];
      for (let l = 0; l < lines; l++) {
        const p = pickWeighted(r, PRODUCTS, [9, 7, 6, 3, 6, 4, 1.4, 2.2, 2, 2.5, 1.6, 1]);
        if (chosen.has(p.product_id)) continue;
        chosen.add(p.product_id);
        const qty =
          wholesale && p.category === "Coffee"
            ? 4 + Math.floor(r() * 16)
            : 1 + Math.floor(r() ** 2 * 3);
        const line = money(qty * p.unit_price);
        subtotal += line;
        lineRows.push({
          order_id: orderId + 1,
          product_id: p.product_id,
          quantity: qty,
          unit_price: p.unit_price,
          line_total: line,
        });
      }
      if (!lineRows.length) continue;
      orderId++;
      // grinder orders are usually bundled with a launch discount
      const hasGrinder = chosen.has(7);
      const discountRate = hasGrinder ? 0.15 + r() * 0.1 : wholesale ? 0.12 : r() < 0.25 ? 0.1 : 0;
      const discount = money(subtotal * discountRate);
      const month = new Date(date).toISOString().slice(0, 7);
      const refundOdds = month === "2026-03" ? 0.19 : 0.025;
      const roll = r();
      const status =
        roll < refundOdds ? "refunded" : roll < refundOdds + 0.015 ? "cancelled" : "paid";
      const shipping = subtotal > 60 ? 0 : 6.5;
      orders.push({
        order_id: orderId,
        customer_id: c.customer_id,
        order_date: iso(date),
        status,
        channel: v === 0 ? c.acquisition_channel : pickWeighted(r, CHANNELS, channelWeights(date)),
        country: c.country,
        subtotal: money(subtotal),
        discount,
        shipping,
        total: money(subtotal - discount + shipping),
      });
      for (const row of lineRows) items.push({ ...row, order_id: orderId });
    }
  }

  // subscriptions with plan-specific churn
  let subId = 9000;
  for (const c of customers) {
    if (r() > 0.22) continue;
    const plan = c.segment === "wholesale" ? PLANS[2] : pickWeighted(r, PLANS, [0.55, 0.38, 0.07]);
    const start = Date.parse(c.signup_date as string) + Math.floor(r() * 20) * DAY;
    if (start > END) continue;
    let cancelled: number | null = null;
    for (let m = start + 30 * DAY; m < END; m += 30 * DAY) {
      if (r() < plan.monthlyChurn) {
        cancelled = m;
        break;
      }
    }
    subs.push({
      subscription_id: ++subId,
      customer_id: c.customer_id,
      plan: plan.plan,
      mrr: plan.mrr,
      started_at: iso(start),
      cancelled_at: cancelled ? iso(cancelled) : null,
      status: cancelled ? "cancelled" : "active",
    });
  }

  // marketing spend per channel per month
  const spend: DemoTables["marketing_spend"] = [];
  for (
    let t = START;
    t < END;
    t = Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth() + 1, 1)
  ) {
    const months = (t - START) / (30 * DAY);
    const plan: [string, number][] = [
      ["instagram", 3200 + months * 60],
      ["google_ads", 5200 + months * 110],
      ["tiktok", months < 12 ? 0 : 1500 + (months - 12) * 900],
      ["newsletter", 400],
    ];
    for (const [channel, base] of plan) {
      if (base <= 0) continue;
      spend.push({ month: iso(t), channel, spend: money(base * (0.9 + r() * 0.2)) });
    }
  }

  return {
    customers,
    products: PRODUCTS.map((p) => ({ ...p })),
    orders,
    order_items: items,
    subscriptions: subs,
    marketing_spend: spend,
  };
}

/** Minimal CSV writer (quotes only when needed). */
export function toCsv(rows: Record<string, string | number | null>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((row) => cols.map((c) => esc(row[c])).join(","))].join("\n");
}

export const DEMO_DESCRIPTIONS: Record<keyof DemoTables, string> = {
  customers: "One row per customer: where they are, when they signed up and how they found Lumen.",
  products: "The catalogue with list price and unit cost.",
  orders:
    "Every order. total = subtotal - discount + shipping. status is paid, refunded or cancelled.",
  order_items: "Line items: which products and how many were in each order.",
  subscriptions: "Coffee subscriptions with monthly recurring revenue (mrr) and cancellations.",
  marketing_spend: "Monthly ad spend per acquisition channel.",
};
