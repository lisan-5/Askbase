import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useInView } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUpRight, Github, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Choreography } from "@/components/landing/Choreography";
import { Receipt } from "@/components/landing/Receipt";
import { Wall } from "@/components/landing/Wall";
import { Wordmark } from "@/components/Wordmark";
import { generateDemo } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Landing,
});

const EASE = [0.16, 1, 0.3, 1] as const;
const wrap = "mx-auto w-full max-w-[1240px] px-5 sm:px-8";

/** All landing numbers come from the same sample data the app loads. */
function useFacts() {
  return useMemo(() => {
    const d = generateDemo();
    const lines = d.orders
      .filter((_, i) => i % 19 === 0)
      .map((o) =>
        [o.order_id, o.order_date, o.status, o.channel, o.country, Number(o.total).toFixed(2)].join(
          ",",
        ),
      );
    const orderText = d.orders.map((o) =>
      `${o.order_id},${o.order_date},${o.status},${o.channel},${o.country},${o.total}`.toLowerCase(),
    );

    const y26 = (s: string) => s >= "2026-01-01";
    const rev: Record<string, number> = {};
    for (const o of d.orders)
      if (o.status === "paid" && y26(String(o.order_date)))
        rev[o.channel as string] = (rev[o.channel as string] ?? 0) + Number(o.total);
    const spend: Record<string, number> = {};
    for (const s of d.marketing_spend)
      if (y26(String(s.month)))
        spend[s.channel as string] = (spend[s.channel as string] ?? 0) + Number(s.spend);
    const roas = Object.keys(spend)
      .map((c) => ({ channel: c, roas: (rev[c] ?? 0) / spend[c] }))
      .sort((a, b) => b.roas - a.roas);

    const months: Record<string, [number, number]> = {};
    for (const o of d.orders) {
      const m = String(o.order_date).slice(0, 7);
      if (m < "2025-12" || m > "2026-05") continue;
      months[m] ??= [0, 0];
      months[m][1]++;
      if (o.status === "refunded") months[m][0]++;
    }
    const refunds = Object.keys(months)
      .sort()
      .map((m) => ({ month: m, rate: (100 * months[m][0]) / months[m][1] }));

    const columns = Object.values(d).reduce((n, rows) => n + Object.keys(rows[0] ?? {}).length, 0);
    const rows = Object.values(d).reduce((n, r) => n + r.length, 0);
    return {
      lines,
      orderText,
      roas,
      refunds,
      columns,
      rows,
      items: d.order_items.length,
      tables: Object.keys(d).length,
    };
  }, []);
}

function Marked({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  return (
    <span ref={ref} className={cn("mark", seen ? "animate-mark" : "[background-size:0%_72%]")}>
      {children}
    </span>
  );
}

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function Landing() {
  const facts = useFacts();
  return (
    <div className="min-h-screen overflow-x-clip bg-bg">
      <Nav />
      <Hero facts={facts} />
      <Choreography />
      <Receipts facts={facts} />
      <Keys />
      <Privacy facts={facts} />
      <Tape />
      <FinalCta />
      <Footer />
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  return (
    <button
      type="button"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("askbase.theme", next ? "dark" : "light");
        } catch {
          /* ignore */
        }
      }}
      className="grid size-9 place-items-center rounded-full border border-line-strong transition-colors hover:border-ink"
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className={cn(wrap, "flex h-16 items-center gap-6")}>
        <Link to="/" aria-label="Askbase">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-6 text-[14px] text-ink-2 md:flex">
          <a href="#choreography" className="hover:text-ink">
            Watch a query
          </a>
          <a href="#receipts" className="hover:text-ink">
            Receipts
          </a>
          <a href="#privacy" className="hover:text-ink">
            Privacy
          </a>
          <a
            href="https://github.com/lisan-5/Askbase"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-ink"
          >
            GitHub <ArrowUpRight className="size-3.5" />
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-bg transition-transform hover:-translate-y-0.5"
          >
            Open Askbase <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ facts }: { facts: ReturnType<typeof useFacts> }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const wallState = useRef({ filter: "" }).current;
  const input = useRef<HTMLInputElement>(null);
  const word = q.trim().toLowerCase();
  const matching = useMemo(
    () =>
      word.length >= 2
        ? facts.orderText.reduce((n, line) => n + (line.includes(word) ? 1 : 0), 0)
        : -1,
    [word, facts.orderText],
  );

  useEffect(() => {
    wallState.filter = q;
  }, [q, wallState]);

  // "/" focuses the question from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && t.tagName !== "INPUT" && t.tagName !== "TEXTAREA") {
        e.preventDefault();
        input.current?.focus();
        input.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden pt-16">
      <Wall
        lines={facts.lines}
        state={wallState}
        className="absolute inset-0 -z-10 h-full w-full"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_50%_at_50%_50%,var(--color-bg)_35%,transparent_100%)]"
      />

      <div className={cn(wrap, "relative text-center")}>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="font-mono text-[12px] text-muted"
        >
          behind this: real order rows from a sample coffee shop · move your cursor across them
        </motion.p>
        <h1 className="display mx-auto mt-5 max-w-5xl text-[clamp(3rem,8.6vw,7.6rem)] font-semibold leading-[0.93]">
          <motion.span
            className="block"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
          >
            Ask your business
          </motion.span>
          <motion.span
            className="block"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.22 }}
          >
            <span className="mark animate-mark [animation-delay:900ms]">anything.</span>
          </motion.span>
        </h1>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.5 }}
          onSubmit={(e) => {
            e.preventDefault();
            navigate({
              to: "/app",
              search: { q: q.trim() || "Which products lost money last quarter?" },
            });
          }}
          className="mx-auto mt-10 max-w-2xl"
        >
          <div className="flex items-center gap-2 rounded-full border border-line-strong bg-card p-2 pl-6 shadow-[0_24px_60px_-30px_rgba(14,15,19,.45)] transition-colors focus-within:border-cobalt">
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type a word — try “tiktok” or “refunded”"
              className="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none placeholder:text-muted"
              aria-label="Filter the rows, or ask a question"
            />
            <span className="kbd hidden rounded border border-line-strong px-1.5 font-mono text-[11px] text-muted sm:inline">
              /
            </span>
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-cobalt px-5 py-3 text-[14px] font-medium text-cobalt-ink"
            >
              Ask <ArrowRight className="size-4" />
            </button>
          </div>
          <p className="mt-3 h-5 font-mono text-[12px] text-muted" aria-live="polite">
            {matching >= 0 ? (
              <>
                <span className="mark">WHERE row LIKE '%{word}%'</span> →{" "}
                {matching.toLocaleString()} of {facts.orderText.length.toLocaleString()} orders
                match
              </>
            ) : (
              "Every keystroke filters the rows above — that's a WHERE clause. Press Ask to get a real answer."
            )}
          </p>
        </motion.form>
      </div>

      <a
        href="#choreography"
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap font-mono text-[12px] text-muted hover:text-ink"
      >
        <ArrowDown className="size-3.5 animate-bounce" /> scroll
        <span className="hidden sm:inline">
          to watch one question run through {facts.items.toLocaleString()} rows
        </span>
        <span className="sm:hidden">to watch a query run</span>
      </a>
    </section>
  );
}

function Receipts({ facts }: { facts: ReturnType<typeof useFacts> }) {
  const tik = facts.roas.find((r) => r.channel === "tiktok");
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const peak = facts.refunds.reduce((m, r) => (r.rate > m.rate ? r : m), facts.refunds[0]);
  const label = (m: string) =>
    new Date(`${m}-01T00:00:00Z`)
      .toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
      .toUpperCase();
  return (
    <section id="receipts" className="scroll-mt-16 border-y border-line bg-bg-2/60 py-24 sm:py-32">
      <div className={wrap}>
        <Reveal className="max-w-3xl">
          <p className="eyebrow">Every answer prints a receipt</p>
          <h2 className="display mt-3 text-[clamp(2.4rem,5vw,4.2rem)] font-semibold leading-[1]">
            Itemised, with the <Marked>SQL on it</Marked>. Keep it, check it, tear it off.
          </h2>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
            AI that guesses at numbers is worse than no AI. Askbase writes a real query, runs it on
            your data and hands you the receipt — every line traceable to the rows behind it.
          </p>
        </Reveal>
        <div ref={ref} className="mt-16 grid items-start gap-10 md:grid-cols-3">
          {seen && (
            <>
              <div className="group/receipt">
                <Receipt
                  printing
                  tearable
                  question="Is TikTok actually paying off this year?"
                  lines={facts.roas.map((r) => ({
                    label: `${r.channel.replace("_", " ")} · per $1`,
                    value: r.roas,
                    unit: "ratio",
                  }))}
                  sql={[
                    "SELECT channel,",
                    "  revenue / spend AS roas",
                    "FROM orders JOIN marketing_spend",
                    "WHERE year = 2026",
                  ]}
                  footer={[
                    ["rows scanned", "7,656"],
                    ["rows sent to ai", "0"],
                  ]}
                  note={tik ? `TikTok returns $${tik.roas.toFixed(2)} per $1.` : undefined}
                />
              </div>
              <div className="group/receipt md:mt-16">
                <Receipt
                  printing
                  tearable
                  question="Why did refunds spike in March?"
                  lines={facts.refunds.map((r) => ({
                    label: label(r.month),
                    value: r.rate,
                    unit: "percent",
                  }))}
                  sql={[
                    "SELECT month,",
                    "  refunded / orders AS rate",
                    "FROM orders",
                    "GROUP BY month",
                  ]}
                  footer={[
                    ["rows scanned", facts.orderText.length.toLocaleString()],
                    ["rows sent to ai", "0"],
                  ]}
                  note={`${label(peak.month)} hit ${peak.rate.toFixed(0)}% — ten times normal.`}
                />
              </div>
              <div className="group/receipt md:mt-6">
                <Receipt
                  printing
                  tearable
                  title="ASKBASE · RECEIPT POLICY"
                  question="What's on every receipt?"
                  lines={[]}
                >
                  <ul className="space-y-1 uppercase leading-snug">
                    {[
                      ["the exact sql", "✓"],
                      ["assumptions made", "✓"],
                      ["rows it scanned", "✓"],
                      ["ms it took, locally", "✓"],
                      ["3 next questions", "✓"],
                      ["made-up numbers", "0"],
                      ["writes to your data", "0"],
                    ].map(([k, v]) => (
                      <li key={k} className="flex justify-between gap-2">
                        <span>{k}</span>
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                </Receipt>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const KEYS = [
  {
    key: "DROP",
    title: "Drop your exports",
    body: "CSV from Stripe, Shopify, Sheets, your POS or CRM. It loads into a real analytics database — in the tab.",
  },
  {
    key: "ASK",
    title: "Ask like you'd ask a person",
    body: "“Who are my best customers?” “Did the March promo work?” No SQL, no pivot tables, no waiting.",
  },
  {
    key: "CHECK",
    title: "Check the receipt",
    body: "The chart, the exact query, its assumptions and what to ask next. If a query fails, it reads the error and fixes itself.",
  },
];

function Keys() {
  return (
    <section className={cn(wrap, "py-24 sm:py-32")}>
      <Reveal className="max-w-3xl">
        <p className="eyebrow">Three keys</p>
        <h2 className="display mt-3 text-[clamp(2.4rem,5vw,4.2rem)] font-semibold leading-[1]">
          Simpler than the till. <Marked>Smarter than the spreadsheet.</Marked>
        </h2>
      </Reveal>
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {KEYS.map((k, i) => (
          <Reveal key={k.key} delay={i * 0.1}>
            <div className="group">
              <div className="relative h-24 select-none">
                <div className="absolute inset-x-0 bottom-0 h-20 rounded-2xl bg-ink-2/80" />
                <div className="display absolute inset-x-0 top-0 grid h-20 place-items-center rounded-2xl border border-line-strong bg-card text-3xl font-bold tracking-tight shadow-[inset_0_-6px_0_var(--color-bg-2)] transition-transform duration-150 group-hover:translate-y-2 group-active:translate-y-3">
                  {k.key}
                </div>
              </div>
              <h3 className="display mt-7 text-2xl font-semibold">
                <span className="mr-2 font-mono text-[13px] text-muted">0{i + 1}</span>
                {k.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{k.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Privacy({ facts }: { facts: ReturnType<typeof useFacts> }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  return (
    <section id="privacy" className="scroll-mt-16 bg-ink py-24 text-bg sm:py-32">
      <div className={cn(wrap, "grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]")}>
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-bg/60">
            Privacy, itemised
          </p>
          <h2 className="display mt-3 text-[clamp(2.4rem,5.4vw,4.6rem)] font-semibold leading-[1]">
            Your rows <span className="mark">never leave</span> your browser.
          </h2>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-bg/75">
            Askbase runs DuckDB — a full analytics database — compiled to WebAssembly, inside your
            tab. Your files are never uploaded. To write a query, the AI gets your question and your
            column names. Here is the receipt for everything that leaves.
          </p>
        </Reveal>
        <div ref={ref} className="mx-auto w-full max-w-[360px]">
          {seen && (
            <Receipt
              printing
              title="OUTBOUND · TO THE AI"
              question="What left your browser?"
              lines={[]}
            >
              <ul className="space-y-1 uppercase">
                {[
                  ["your question", "1"],
                  ["table names", String(facts.tables)],
                  ["column names", String(facts.columns)],
                  ["example values / col", "≤4"],
                  ["rows", "0"],
                  ["files", "0"],
                  ["totals or results", "0"],
                ].map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span>{k}</span>
                    <span className="num">{v}</span>
                  </li>
                ))}
              </ul>
              <div className="receipt-rule my-3" />
              <p className="flex justify-between font-semibold uppercase">
                <span>rows kept on your machine</span>
                <span className="num">{facts.rows.toLocaleString()}</span>
              </p>
            </Receipt>
          )}
        </div>
      </div>
    </section>
  );
}

const TAPE = [
  "Who are my top 20 customers this year?",
  "Which products lost money last quarter?",
  "Refund rate by month",
  "Did the spring sale actually work?",
  "Which country is growing fastest?",
  "MRR by plan",
  "Which plan churns fastest?",
  "Revenue vs ad spend by channel",
  "Average order value by country",
  "TikTok revenue by month",
];

function Tape() {
  return (
    <section aria-label="Questions people ask" className="overflow-hidden py-20">
      <p className={cn(wrap, "eyebrow mb-6")}>Questions people ask · click one</p>
      {[0, 1].map((r) => (
        <div
          key={r}
          className="group mb-3 flex overflow-hidden border-y border-dashed border-line-strong bg-[#fdfcf8] text-[#1b1b1f] dark:bg-[#f2efe6]"
        >
          <div
            className="flex w-max gap-10 py-3 font-mono text-[13px] uppercase [animation:tape_var(--d)_linear_infinite] group-hover:[animation-play-state:paused]"
            style={{
              ["--d" as string]: `${60 + r * 15}s`,
              animationDirection: r ? "reverse" : "normal",
            }}
          >
            {[...TAPE, ...TAPE, ...TAPE].map((q, i) => (
              <Link key={i} to="/app" search={{ q }} className="shrink-0 hover:underline">
                ✕ {q}
              </Link>
            ))}
          </div>
        </div>
      ))}
      <style>{`@keyframes tape { from { transform: translateX(0) } to { transform: translateX(-33.333%) } }`}</style>
    </section>
  );
}

function FinalCta() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <section className={cn(wrap, "pb-24 pt-8 sm:pb-32")}>
      <Reveal className="relative overflow-hidden rounded-[32px] bg-cobalt px-6 py-16 text-center text-cobalt-ink sm:px-12 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:22px_22px]"
        />
        <h2 className="display relative mx-auto max-w-3xl text-[clamp(2.4rem,5.6vw,4.8rem)] font-semibold leading-[0.98]">
          What do you want to <span className="mark">know</span>?
        </h2>
        <p className="relative mx-auto mt-5 max-w-xl text-[17px] opacity-85">
          Ask the sample coffee shop anything. No sign-up, no upload.
        </p>
        <form
          className="relative mx-auto mt-10 flex max-w-2xl items-center gap-2 rounded-full bg-card p-2 pl-6 text-ink shadow-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({
              to: "/app",
              search: { q: q.trim() || "Which products lost money last quarter?" },
            });
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Which products lost money last quarter?"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
            aria-label="Your question"
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-5 py-3 text-[14px] font-medium text-bg"
          >
            Print answer <ArrowRight className="size-4" />
          </button>
        </form>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div
        className="h-3 bg-[length:14px_12px] bg-repeat-x [background-image:linear-gradient(135deg,var(--color-bg-2)_25%,transparent_25%),linear-gradient(225deg,var(--color-bg-2)_25%,transparent_25%)]"
        aria-hidden
      />
      <div className="bg-bg-2">
        <div
          className={cn(
            wrap,
            "flex flex-wrap items-center justify-between gap-4 py-8 font-mono text-[12px] uppercase tracking-[0.06em] text-muted",
          )}
        >
          <div className="flex items-center gap-3 normal-case tracking-normal">
            <Wordmark className="text-[18px]" />
            <span className="font-mono text-[12px]">
              © {new Date().getFullYear()} · thank you for asking
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="https://www.ligator.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink"
            >
              built by lisanegebriel abay
            </a>
            <a
              href="https://github.com/lisan-5/Askbase"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-ink"
            >
              <Github className="size-4" /> source
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
