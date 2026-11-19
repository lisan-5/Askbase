/**
 * Query, choreographed. A pinned scroll scene in which every order line item of the
 * sample company becomes a particle and the SQL physically happens:
 *   FROM → every row · JOIN → coloured by product · WHERE → only paid Q3 rows remain ·
 *   GROUP BY → twelve product clusters · SUM → profit bars · ORDER BY → sorted, losers first.
 * Positions for each stage are precomputed; scroll interpolates between them with a
 * per-particle stagger. Canvas 2D, pauses off-screen, jumps between stages for
 * reduced motion.
 */
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { generateDemo, PRODUCTS } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { Receipt } from "./Receipt";

const STAGES = [
  {
    key: "from",
    at: 0,
    clause: 0,
    label: "FROM order_items",
    note: "Every line item the shop ever sold.",
  },
  {
    key: "join",
    at: 0.12,
    clause: 1,
    label: "JOIN orders, products",
    note: "Each row learns its product, price and cost.",
  },
  {
    key: "where",
    at: 0.26,
    clause: 2,
    label: "WHERE paid AND Q3 2026",
    note: "Refunds, cancellations and other quarters fall away.",
  },
  { key: "group", at: 0.44, clause: 3, label: "GROUP BY product", note: "Rows gather by product." },
  {
    key: "sum",
    at: 0.6,
    clause: 4,
    label: "SUM(revenue − cost)",
    note: "Each cluster becomes its profit.",
  },
  { key: "order", at: 0.76, clause: 5, label: "ORDER BY profit", note: "Losers rise to the top." },
  { key: "done", at: 0.9, clause: 6, label: "Answer", note: "" },
] as const;

const SQL = [
  "SELECT p.name, sum(profit)",
  "FROM order_items oi",
  "JOIN orders o, products p",
  "WHERE status = 'paid' AND date IN Q3",
  "GROUP BY p.name",
  "  -- revenue − qty × unit_cost",
  "ORDER BY profit",
];
const SHORT = ["FROM", "JOIN", "WHERE", "GROUP BY", "SUM", "ORDER BY"];
// which SQL line each stage lights up
const CLAUSE_LINE = [1, 2, 3, 4, 5, 6, -1];

const CATEGORY_COLOR: Record<string, string> = {
  Coffee: "var(--ink)",
  Equipment: "var(--cobalt)",
  Merch: "var(--violet)",
  Gift: "var(--mint)",
};

interface Data {
  n: number;
  product: Uint8Array;
  keep: Uint8Array;
  groups: { id: number; name: string; category: string; profit: number; count: number }[];
}

function useData(): Data {
  return useMemo(() => {
    const demo = generateDemo();
    const orders = new Map(demo.orders.map((o) => [o.order_id as number, o]));
    const prod = new Map(PRODUCTS.map((p, i) => [p.product_id, { ...p, idx: i }]));
    const items = demo.order_items;
    const n = items.length;
    const product = new Uint8Array(n);
    const keep = new Uint8Array(n);
    const profit = new Float64Array(PRODUCTS.length);
    const count = new Uint32Array(PRODUCTS.length);
    items.forEach((it, i) => {
      const o = orders.get(it.order_id as number)!;
      const p = prod.get(it.product_id as 1)!;
      product[i] = p.idx;
      const date = String(o.order_date);
      const ok = o.status === "paid" && date >= "2026-07-01" && date < "2026-10-01";
      keep[i] = ok ? 1 : 0;
      if (ok) {
        const share = 1 - (o.discount as number) / ((o.subtotal as number) || 1);
        profit[p.idx] += (it.line_total as number) * share - (it.quantity as number) * p.unit_cost;
        count[p.idx]++;
      }
    });
    const groups = PRODUCTS.map((p, i) => ({
      id: i,
      name: p.name,
      category: p.category,
      profit: profit[i],
      count: count[i],
    }));
    return { n, product, keep, groups };
  }, []);
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

export function Choreography() {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const data = useData();
  const { scrollYProgress: p } = useScroll({ target: section, offset: ["start start", "end end"] });
  const [stage, setStage] = useState(0);
  const [whereProgress, setWhereProgress] = useState(0);
  useMotionValueEvent(p, "change", (v) => {
    let s = 0;
    STAGES.forEach((st, i) => v >= st.at && (s = i));
    setStage(s);
    // the counter drains as rows fall away during WHERE
    const w0 = STAGES[2].at;
    const w1 = STAGES[3].at;
    setWhereProgress(Math.min(1, Math.max(0, (v - w0) / (w1 - w0) / 0.8)));
  });

  const ordered = useMemo(() => [...data.groups].sort((a, b) => a.profit - b.profit), [data]);
  const kept = useMemo(() => data.keep.reduce((a, b) => a + b, 0), [data]);
  const rowsInFlight =
    stage <= 1
      ? data.n
      : stage === 2
        ? Math.round(data.n - (data.n - kept) * whereProgress)
        : data.groups.length;

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { n, product, keep, groups } = data;
    let w = 0;
    let h = 0;
    // positions per stage: FROM/JOIN grid, GROUP clusters, SUM bars (catalog order), ORDER bars (sorted)
    let grid = new Float32Array(n * 2);
    let cluster = new Float32Array(n * 2);
    let bars = new Float32Array(n * 2);
    let sorted = new Float32Array(n * 2);
    let size = 2;
    let labelX = 0;
    let zeroX = 0;
    let rowY: number[] = [];
    let rowYSorted: number[] = [];
    let scale = 1;

    const layout = () => {
      const r = c.getBoundingClientRect();
      w = r.width;
      h = r.height;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const narrow = w < 640;
      size = narrow ? 1.8 : 3.2;
      const gap = narrow ? 2.9 : 5;
      // grid
      const cols = Math.floor((w - 20) / gap);
      const rowsN = Math.ceil(n / cols);
      const gx = (w - cols * gap) / 2;
      const gy = Math.max(10, (h - rowsN * gap) / 2);
      grid = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        grid[i * 2] = gx + (i % cols) * gap;
        grid[i * 2 + 1] = gy + Math.floor(i / cols) * gap;
      }
      // rows for groups
      labelX = narrow ? 8 : 24;
      const labelW = narrow ? 112 : 210;
      const top = narrow ? 24 : 40;
      const rowH = (h - top * 2) / groups.length;
      rowY = groups.map((g) => top + g.id * rowH + rowH / 2);
      const rank = new Map(groups.map((g) => [g.id, 0]));
      [...groups].sort((a, b) => a.profit - b.profit).forEach((g, i) => rank.set(g.id, i));
      rowYSorted = groups.map((g) => top + rank.get(g.id)! * rowH + rowH / 2);
      const maxPos = Math.max(...groups.map((g) => Math.max(0, g.profit)));
      const maxNeg = Math.max(...groups.map((g) => Math.max(0, -g.profit)));
      // leave room on the right for the printed receipt on wide screens
      const avail = w - labelX - labelW - (narrow ? 50 : w > 900 ? 390 : 110);
      scale = avail / (maxPos + maxNeg || 1);
      zeroX = labelX + labelW + maxNeg * scale;
      const lanes = narrow ? 5 : 6;
      const counters = new Uint32Array(groups.length);
      cluster = new Float32Array(n * 2);
      bars = new Float32Array(n * 2);
      sorted = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const g = groups[product[i]];
        if (!keep[i]) {
          // dropped rows keep falling off the bottom
          cluster[i * 2] = grid[i * 2];
          cluster[i * 2 + 1] = h + 40 + (i % 50);
          bars[i * 2] = cluster[i * 2];
          bars[i * 2 + 1] = cluster[i * 2 + 1];
          sorted[i * 2] = cluster[i * 2];
          sorted[i * 2 + 1] = cluster[i * 2 + 1];
          continue;
        }
        const k = counters[g.id]++;
        const lane = k % lanes;
        const col = Math.floor(k / lanes);
        // cluster: compact block right of the zero line
        cluster[i * 2] = zeroX + col * gap;
        cluster[i * 2 + 1] = rowY[g.id] - ((lanes - 1) * gap) / 2 + lane * gap;
        // bar: spread the block to its profit length (left for losses)
        const colsInGroup = Math.max(1, Math.ceil(g.count / lanes));
        const len = Math.abs(g.profit) * scale;
        const step = colsInGroup > 1 ? len / (colsInGroup - 1) : 0;
        const bx = g.profit >= 0 ? zeroX + col * step : zeroX - col * step;
        bars[i * 2] = bx;
        bars[i * 2 + 1] = cluster[i * 2 + 1];
        sorted[i * 2] = bx;
        sorted[i * 2 + 1] = rowYSorted[g.id] - ((lanes - 1) * gap) / 2 + lane * gap;
      }
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(c);

    const css = () => {
      const s = getComputedStyle(document.documentElement);
      const v = (k: string) => s.getPropertyValue(k).trim();
      return {
        ink: v("--ink"),
        cobalt: v("--cobalt"),
        violet: v("--violet"),
        mint: v("--mint"),
        coral: v("--coral"),
        muted: v("--muted"),
        line: v("--line-strong"),
        mark: v("--mark"),
      };
    };
    let col = css();
    const mo = new MutationObserver(() => (col = css()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const catColor = (cat: string) =>
      cat === "Coffee"
        ? col.ink
        : cat === "Equipment"
          ? col.cobalt
          : cat === "Merch"
            ? col.violet
            : col.mint;

    const fmt = (v: number) =>
      `${v < 0 ? "−" : ""}$${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}k` : Math.round(Math.abs(v))}`;

    let raf = 0;
    let running = false;
    const frame = () => {
      const v = p.get();
      let s = 0;
      STAGES.forEach((st, i) => v >= st.at && (s = i));
      const next = STAGES[Math.min(s + 1, STAGES.length - 1)];
      const span = Math.max(0.0001, next.at - STAGES[s].at);
      const local = reduced ? 1 : Math.min(1, (v - STAGES[s].at) / span);

      ctx.clearRect(0, 0, w, h);
      // each clause moves the particles from one layout to the next
      const key = STAGES[s].key;
      const [A, B] =
        key === "group"
          ? [grid, cluster]
          : key === "sum"
            ? [cluster, bars]
            : key === "order"
              ? [bars, sorted]
              : key === "done"
                ? [sorted, sorted]
                : [grid, grid];
      const afterWhere = key === "group" || key === "sum" || key === "order" || key === "done";

      for (let i = 0; i < n; i++) {
        const g = groups[product[i]];
        const stagger = (i / n) * 0.35;
        const k = ease(Math.min(1, Math.max(0, (local - stagger) / 0.65)));
        let x = A[i * 2] + (B[i * 2] - A[i * 2]) * k;
        let y = A[i * 2 + 1] + (B[i * 2 + 1] - A[i * 2 + 1]) * k;
        let alpha = 1;
        if (!keep[i]) {
          if (afterWhere) continue;
          if (key === "where") {
            // rows that don't match fall away and fade
            const fall = ease(Math.min(1, Math.max(0, local * 1.5 - stagger)));
            x = grid[i * 2];
            y = grid[i * 2 + 1] + fall * fall * h * 0.9;
            alpha = 1 - fall;
          }
        }
        if (alpha <= 0.02 || y > h + 10) continue;
        // JOIN: colour sweeps across the rows
        const coloured = key === "from" ? false : key === "join" ? local > stagger * 1.6 : true;
        const negative = g.profit < 0 && (key === "sum" || key === "order" || key === "done");
        ctx.globalAlpha = alpha * (coloured ? 0.9 : 0.4);
        ctx.fillStyle = negative ? col.coral : coloured ? catColor(g.category) : col.muted;
        ctx.fillRect(x, y, size, size);
      }
      ctx.globalAlpha = 1;

      // labels once rows have gathered
      const labelsOn = key === "group" || key === "sum" || key === "order" || key === "done";
      if (labelsOn) {
        const la = key === "group" ? local : 1;
        const narrow = w < 640;
        ctx.font = `${narrow ? 10 : 12}px "Inter Tight", system-ui, sans-serif`;
        ctx.textBaseline = "middle";
        for (const g of groups) {
          const ys =
            key === "order"
              ? rowY[g.id] + (rowYSorted[g.id] - rowY[g.id]) * ease(Math.min(1, local / 0.8))
              : key === "done"
                ? rowYSorted[g.id]
                : rowY[g.id];
          ctx.globalAlpha = la;
          ctx.fillStyle = g.profit < 0 && key !== "group" ? col.coral : col.ink;
          const name = narrow
            ? g.name.replace(/ (Single Origin|Concentrate|Blend)/, "").slice(0, 16)
            : g.name;
          ctx.fillText(name, labelX, ys);
          if (key !== "group") {
            const vk = key === "sum" ? ease(local) : 1;
            const endX = g.profit >= 0 ? zeroX + g.profit * scale * vk + 8 : zeroX + 8;
            ctx.fillStyle = g.profit < 0 ? col.coral : col.muted;
            ctx.font = `${narrow ? 9.5 : 11}px "Fragment Mono", monospace`;
            ctx.fillText(fmt(g.profit * vk), endX, ys);
            ctx.font = `${narrow ? 10 : 12}px "Inter Tight", system-ui, sans-serif`;
          }
        }
        // zero line
        ctx.globalAlpha = la * 0.6;
        ctx.fillStyle = col.line;
        ctx.fillRect(zeroX - 1, 14, 1, h - 28);
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
    io.observe(c);
    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
    };
  }, [data, p]);

  const st = STAGES[stage];
  const ember = ordered[0];

  return (
    <section
      ref={section}
      id="choreography"
      aria-label="Watch a query run"
      className="relative h-[640vh]"
    >
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden pt-16">
        <div className="mx-auto grid w-full max-w-[1400px] flex-1 grid-rows-[auto_1fr] gap-4 px-4 pb-6 pt-4 sm:px-8 lg:grid-cols-[360px_1fr] lg:grid-rows-1 lg:gap-8">
          {/* the query, clause by clause */}
          <div className="flex flex-col justify-center">
            <p className="eyebrow">Watch a query run · on real rows</p>
            <h2 className="display mt-2 text-[clamp(1.6rem,3vw,2.5rem)] font-semibold leading-[1.05]">
              “Which products <span className="mark">lost money</span> last quarter?”
            </h2>
            <pre className="mt-4 hidden rounded-2xl border border-line bg-card p-4 font-mono text-[12px] leading-[1.9] sm:block">
              {SQL.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    "transition-colors duration-300",
                    CLAUSE_LINE[stage] === i
                      ? "mark text-[#0e0f13]"
                      : stage >= 6 || i < CLAUSE_LINE[stage] || i === 0
                        ? "text-ink"
                        : "text-muted/50",
                  )}
                >
                  {line}
                </div>
              ))}
            </pre>
            <div className="mt-4 flex items-baseline gap-4">
              <div>
                <p className="eyebrow">{stage >= 3 ? "groups" : "rows in flight"}</p>
                <p className="display num text-4xl font-semibold tabular-nums">
                  {rowsInFlight.toLocaleString()}
                </p>
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[12px] text-cobalt">{st.label}</p>
                <p className="text-[13.5px] text-ink-2">
                  {st.note || "Printed below — with the SQL that proves it."}
                </p>
              </div>
            </div>
            <div className="mt-3 hidden gap-3 font-mono text-[10.5px] text-muted sm:flex">
              {Object.entries(CATEGORY_COLOR).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="size-2" style={{ background: v }} /> {k.toLowerCase()}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="size-2 bg-coral" /> loss
              </span>
            </div>
          </div>

          {/* the particles */}
          <div className="relative min-h-0">
            <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
            <motion.div
              className="absolute bottom-4 right-4 hidden w-[280px] sm:block"
              initial={false}
              animate={stage >= 6 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {stage >= 6 && (
                <Receipt
                  printing
                  compact
                  question="Which products lost money last quarter?"
                  lines={ordered.slice(0, 4).map((g) => ({ label: g.name, value: g.profit }))}
                  footer={[
                    ["rows scanned", data.n.toLocaleString()],
                    ["rows sent to ai", "0"],
                  ]}
                  note={`${ember.name} lost $${Math.abs(Math.round(ember.profit)).toLocaleString()}.`}
                />
              )}
            </motion.div>
          </div>
        </div>
        {/* progress through the clauses */}
        <div className="mx-auto mb-4 flex w-full max-w-[1400px] gap-1 px-4 sm:px-8">
          {STAGES.slice(0, 6).map((s, i) => (
            <div key={s.key} className="flex-1">
              <div
                className={cn(
                  "h-1 rounded-full transition-colors",
                  i <= stage ? "bg-ink" : "bg-line-strong",
                )}
              />
              <p
                className={cn(
                  "mt-1 hidden font-mono text-[10px] uppercase sm:block",
                  i === stage ? "text-ink" : "text-muted",
                )}
              >
                {SHORT[i]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
