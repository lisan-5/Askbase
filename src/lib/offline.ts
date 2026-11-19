/**
 * The built-in question engine. When no AI key is configured (or the AI is unreachable),
 * Askbase still answers the common business questions about the sample company by
 * recognising intent + dimension + time window and composing the SQL itself.
 * It knows only the sample schema; anything else returns null.
 */
import type { Plan } from "./plan";

/** The sample data runs to the end of October 2026; "last quarter" is Q3 2026. */
const LAST_Q = { from: "2026-07-01", to: "2026-10-01", label: "Q3 2026" };
const THIS_YEAR = { from: "2026-01-01", to: "2027-01-01", label: "2026" };
const LAST_YEAR = { from: "2025-01-01", to: "2026-01-01", label: "2025" };

type Window = { from: string; to: string; label: string } | null;

function windowOf(q: string): Window {
  if (/last quarter|previous quarter|q3/.test(q)) return LAST_Q;
  if (/this year|2026|ytd/.test(q)) return THIS_YEAR;
  if (/last year|2025/.test(q)) return LAST_YEAR;
  return null;
}
const where = (w: Window, col = "o.order_date") =>
  w ? `AND ${col} >= DATE '${w.from}' AND ${col} < DATE '${w.to}'` : "";
const suffix = (w: Window) => (w ? `, ${w.label}` : "");

const NET = "o.status = 'paid'";

const CHANNEL_NAMES: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  google_ads: "Google Ads",
  organic: "organic search",
  referral: "referrals",
  newsletter: "the newsletter",
};

function plan(
  p: Omit<Plan, "assumptions" | "followups"> & Partial<Pick<Plan, "assumptions" | "followups">>,
): Plan {
  return {
    assumptions: p.assumptions ?? [],
    followups: p.followups ?? [],
    ...p,
  };
}

export function offlinePlan(question: string): Plan | null {
  const q = question.toLowerCase().replace(/[?!.]/g, " ");
  const w = windowOf(q);
  const has = (re: RegExp) => re.test(q);
  const top = Number(q.match(/top\s+(\d+)/)?.[1] ?? 10);

  // ── profit / losing products ──
  if (has(/lost money|losing money|unprofitable|loss|profit|margin/)) {
    const window = w ?? (has(/quarter/) ? LAST_Q : null);
    return plan({
      title: `Profit by product${suffix(window)}`,
      sql: `SELECT p.name AS product,
       round(sum(oi.line_total * (1 - o.discount / nullif(o.subtotal, 0)) - oi.quantity * p.unit_cost), 2) AS profit
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
JOIN products p ON p.product_id = oi.product_id
WHERE ${NET} ${where(window)}
GROUP BY p.name
ORDER BY profit ASC`,
      chart: { kind: "hbar", x: "product", y: ["profit"], format: "currency" },
      explanation:
        "Profit is each line's revenue after its share of the order discount, minus quantity × unit cost. Paid orders only; sorted so money-losers come first.",
      assumptions: [
        "Order-level discounts are spread across lines in proportion to their value.",
        "Shipping is excluded from product profit.",
      ],
      followups: [
        "Why is the Ember Grinder X losing money?",
        "What's the average discount on orders with a grinder?",
        "Profit by category by month",
      ],
    });
  }

  // ── refunds ──
  if (has(/refund/)) {
    return plan({
      title: `Refund rate by month${suffix(w)}`,
      sql: `SELECT date_trunc('month', o.order_date) AS month,
       round(100.0 * count(*) FILTER (WHERE o.status = 'refunded') / count(*), 2) AS refund_rate
FROM orders o
WHERE TRUE ${where(w)}
GROUP BY 1
ORDER BY 1`,
      chart: { kind: "line", x: "month", y: ["refund_rate"], format: "percent" },
      explanation: "Share of each month's orders that ended up refunded.",
      followups: [
        "Which products were refunded most in March 2026?",
        "Refunded revenue by month",
        "Refund rate by country",
      ],
    });
  }

  // ── subscriptions ──
  if (has(/mrr|recurring|subscri|churn|plan/)) {
    if (has(/churn/)) {
      return plan({
        title: "Churn by plan",
        sql: `SELECT plan,
       count(*) AS subscribers,
       round(100.0 * count(*) FILTER (WHERE status = 'cancelled') / count(*), 1) AS churned_pct
FROM subscriptions
GROUP BY plan
ORDER BY churned_pct DESC`,
        chart: { kind: "bar", x: "plan", y: ["churned_pct"], format: "percent" },
        explanation:
          "Share of all subscriptions ever started on each plan that have since cancelled.",
        followups: [
          "How long do Starter subscribers stay?",
          "MRR over time",
          "Churn by acquisition channel",
        ],
      });
    }
    if (has(/over time|by month|trend|growth|monthly/)) {
      return plan({
        title: "MRR at each month end",
        sql: `WITH months AS (
  SELECT unnest(generate_series(DATE '2025-01-31', DATE '2026-10-31', INTERVAL 1 MONTH))::DATE AS month_end
)
SELECT m.month_end AS month, sum(s.mrr) AS mrr
FROM months m
JOIN subscriptions s
  ON s.started_at <= m.month_end AND (s.cancelled_at IS NULL OR s.cancelled_at > m.month_end)
GROUP BY 1
ORDER BY 1`,
        chart: { kind: "area", x: "month", y: ["mrr"], format: "currency" },
        explanation:
          "Monthly recurring revenue from every subscription active on the last day of each month.",
        followups: ["MRR by plan", "Churn by plan", "New subscriptions per month"],
      });
    }
    return plan({
      title: "Active MRR by plan",
      sql: `SELECT plan, count(*) AS active_subscribers, sum(mrr) AS mrr
FROM subscriptions
WHERE status = 'active'
GROUP BY plan
ORDER BY mrr DESC`,
      chart: { kind: "bar", x: "plan", y: ["mrr"], format: "currency" },
      explanation: "Monthly recurring revenue from currently active subscriptions, by plan.",
      followups: ["MRR over time", "Churn by plan", "Which countries have the most subscribers?"],
    });
  }

  // ── marketing efficiency ──
  if (has(/roas|ad spend|marketing|spend|return on/)) {
    return plan({
      title: `Revenue vs ad spend by channel${suffix(w)}`,
      sql: `WITH rev AS (
  SELECT o.channel, sum(o.total) AS revenue
  FROM orders o
  WHERE ${NET} ${where(w)}
  GROUP BY 1
), spend AS (
  SELECT channel, sum(spend) AS spend
  FROM marketing_spend
  WHERE TRUE ${where(w, "month")}
  GROUP BY 1
)
SELECT rev.channel, round(rev.revenue, 0) AS revenue, round(spend.spend, 0) AS spend,
       round(rev.revenue / spend.spend, 2) AS roas
FROM rev JOIN spend USING (channel)
ORDER BY roas DESC`,
      chart: { kind: "bar", x: "channel", y: ["revenue", "spend"], format: "currency" },
      explanation:
        "Paid-order revenue attributed to each channel next to what was spent on it. ROAS = revenue ÷ spend.",
      assumptions: ["Revenue is attributed to the channel recorded on each order (last touch)."],
      followups: [
        "TikTok revenue by month",
        "New customers by acquisition channel",
        "Which channel brings the highest order value?",
      ],
    });
  }

  // ── customers ──
  if (has(/customer|signup|sign up|sign-up/) && !has(/revenue|sales/)) {
    if (has(/country|countries|where/)) {
      return plan({
        title: "Customers by country",
        sql: `SELECT country, count(*) AS customers FROM customers GROUP BY 1 ORDER BY 2 DESC`,
        chart: { kind: "bar", x: "country", y: ["customers"], format: "number" },
        explanation: "Every customer, grouped by country.",
        followups: [
          "Revenue by country",
          "Average order value by country",
          "Customers by acquisition channel",
        ],
      });
    }
    if (has(/channel|acquisition|source|found/)) {
      return plan({
        title: "New customers by acquisition channel, per month",
        sql: `SELECT date_trunc('month', signup_date) AS month,
       count(*) FILTER (WHERE acquisition_channel = 'organic') AS organic,
       count(*) FILTER (WHERE acquisition_channel = 'google_ads') AS google_ads,
       count(*) FILTER (WHERE acquisition_channel = 'instagram') AS instagram,
       count(*) FILTER (WHERE acquisition_channel = 'tiktok') AS tiktok
FROM customers
GROUP BY 1
ORDER BY 1`,
        chart: {
          kind: "line",
          x: "month",
          y: ["organic", "google_ads", "instagram", "tiktok"],
          format: "number",
        },
        explanation: "Sign-ups per month for the four largest acquisition channels.",
        followups: [
          "Revenue vs ad spend by channel",
          "TikTok revenue by month",
          "Customers by country",
        ],
      });
    }
    if (has(/how many|total|count/) && !has(/month|over time/)) {
      return plan({
        title: "Customers",
        sql: `SELECT count(*) AS customers FROM customers`,
        chart: { kind: "kpi", x: "", y: ["customers"], format: "number" },
        explanation: "Every customer record.",
        followups: [
          "New customers per month",
          "Customers by country",
          "Customers by acquisition channel",
        ],
      });
    }
    return plan({
      title: "New customers per month",
      sql: `SELECT date_trunc('month', signup_date) AS month, count(*) AS new_customers FROM customers GROUP BY 1 ORDER BY 1`,
      chart: { kind: "line", x: "month", y: ["new_customers"], format: "number" },
      explanation: "Customers by the month they signed up.",
      followups: ["Customers by acquisition channel", "Customers by country", "Revenue by month"],
    });
  }

  // ── average order value ──
  if (has(/average order|aov|basket/)) {
    const dim = has(/country/) ? "country" : "channel";
    return plan({
      title: `Average order value by ${dim}${suffix(w)}`,
      sql: `SELECT o.${dim}, round(avg(o.total), 2) AS avg_order_value, count(*) AS orders
FROM orders o
WHERE ${NET} ${where(w)}
GROUP BY 1
ORDER BY 2 DESC`,
      chart: { kind: "bar", x: dim, y: ["avg_order_value"], format: "currency" },
      explanation: "Mean total of paid orders.",
      followups: [
        "Revenue by channel",
        "Average order value by month",
        "Top 10 products by revenue",
      ],
    });
  }

  // ── top products ──
  if (has(/top|best|bestsell|most popular|products?/) && !has(/category|categories/)) {
    const units = has(/unit|quantity|sold/);
    return plan({
      title: `Top ${top} products by ${units ? "units sold" : "revenue"}${suffix(w)}`,
      sql: `SELECT p.name AS product, ${units ? "sum(oi.quantity) AS units" : "round(sum(oi.line_total), 0) AS revenue"}
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
JOIN products p ON p.product_id = oi.product_id
WHERE ${NET} ${where(w)}
GROUP BY 1
ORDER BY 2 DESC
LIMIT ${top}`,
      chart: {
        kind: "hbar",
        x: "product",
        y: [units ? "units" : "revenue"],
        format: units ? "number" : "currency",
      },
      explanation: units
        ? "Units across paid orders."
        : "Line revenue before order discounts, paid orders only.",
      followups: [
        "Which products lost money last quarter?",
        "Revenue by category",
        "Top products in Germany",
      ],
    });
  }

  // ── revenue / orders ──
  if (has(/revenue|sales|income|turnover|made|orders?|gmv/)) {
    const metric = has(/revenue|sales|income|turnover|made|gmv/)
      ? {
          expr: "round(sum(o.total), 0)",
          name: "revenue",
          fmt: "currency" as const,
          label: "Net revenue",
        }
      : { expr: "count(*)", name: "orders", fmt: "number" as const, label: "Orders" };
    const dims: [RegExp, string, string][] = [
      [/channel/, "o.channel", "channel"],
      [/country|countries|market/, "o.country", "country"],
    ];
    if (has(/categor/)) {
      return plan({
        title: `Revenue by category${suffix(w)}`,
        sql: `SELECT p.category, round(sum(oi.line_total), 0) AS revenue
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
JOIN products p ON p.product_id = oi.product_id
WHERE ${NET} ${where(w)}
GROUP BY 1
ORDER BY 2 DESC`,
        chart: { kind: "bar", x: "category", y: ["revenue"], format: "currency" },
        explanation: "Line revenue before order discounts, paid orders only.",
        followups: [
          "Which products lost money last quarter?",
          "Revenue by category by month",
          "Top 10 products by revenue",
        ],
      });
    }
    for (const [re, col, name] of dims) {
      if (has(re)) {
        const tiktokOnly = has(/tiktok/);
        return plan({
          title: `${metric.label} by ${name}${suffix(w)}`,
          sql: `SELECT ${col} AS ${name}, ${metric.expr} AS ${metric.name}
FROM orders o
WHERE ${NET} ${where(w)}${tiktokOnly ? " AND o.channel = 'tiktok'" : ""}
GROUP BY 1
ORDER BY 2 DESC`,
          chart: { kind: "bar", x: name, y: [metric.name], format: metric.fmt },
          explanation: `${metric.label} from paid orders, grouped by ${name}.`,
          followups: [
            `${metric.label} by month`,
            "Revenue vs ad spend by channel",
            "Average order value by country",
          ],
        });
      }
    }
    const channel = q
      .match(/\b(tiktok|instagram|google_ads|google ads|organic|referral|newsletter)\b/)?.[1]
      ?.replace(" ", "_");
    if (has(/month|over time|trend|growth|week|per|each/) || channel) {
      return plan({
        title: `${metric.label} by month${channel ? ` from ${CHANNEL_NAMES[channel] ?? channel}` : ""}${suffix(w)}`,
        sql: `SELECT date_trunc('month', o.order_date) AS month, ${metric.expr} AS ${metric.name}
FROM orders o
WHERE ${NET} ${where(w)}${channel ? ` AND o.channel = '${channel}'` : ""}
GROUP BY 1
ORDER BY 1`,
        chart: { kind: "area", x: "month", y: [metric.name], format: metric.fmt },
        explanation: `${metric.label} from paid orders, by calendar month (order total after discounts, including shipping).`,
        followups: [
          "Revenue by channel",
          "Refund rate by month",
          "Which products lost money last quarter?",
        ],
      });
    }
    return plan({
      title: `${metric.label}${suffix(w) || ", all time"}`,
      sql: `SELECT ${metric.expr} AS ${metric.name} FROM orders o WHERE ${NET} ${where(w)}`,
      chart: { kind: "kpi", x: "", y: [metric.name], format: metric.fmt },
      explanation: `${metric.label} from paid orders.`,
      followups: [
        `${metric.label} by month`,
        `${metric.label} by channel`,
        "Top 10 products by revenue",
      ],
    });
  }

  return null;
}

export const SAMPLE_QUESTIONS = [
  "Which products lost money last quarter?",
  "What was net revenue by month?",
  "Revenue vs ad spend by channel",
  "Refund rate by month",
  "Churn by plan",
  "TikTok revenue by month",
];

type Tbl = { name: string; columns: { name: string; type: string }[] };
const isNum = (t: string) => /INT|DOUBLE|DECIMAL|FLOAT|REAL|NUMERIC|HUGEINT/i.test(t);
const isDate = (t: string) => /DATE|TIMESTAMP/i.test(t);
const cap = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const q2 = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * Generic patterns for any table (used for uploaded files when no AI key is set):
 * preview, total by a column, a value over time, row counts.
 */
export function genericPlan(question: string, tables: Tbl[]): Plan | null {
  const q = question.toLowerCase();
  const t =
    tables.find((x) => q.includes(x.name.toLowerCase())) ??
    (tables.length === 1 ? tables[0] : undefined);
  if (!t) return null;
  const named = (c: { name: string }) => q.includes(c.name.toLowerCase());
  const nums = t.columns.filter((c) => isNum(c.type) && !/(^|_)id$/i.test(c.name));
  const num = nums.find(named) ?? nums[0];
  const date =
    t.columns.find((c) => isDate(c.type) && named(c)) ?? t.columns.find((c) => isDate(c.type));
  const by = t.columns.find((c) => !isNum(c.type) && q.includes(`by ${c.name.toLowerCase()}`));
  const T = q2(t.name);

  if (/what'?s in|preview|show me|sample|look like/.test(q)) {
    return plan({
      title: `A look at ${t.name}`,
      sql: `SELECT * FROM ${T} LIMIT 100`,
      chart: { kind: "table", x: "", y: [], format: "number" },
      explanation: `The first 100 rows of ${t.name}.`,
      followups: num && by ? [] : nums.length ? [`Total ${nums[0].name} in ${t.name}`] : [],
    });
  }
  if (date && num && /over time|by month|per month|monthly|trend|growth/.test(q)) {
    return plan({
      title: `${cap(num.name)} by month`,
      sql: `SELECT date_trunc('month', ${q2(date.name)}) AS month, sum(${q2(num.name)}) AS ${q2(num.name)}
FROM ${T}
GROUP BY 1
ORDER BY 1`,
      chart: { kind: "area", x: "month", y: [num.name], format: "number" },
      explanation: `Sum of ${num.name} per calendar month, by ${date.name}.`,
    });
  }
  if (by && num) {
    return plan({
      title: `${cap(num.name)} by ${by.name.replace(/_/g, " ")}`,
      sql: `SELECT ${q2(by.name)}, sum(${q2(num.name)}) AS ${q2(num.name)}
FROM ${T}
GROUP BY 1
ORDER BY 2 DESC
LIMIT 25`,
      chart: { kind: "bar", x: by.name, y: [num.name], format: "number" },
      explanation: `Sum of ${num.name} for each ${by.name}.`,
    });
  }
  if (/how many|count|number of/.test(q)) {
    return plan({
      title: `Rows in ${t.name}`,
      sql: `SELECT count(*) AS row_count FROM ${T}`,
      chart: { kind: "kpi", x: "", y: ["row_count"], format: "number" },
      explanation: `Every row in ${t.name}.`,
    });
  }
  if (num && /total|sum|overall/.test(q)) {
    return plan({
      title: `Total ${num.name.replace(/_/g, " ")}`,
      sql: `SELECT sum(${q2(num.name)}) AS ${q2(num.name)} FROM ${T}`,
      chart: { kind: "kpi", x: "", y: [num.name], format: "number" },
      explanation: `Sum of ${num.name} across all of ${t.name}.`,
    });
  }
  return null;
}
