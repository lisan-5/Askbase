/**
 * The landing-page stage: a question types itself, its words are highlighted and mapped
 * to the columns they mean, the SQL writes itself, and the chart draws — then the next
 * question. Numbers are the real results from the Lumen Coffee Roasters sample data.
 */
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { highlightSql } from "./Sql";

type Bar = { label: string; value: number; value2?: number };
type Scene = {
  question: string;
  marks: { phrase: string; to: string }[];
  sql: string;
  title: string;
  insight: string;
  chart:
    | { kind: "hbar"; bars: Bar[] }
    | { kind: "pair"; bars: Bar[]; legend: [string, string] }
    | { kind: "line"; bars: Bar[] };
};

const SCENES: Scene[] = [
  {
    question: "Which products lost money last quarter?",
    marks: [
      { phrase: "products", to: "products.name" },
      { phrase: "lost money", to: "line_total − quantity × unit_cost" },
      { phrase: "last quarter", to: "orders.order_date ∈ Q3 2026" },
    ],
    sql: `SELECT p.name AS product,
  sum(oi.line_total * (1 - o.discount / o.subtotal)
      - oi.quantity * p.unit_cost) AS profit
FROM order_items oi
JOIN orders o USING (order_id)
JOIN products p USING (product_id)
WHERE o.status = 'paid'
  AND o.order_date >= DATE '2026-07-01'
GROUP BY 1 ORDER BY profit`,
    title: "Profit by product, Q3 2026",
    insight: "The Ember Grinder X sells below cost once its launch discount applies.",
    chart: {
      kind: "hbar",
      bars: [
        { label: "Ember Grinder X", value: -2657 },
        { label: "Gift Card $50", value: -200 },
        { label: "Canvas Tote", value: 1761 },
        { label: "Lumen Mug", value: 2832 },
        { label: "Pour-Over Kit", value: 7362 },
        { label: "Ethiopia Guji 250g", value: 12692 },
        { label: "Morning Light 1kg", value: 25166 },
      ],
    },
  },
  {
    question: "Is TikTok actually paying off this year?",
    marks: [
      { phrase: "TikTok", to: "orders.channel = 'tiktok'" },
      { phrase: "paying off", to: "revenue ÷ marketing_spend.spend" },
      { phrase: "this year", to: "2026" },
    ],
    sql: `WITH rev AS (
  SELECT channel, sum(total) AS revenue
  FROM orders WHERE status = 'paid'
    AND order_date >= DATE '2026-01-01'
  GROUP BY 1)
SELECT channel, revenue, sum(spend) AS spend,
       revenue / sum(spend) AS roas
FROM rev JOIN marketing_spend USING (channel)
GROUP BY 1, 2 ORDER BY roas DESC`,
    title: "Revenue vs ad spend, 2026",
    insight: "TikTok returns $1.89 per $1 spent — ahead of Google Ads at $1.44.",
    chart: {
      kind: "pair",
      legend: ["revenue", "spend"],
      bars: [
        { label: "TikTok", value: 104812, value2: 55421 },
        { label: "Google Ads", value: 103819, value2: 72228 },
        { label: "Instagram", value: 97278, value2: 42508 },
        { label: "Newsletter", value: 41352, value2: 4038 },
      ],
    },
  },
  {
    question: "Why did refunds spike in March?",
    marks: [
      { phrase: "refunds", to: "orders.status = 'refunded'" },
      { phrase: "spike", to: "refund rate by month" },
      { phrase: "March", to: "orders.order_date" },
    ],
    sql: `SELECT date_trunc('month', order_date) AS month,
  100.0 * count(*) FILTER (WHERE status = 'refunded')
        / count(*) AS refund_rate
FROM orders
WHERE order_date >= DATE '2025-09-01'
GROUP BY 1 ORDER BY 1`,
    title: "Refund rate by month",
    insight: "March 2026 hit 23% — ten times normal. Next: which products?",
    chart: {
      kind: "line",
      bars: [
        { label: "Sep", value: 2.5 },
        { label: "Oct", value: 2 },
        { label: "Nov", value: 2.5 },
        { label: "Dec", value: 1.6 },
        { label: "Jan", value: 3.2 },
        { label: "Feb", value: 1.7 },
        { label: "Mar", value: 23 },
        { label: "Apr", value: 2.8 },
        { label: "May", value: 1.4 },
        { label: "Jun", value: 1.5 },
      ],
    },
  },
];

// timeline (ms)
const T_TYPE = 1500;
const T_MARKS = 2600;
const T_SQL = 4400;
const T_END = 9200;

function useScene() {
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(T_END);
      return;
    }
    let raf = 0;
    let start = performance.now();
    const loop = (now: number) => {
      const e = now - start;
      if (e > T_END + 600) {
        start = now;
        setI((x) => (x + 1) % SCENES.length);
        setT(0);
      } else setT(e);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return {
    scene: SCENES[i],
    index: i,
    t,
    jump: (k: number) => {
      setI(k);
    },
  };
}

export function DemoStage() {
  const { scene, index, t, jump } = useScene();
  const typed = scene.question.slice(
    0,
    Math.floor((Math.min(t, T_TYPE) / T_TYPE) * scene.question.length),
  );
  const marksShown =
    t < T_TYPE
      ? 0
      : Math.min(
          scene.marks.length,
          Math.floor((t - T_TYPE) / ((T_MARKS - T_TYPE) / scene.marks.length)) + 1,
        );
  const sqlShown =
    t < T_MARKS
      ? ""
      : scene.sql.slice(
          0,
          Math.floor(Math.min(1, (t - T_MARKS) / (T_SQL - T_MARKS)) * scene.sql.length),
        );
  const chartOn = t >= T_SQL;

  // render the question with highlighter marks on the mapped phrases
  const parts: { text: string; mark: number }[] = [];
  let rest = typed;
  while (rest) {
    let best: { at: number; k: number; len: number } | null = null;
    scene.marks.forEach((m, k) => {
      const at = rest.indexOf(m.phrase);
      if (at >= 0 && (!best || at < best.at)) best = { at, k, len: m.phrase.length };
    });
    if (!best) {
      parts.push({ text: rest, mark: -1 });
      break;
    }
    const b = best as { at: number; k: number; len: number };
    if (b.at) parts.push({ text: rest.slice(0, b.at), mark: -1 });
    parts.push({ text: rest.slice(b.at, b.at + b.len), mark: b.k });
    rest = rest.slice(b.at + b.len);
  }

  return (
    <div className="relative">
      <div className="card relative overflow-hidden shadow-[0_40px_120px_-40px_rgba(14,15,19,0.35)]">
        {/* window chrome */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((d) => (
              <span key={d} className="size-2.5 rounded-full bg-line-strong" />
            ))}
          </div>
          <span className="font-mono text-[11px] text-muted">
            askbase · Lumen Coffee Roasters · 6 tables · 23,972 rows
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-cobalt">
            <Sparkles className="size-3" /> live demo
          </span>
        </div>

        <div className="p-5 sm:p-8">
          {/* the question */}
          <div className="flex items-center gap-3 rounded-2xl border border-line-strong bg-bg px-4 py-3.5 sm:px-5 sm:py-4">
            <p className="display min-h-[1.4em] flex-1 text-[22px] font-medium leading-snug sm:text-[30px]">
              {parts.map((p, k) =>
                p.mark >= 0 && p.mark < marksShown ? (
                  <span key={k} className="mark animate-mark">
                    {p.text}
                  </span>
                ) : (
                  <span key={k}>{p.text}</span>
                ),
              )}
              {t < T_TYPE + 300 && (
                <span className="ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[0.12em] animate-blink bg-cobalt" />
              )}
            </p>
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
                t >= T_TYPE ? "bg-cobalt text-cobalt-ink" : "bg-bg-2 text-muted",
              )}
            >
              <ArrowRight className="size-4" />
            </span>
          </div>

          {/* phrase → column mapping */}
          <div className="mt-4 flex min-h-[34px] flex-wrap gap-2">
            {scene.marks.slice(0, marksShown).map((m) => (
              <motion.span
                key={`${index}-${m.phrase}`}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-2 py-1 pl-1 pr-3 text-[12.5px]"
              >
                <span className="mark rounded-full px-2 py-0.5 text-[12px] font-medium">
                  {m.phrase}
                </span>
                <ArrowRight className="size-3 text-muted" />
                <span className="font-mono text-[11.5px] text-ink-2">{m.to}</span>
              </motion.span>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
            {/* SQL */}
            <div className="rounded-2xl border border-line bg-bg-2/70 p-4">
              <div className="eyebrow mb-2 flex items-center justify-between">
                <span>SQL · runs in your browser</span>
                {chartOn && <span className="text-mint">✓ ran locally</span>}
              </div>
              <pre className="min-h-[214px] whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-ink-2 sm:text-[12px]">
                <code>{highlightSql(sqlShown)}</code>
                {t >= T_MARKS && t < T_SQL && (
                  <span className="inline-block h-3.5 w-[2px] translate-y-0.5 animate-blink bg-cobalt" />
                )}
              </pre>
            </div>

            {/* chart */}
            <div className="rounded-2xl border border-line p-4">
              <AnimatePresence mode="wait">
                {chartOn ? (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <p className="display text-lg font-semibold">{scene.title}</p>
                    <div className="mt-3">
                      <StageChart scene={scene} />
                    </div>
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 }}
                      className="mt-3 text-[13.5px] leading-snug text-ink-2"
                    >
                      <span className="mark font-medium">{scene.insight}</span>
                    </motion.p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="wait"
                    exit={{ opacity: 0 }}
                    className="grid min-h-[250px] place-items-center"
                  >
                    <span className="font-mono text-[12px] text-muted">
                      {t < T_MARKS ? "mapping words to columns…" : "writing the query…"}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* scene picker */}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {SCENES.map((s, k) => (
          <button
            key={s.question}
            type="button"
            onClick={() => jump(k)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
              k === index
                ? "border-ink bg-ink text-bg"
                : "border-line-strong text-ink-2 hover:border-ink",
            )}
          >
            {s.question}
          </button>
        ))}
      </div>
    </div>
  );
}

const money = (n: number) =>
  Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;

function StageChart({ scene }: { scene: Scene }) {
  const c = scene.chart;
  if (c.kind === "hbar") {
    const max = Math.max(...c.bars.map((b) => Math.abs(b.value)));
    const neg = Math.max(...c.bars.map((b) => (b.value < 0 ? -b.value : 0)));
    const zero = (neg / (max + neg)) * 100;
    return (
      <ul className="space-y-1.5">
        {c.bars.map((b, k) => {
          const w = (Math.abs(b.value) / (max + neg)) * 100;
          return (
            <li
              key={b.label}
              className="grid grid-cols-[110px_1fr_52px] items-center gap-2 text-[11.5px] sm:grid-cols-[130px_1fr_56px]"
            >
              <span
                className={cn("truncate", b.value < 0 ? "font-medium text-coral" : "text-ink-2")}
              >
                {b.label}
              </span>
              <span className="relative h-4">
                <span
                  className="absolute inset-y-0 w-px bg-line-strong"
                  style={{ left: `${zero}%` }}
                />
                <motion.span
                  className={cn(
                    "absolute inset-y-0.5 rounded",
                    b.value < 0 ? "bg-coral" : "bg-cobalt",
                  )}
                  style={b.value < 0 ? { right: `${100 - zero}%` } : { left: `${zero}%` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${w}%` }}
                  transition={{ duration: 0.7, delay: k * 0.06, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
              <span className={cn("num text-right font-mono", b.value < 0 && "text-coral")}>
                {money(b.value)}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }
  if (c.kind === "pair") {
    const max = Math.max(...c.bars.map((b) => Math.max(b.value, b.value2 ?? 0)));
    return (
      <div>
        <div className="flex h-[170px] items-end gap-5 border-b border-line-strong px-2">
          {c.bars.map((b, k) => (
            <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-[150px] w-full items-end justify-center gap-1">
                <motion.span
                  className="w-1/2 max-w-[26px] rounded-t bg-cobalt"
                  initial={{ height: 0 }}
                  animate={{ height: `${(b.value / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: k * 0.08 }}
                />
                <motion.span
                  className="w-1/2 max-w-[26px] rounded-t bg-coral/80"
                  initial={{ height: 0 }}
                  animate={{ height: `${((b.value2 ?? 0) / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: k * 0.08 + 0.1 }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-5 px-2">
          {c.bars.map((b) => (
            <span key={b.label} className="flex-1 text-center text-[11px] text-ink-2">
              {b.label}
              <span className="block font-mono text-[10px] text-muted">
                ×{(b.value / (b.value2 ?? 1)).toFixed(2)}
              </span>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-4 font-mono text-[10.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-cobalt" /> {c.legend[0]}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-coral/80" /> {c.legend[1]}
          </span>
        </div>
      </div>
    );
  }
  const max = Math.max(...c.bars.map((b) => b.value)) * 1.1;
  const W = 360;
  const H = 160;
  const pts = c.bars.map(
    (b, k) => [(k / (c.bars.length - 1)) * W, H - (b.value / max) * H] as const,
  );
  const d = pts.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const peak = c.bars.reduce((m, b, k) => (b.value > c.bars[m].value ? k : m), 0);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 4}`} className="h-[170px] w-full overflow-visible">
        <motion.path
          d={`${d}L${W},${H}L0,${H}Z`}
          fill="var(--color-coral)"
          fillOpacity={0.1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        />
        <motion.path
          d={d}
          fill="none"
          stroke="var(--color-coral)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
        />
        <motion.g
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1 }}
          style={{ transformOrigin: `${pts[peak][0]}px ${pts[peak][1]}px` }}
        >
          <circle cx={pts[peak][0]} cy={pts[peak][1]} r={5} fill="var(--color-coral)" />
          <text
            x={pts[peak][0] + 9}
            y={pts[peak][1] + 4}
            className="fill-[var(--color-ink)] font-mono text-[11px]"
          >
            23%
          </text>
        </motion.g>
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--color-line-strong)" />
      </svg>
      <div className="flex justify-between font-mono text-[10px] text-muted">
        {c.bars.map((b) => (
          <span key={b.label}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}
