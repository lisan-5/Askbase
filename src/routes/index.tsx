import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useInView } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Cpu,
  FileSpreadsheet,
  Github,
  Lock,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { DemoStage } from "@/components/DemoStage";
import { SqlBlock } from "@/components/Sql";
import { Wordmark } from "@/components/Wordmark";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Landing,
});

const EASE = [0.16, 1, 0.3, 1] as const;
const wrap = "mx-auto w-full max-w-[1240px] px-5 sm:px-8";

/** A highlighter swipe that draws when it scrolls into view. */
function Marked({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  return (
    <span
      ref={ref}
      className={cn("mark", seen ? "animate-mark" : "[background-size:0%_72%]")}
      style={{ animationDelay: `${delay}ms` }}
    >
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
  return (
    <div className="min-h-screen overflow-x-clip bg-bg">
      <Nav />
      <Hero />
      <Steps />
      <ShowsWork />
      <Privacy />
      <Questions />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-bg/80 backdrop-blur-md">
      <div className={cn(wrap, "flex h-16 items-center gap-6")}>
        <Link to="/" aria-label="Askbase">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-6 text-[14px] text-ink-2 md:flex">
          <a href="#how" className="hover:text-ink">
            How it works
          </a>
          <a href="#privacy" className="hover:text-ink">
            Privacy
          </a>
          <a href="#questions" className="hover:text-ink">
            Questions
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
        <Link
          to="/app"
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-bg transition-transform hover:-translate-y-0.5"
        >
          Open Askbase <ArrowRight className="size-4" />
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className={cn(wrap, "pb-24 pt-14 sm:pt-20")}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="flex justify-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-card px-3 py-1.5 text-[12.5px] text-ink-2">
          <span className="size-1.5 rounded-full bg-mint" /> Runs a real database in your browser —
          no setup, no upload
        </span>
      </motion.div>

      <h1 className="display mx-auto mt-7 max-w-5xl text-center text-[clamp(3rem,8.4vw,7.4rem)] font-semibold leading-[0.95]">
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

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.45 }}
        className="mx-auto mt-7 max-w-2xl text-center text-[clamp(1.05rem,1.6vw,1.3rem)] leading-relaxed text-ink-2"
      >
        Drop in your Stripe, Shopify or spreadsheet exports. Ask in plain English. Get the answer as
        a chart — and the SQL that proves it.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}
        className="mt-9 flex flex-wrap justify-center gap-3"
      >
        <Link
          to="/app"
          className="group inline-flex items-center gap-2 rounded-full bg-cobalt px-6 py-3.5 text-[15px] font-medium text-cobalt-ink shadow-[0_14px_40px_-14px_var(--color-cobalt)] transition-transform hover:-translate-y-0.5"
        >
          Try it with a sample company{" "}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <a
          href="#how"
          className="inline-flex items-center gap-2 rounded-full border border-line-strong px-6 py-3.5 text-[15px] font-medium hover:border-ink"
        >
          See how it works
        </a>
      </motion.div>

      <motion.div
        className="mx-auto mt-16 max-w-[1080px]"
        initial={{ opacity: 0, y: 60, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, ease: EASE, delay: 0.75 }}
      >
        <DemoStage />
      </motion.div>
    </section>
  );
}

function Steps() {
  const steps = [
    {
      icon: FileSpreadsheet,
      title: "Drop your exports",
      body: "CSV from Stripe, Shopify, Google Sheets, your POS or CRM. Askbase loads it into a real analytics database — right in the tab.",
    },
    {
      icon: MessageSquareText,
      title: "Ask like you'd ask a person",
      body: "“Who are my best customers?” “Did the March promo work?” No SQL, no pivot tables, no waiting for the data team.",
    },
    {
      icon: Check,
      title: "Trust what you see",
      body: "Every chart comes with the exact query, the assumptions it made and the questions worth asking next.",
    },
  ];
  return (
    <section id="how" className="scroll-mt-20 border-y border-line bg-card py-24 sm:py-32">
      <div className={wrap}>
        <Reveal>
          <p className="eyebrow">How it works</p>
          <h2 className="display mt-3 max-w-3xl text-[clamp(2.4rem,5vw,4.2rem)] font-semibold leading-[1]">
            From spreadsheet to <Marked>answer</Marked> in the time it takes to type the question.
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal
              key={s.title}
              delay={i * 0.1}
              className="relative rounded-3xl border border-line bg-bg p-7"
            >
              <span className="display absolute right-6 top-4 text-7xl font-bold text-line-strong">
                {i + 1}
              </span>
              <s.icon className="size-6 text-cobalt" />
              <h3 className="display mt-6 text-2xl font-semibold">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowsWork() {
  return (
    <section className={cn(wrap, "grid items-center gap-14 py-24 sm:py-32 lg:grid-cols-2")}>
      <Reveal>
        <p className="eyebrow">No black boxes</p>
        <h2 className="display mt-3 text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[1]">
          It <Marked>shows its work</Marked>. Every time.
        </h2>
        <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-ink-2">
          AI that guesses at numbers is worse than no AI. Askbase writes a real SQL query, runs it
          against your data and shows you both — so the answer is checkable, editable and
          repeatable.
        </p>
        <ul className="mt-8 space-y-3 text-[15px]">
          {[
            "The exact query, editable and re-runnable",
            "The assumptions it made, in plain English",
            "Read-only by design: it can never change your data",
            "If a query fails, it reads the error and fixes itself",
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-mint/15 text-mint">
                <Check className="size-3" />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={0.15}>
        <div className="card relative rotate-[-1.2deg] p-6 shadow-[0_30px_80px_-40px_rgba(14,15,19,.4)]">
          <p className="text-[13px] text-muted">“Who are my most valuable customers?”</p>
          <p className="display mt-1 text-2xl font-semibold">Top customers by lifetime revenue</p>
          <div className="mt-4 rounded-2xl border border-line bg-bg-2/70 p-4">
            <p className="eyebrow mb-2">The SQL it ran</p>
            <SqlBlock
              sql={`SELECT c.name, c.country,
       count(o.order_id) AS orders,
       sum(o.total) AS lifetime_revenue
FROM customers c
JOIN orders o USING (customer_id)
WHERE o.status = 'paid'
GROUP BY 1, 2
ORDER BY lifetime_revenue DESC
LIMIT 10`}
            />
          </div>
          <div className="mt-4">
            <p className="eyebrow mb-2">Assumptions</p>
            <p className="text-[13.5px] text-ink-2">
              “Most valuable” means highest total of paid orders, after discounts.
            </p>
          </div>
          <span className="absolute -right-3 -top-3 rotate-6 rounded-full bg-mark px-3 py-1 text-[12px] font-semibold text-[#0e0f13] shadow">
            checkable ✓
          </span>
        </div>
      </Reveal>
    </section>
  );
}

function Privacy() {
  return (
    <section id="privacy" className="scroll-mt-20 bg-ink py-24 text-bg sm:py-32">
      <div className={wrap}>
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-bg/60">
            Privacy by architecture
          </p>
          <h2 className="display mt-3 max-w-4xl text-[clamp(2.4rem,5.4vw,4.6rem)] font-semibold leading-[1]">
            Your rows <span className="mark">never leave</span> your browser.
          </h2>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-bg/75">
            Askbase runs DuckDB — a full analytics database — compiled to WebAssembly, inside your
            tab. Your files are never uploaded. The AI sees your question and your column names, and
            nothing else.
          </p>
        </Reveal>
        <div className="mt-16 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <Reveal className="rounded-3xl border border-bg/15 p-7">
            <div className="flex items-center gap-2 font-mono text-[12px] text-mark">
              <Cpu className="size-4" /> YOUR BROWSER
            </div>
            <ul className="mt-6 space-y-3 text-[15px]">
              {[
                "Your CSV files",
                "Every row of data",
                "The database (DuckDB, WebAssembly)",
                "Query execution and results",
                "Charts and your dashboard",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <Lock className="size-4 text-mark" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal
            delay={0.1}
            className="flex flex-col items-center justify-center gap-2 px-4 py-6 font-mono text-[11px] text-bg/60"
          >
            <span>question + column names</span>
            <motion.span
              className="h-px w-28 bg-gradient-to-r from-transparent via-mark to-transparent"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2.4, repeat: Infinity }}
            />
            <span>a SQL query back</span>
          </Reveal>
          <Reveal delay={0.2} className="rounded-3xl border border-bg/15 p-7">
            <div className="flex items-center gap-2 font-mono text-[12px] text-bg/70">
              <ShieldCheck className="size-4" /> THE AI (CLAUDE)
            </div>
            <ul className="mt-6 space-y-3 text-[15px] text-bg/85">
              {[
                "Your question",
                "Table and column names",
                "A few example values per column",
                "No rows. No files. No totals.",
              ].map((t, i) => (
                <li
                  key={t}
                  className={cn("flex items-center gap-3", i === 3 && "font-semibold text-bg")}
                >
                  <span className="size-1.5 rounded-full bg-bg/50" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const QUESTION_ROWS = [
  [
    "Who are my top 20 customers this year?",
    "Which products lost money last quarter?",
    "What's my refund rate by month?",
    "Did the spring sale actually work?",
    "Which country is growing fastest?",
  ],
  [
    "What's MRR by plan?",
    "Which plan churns fastest?",
    "How long until a new customer orders again?",
    "Revenue vs ad spend by channel",
    "What's our average order value on mobile?",
  ],
  [
    "Which invoices are overdue more than 30 days?",
    "Best-selling items on weekends",
    "Which suppliers raised prices this year?",
    "How many customers came back after their first order?",
    "Busiest hour of the day?",
  ],
];

function Questions() {
  return (
    <section id="questions" className="scroll-mt-20 overflow-hidden py-24 sm:py-32">
      <div className={wrap}>
        <Reveal>
          <p className="eyebrow">Questions people ask</p>
          <h2 className="display mt-3 max-w-3xl text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[1]">
            The questions you <Marked>actually</Marked> have — not the dashboards someone else
            built.
          </h2>
        </Reveal>
      </div>
      <div className="mt-14 space-y-4">
        {QUESTION_ROWS.map((row, r) => (
          <div
            key={r}
            className="group flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]"
          >
            <div
              className="flex w-max gap-3 [animation:marquee_var(--d)_linear_infinite] group-hover:[animation-play-state:paused]"
              style={{
                ["--d" as string]: `${50 + r * 12}s`,
                animationDirection: r % 2 ? "reverse" : "normal",
              }}
            >
              {[...row, ...row, ...row, ...row].map((q, i) => (
                <Link
                  key={i}
                  to="/app"
                  search={{ q }}
                  className="shrink-0 rounded-full border border-line-strong bg-card px-5 py-3 text-[15px] text-ink-2 transition-colors hover:border-ink hover:bg-ink hover:text-bg"
                >
                  {q}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </section>
  );
}

function FinalCta() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <section className={cn(wrap, "pb-24 sm:pb-32")}>
      <Reveal className="relative overflow-hidden rounded-[32px] bg-cobalt px-6 py-16 text-center text-cobalt-ink sm:px-12 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:22px_22px]"
        />
        <h2 className="display relative mx-auto max-w-3xl text-[clamp(2.4rem,5.6vw,4.8rem)] font-semibold leading-[0.98]">
          What do you want to <span className="mark">know</span>?
        </h2>
        <p className="relative mx-auto mt-5 max-w-xl text-[17px] opacity-85">
          Ask the sample coffee company anything. No sign-up.
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
            Ask <ArrowRight className="size-4" />
          </button>
        </form>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div
        className={cn(
          wrap,
          "flex flex-wrap items-center justify-between gap-4 py-8 text-[13px] text-muted",
        )}
      >
        <div className="flex items-center gap-3">
          <Wordmark className="text-[18px]" />
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="https://www.ligator.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
            Built by Lisanegebriel Abay
          </a>
          <a
            href="https://github.com/lisan-5/Askbase"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-ink"
          >
            <Github className="size-4" /> Source
          </a>
        </div>
      </div>
    </footer>
  );
}
