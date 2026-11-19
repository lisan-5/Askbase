import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  ChevronRight,
  Database,
  FileSpreadsheet,
  LayoutGrid,
  Loader2,
  Lock,
  MessageSquareText,
  Moon,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerCard, Thinking } from "@/components/AnswerCard";
import { Wordmark } from "@/components/Wordmark";
import { answer as runAnswer, rerun, type Answer } from "@/lib/answer";
import { describeTables, dropTable, getDb, loadFile, loadSample, type TableInfo } from "@/lib/db";
import { SAMPLE_QUESTIONS } from "@/lib/offline";
import { cn } from "@/lib/utils";
import { aiConfig } from "@/server/ask";

export const Route = createFileRoute("/app")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: () => ({ meta: [{ title: "Askbase — workspace" }] }),
  component: Workspace,
});

type Pinned = Pick<Answer, "id" | "question" | "plan" | "engine">;
const PIN_KEY = "askbase.pinned";

function readPins(): Pinned[] {
  try {
    return JSON.parse(localStorage.getItem(PIN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function Workspace() {
  const { q } = Route.useSearch();
  const [phase, setPhase] = useState<"booting" | "ready" | "error">("booting");
  const [bootMsg, setBootMsg] = useState("Starting the database in your browser…");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const sources = useRef<Record<string, "sample" | "upload">>({});
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pins, setPins] = useState<Pinned[]>([]);
  const [view, setView] = useState<"ask" | "dashboard">("ask");
  const [ai, setAi] = useState<{ enabled: boolean; model: string } | null>(null);
  const askedFromUrl = useRef(false);

  const refresh = useCallback(async () => setTables(await describeTables(sources.current)), []);

  useEffect(() => {
    setPins(readPins());
    aiConfig()
      .then(setAi)
      .catch(() => setAi({ enabled: false, model: "" }));
    (async () => {
      try {
        await getDb();
        setBootMsg("Generating Lumen Coffee Roasters…");
        const names = await loadSample();
        names.forEach((n) => (sources.current[n] = "sample"));
        await refresh();
        setPhase("ready");
      } catch (e) {
        setBootMsg(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();
  }, [refresh]);

  const sampleOnly = tables.length > 0 && tables.every((t) => t.source === "sample");

  const ask = useCallback(
    async (question: string) => {
      const qn = question.trim();
      if (!qn || pending) return;
      setView("ask");
      setError(null);
      setPending(qn);
      try {
        const history = answers.slice(0, 4).map((a) => ({ question: a.question, sql: a.plan.sql }));
        const a = await runAnswer(qn, tables, history);
        setAnswers((prev) => [a, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPending(null);
      }
    },
    [answers, pending, tables],
  );

  useEffect(() => {
    if (phase === "ready" && q && !askedFromUrl.current) {
      askedFromUrl.current = true;
      ask(q);
    }
  }, [phase, q, ask]);

  const togglePin = (a: Answer) => {
    setPins((prev) => {
      const next = prev.some((p) => p.id === a.id)
        ? prev.filter((p) => p.id !== a.id)
        : [{ id: a.id, question: a.question, plan: a.plan, engine: a.engine }, ...prev];
      try {
        localStorage.setItem(PIN_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  const onFiles = async (files: FileList | File[]) => {
    setError(null);
    for (const f of Array.from(files)) {
      if (!/\.(csv|tsv|txt)$/i.test(f.name)) {
        setError(`${f.name}: export it as CSV first (Stripe, Shopify and Google Sheets all can).`);
        continue;
      }
      try {
        const name = await loadFile(f);
        sources.current[name] = "upload";
      } catch (e) {
        setError(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await refresh();
  };

  const removeTable = async (name: string) => {
    await dropTable(name);
    delete sources.current[name];
    await refresh();
  };

  const suggestions = sampleOnly
    ? SAMPLE_QUESTIONS
    : tables
        .filter((t) => t.source === "upload")
        .flatMap((t) => {
          const text = t.columns.find((c) => /VARCHAR|TEXT/.test(c.type));
          const num = t.columns.find(
            (c) => /INT|DOUBLE|DECIMAL|FLOAT|BIGINT/.test(c.type) && !/id$/i.test(c.name),
          );
          const date = t.columns.find((c) => /DATE|TIMESTAMP/.test(c.type));
          return [
            `What's in ${t.name}?`,
            num && text ? `Total ${num.name} by ${text.name} in ${t.name}` : null,
            num && date ? `${num.name} over time in ${t.name}` : null,
          ].filter(Boolean) as string[];
        })
        .slice(0, 6);

  return (
    <div className="min-h-screen bg-bg">
      <TopBar view={view} setView={setView} pinCount={pins.length} ai={ai} />

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 pb-24 pt-6 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Sources tables={tables} phase={phase} onFiles={onFiles} onRemove={removeTable} />

        <main className="min-w-0">
          {phase !== "ready" ? (
            <Boot message={bootMsg} failed={phase === "error"} />
          ) : view === "dashboard" ? (
            <Dashboard
              pins={pins}
              onUnpin={(id) => togglePin({ id } as Answer)}
              onAsk={ask}
              schemaReady={tables.length > 0}
            />
          ) : (
            <>
              <Composer
                onAsk={ask}
                busy={!!pending}
                suggestions={suggestions}
                dataLabel={
                  sampleOnly ? "Lumen Coffee Roasters (sample)" : `${tables.length} tables`
                }
              />
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 rounded-2xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger"
                    role="alert"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="mt-6 space-y-6">
                <AnimatePresence mode="popLayout">
                  {pending && <Thinking key="thinking" question={pending} />}
                </AnimatePresence>
                {answers.map((a) => (
                  <AnswerCard
                    key={a.id}
                    answer={a}
                    pinned={pins.some((p) => p.id === a.id)}
                    onPin={() => togglePin(a)}
                    onAsk={ask}
                    onRerun={async (sql) => {
                      const next = await rerun(a, sql);
                      setAnswers((prev) => prev.map((x) => (x.id === a.id ? next : x)));
                    }}
                  />
                ))}
                {!answers.length && !pending && <EmptyHint />}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function TopBar({
  view,
  setView,
  pinCount,
  ai,
}: {
  view: "ask" | "dashboard";
  setView: (v: "ask" | "dashboard") => void;
  pinCount: number;
  ai: { enabled: boolean; model: string } | null;
}) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("askbase.theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };
  const tab = (v: "ask" | "dashboard", icon: React.ReactNode, text: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
        view === v ? "bg-ink text-bg" : "text-muted hover:text-ink",
      )}
      aria-pressed={view === v}
    >
      {icon}
      {text}
    </button>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="Askbase home">
          <Wordmark />
        </Link>
        <nav className="ml-2 flex items-center gap-1 rounded-full border border-line p-1">
          {tab("ask", <MessageSquareText className="size-3.5" />, "Ask")}
          {tab(
            "dashboard",
            <LayoutGrid className="size-3.5" />,
            `Dashboard${pinCount ? ` · ${pinCount}` : ""}`,
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] sm:inline-flex",
              ai?.enabled ? "border-cobalt/30 text-cobalt" : "border-line-strong text-muted",
            )}
            title={
              ai?.enabled
                ? "Any question works: Claude plans the SQL"
                : "No API key on the server: the built-in engine answers common questions about the sample data"
            }
          >
            {ai === null ? (
              <Loader2 className="size-3 animate-spin" />
            ) : ai.enabled ? (
              <Sparkles className="size-3" />
            ) : (
              <Wand2 className="size-3" />
            )}
            {ai === null ? "checking…" : ai.enabled ? "Claude Opus 5.5" : "built-in engine"}
          </span>
          <button
            type="button"
            onClick={toggle}
            className="grid size-9 place-items-center rounded-full border border-line hover:border-ink"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Sources({
  tables,
  phase,
  onFiles,
  onRemove,
}: {
  tables: TableInfo[];
  phase: string;
  onFiles: (f: FileList | File[]) => void;
  onRemove: (name: string) => void;
}) {
  const [open, setOpen] = useState<string | null>("orders");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <aside className="order-last space-y-4 lg:sticky lg:top-22 lg:order-none lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow flex items-center gap-1.5">
            <Database className="size-3" /> Your data
          </span>
          <span className="font-mono text-[11px] text-muted">{tables.length} tables</span>
        </div>
        {phase === "booting" && <div className="h-40 animate-pulse rounded-xl bg-bg-2" />}
        <ul className="space-y-1">
          {tables.map((t) => (
            <li key={t.name}>
              <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-2">
                <button
                  type="button"
                  onClick={() => setOpen((o) => (o === t.name ? null : t.name))}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-expanded={open === t.name}
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 shrink-0 text-muted transition-transform",
                      open === t.name && "rotate-90",
                    )}
                  />
                  <FileSpreadsheet
                    className={cn(
                      "size-3.5 shrink-0",
                      t.source === "upload" ? "text-cobalt" : "text-muted",
                    )}
                  />
                  <span className="truncate font-mono text-[12.5px]">{t.name}</span>
                </button>
                <span className="num font-mono text-[11px] text-muted">
                  {t.rows.toLocaleString()}
                </span>
                {t.source === "upload" && (
                  <button
                    type="button"
                    onClick={() => onRemove(t.name)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Remove ${t.name}`}
                  >
                    <Trash2 className="size-3.5 text-muted hover:text-danger" />
                  </button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {open === t.name && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {t.description && (
                      <p className="px-8 pb-1 text-[12px] leading-snug text-muted">
                        {t.description}
                      </p>
                    )}
                    <ul className="pb-2 pl-8 pr-2">
                      {t.columns.map((c) => (
                        <li
                          key={c.name}
                          className="flex items-baseline justify-between gap-2 py-0.5"
                          title={c.samples.length ? `e.g. ${c.samples.join(", ")}` : undefined}
                        >
                          <span className="truncate font-mono text-[12px] text-ink-2">
                            {c.name}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] uppercase text-muted">
                            {c.type.replace(/\(.*\)/, "").toLowerCase()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          ))}
        </ul>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "card cursor-pointer border-dashed p-5 text-center transition-colors",
          over ? "border-cobalt bg-cobalt/5" : "hover:border-line-strong",
        )}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
      >
        <Upload className="mx-auto size-5 text-muted" />
        <p className="mt-2 text-[13.5px] font-medium">Drop your CSV exports</p>
        <p className="mt-1 text-[12px] leading-snug text-muted">
          Stripe, Shopify, Google Sheets, your POS — anything that exports CSV.
        </p>
        <input
          ref={input}
          type="file"
          accept=".csv,.tsv,.txt"
          multiple
          hidden
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />
      </div>

      <div className="flex gap-3 rounded-2xl bg-ink p-4 text-bg">
        <Lock className="mt-0.5 size-4 shrink-0 text-mark" />
        <p className="text-[12.5px] leading-relaxed opacity-90">
          Your rows stay in this browser tab. Askbase runs a real database (DuckDB) on your machine;
          the AI only ever sees your question and column names.
        </p>
      </div>
    </aside>
  );
}

function Composer({
  onAsk,
  busy,
  suggestions,
  dataLabel,
}: {
  onAsk: (q: string) => void;
  busy: boolean;
  suggestions: string[];
  dataLabel: string;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    if (!value.trim()) return;
    onAsk(value);
    setValue("");
  };
  return (
    <section className="card p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h1 className="display text-3xl font-semibold sm:text-4xl">
          Ask <span className="mark">anything</span>.
        </h1>
        <span className="hidden font-mono text-[11px] text-muted sm:block">{dataLabel}</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-5 flex items-end gap-3 rounded-2xl border border-line-strong bg-bg px-4 py-3 transition-colors focus-within:border-cobalt"
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Which products lost money last quarter?"
          className="max-h-40 min-h-[28px] flex-1 resize-none bg-transparent text-[17px] outline-none placeholder:text-muted/70"
          aria-label="Your question"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-cobalt text-cobalt-ink transition-opacity disabled:opacity-30"
          aria-label="Ask"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onAsk(s)}
            disabled={busy}
            className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-ink hover:bg-ink hover:text-bg disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}

function EmptyHint() {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-line-strong px-6 py-16 text-center">
      <p className="display max-w-lg text-2xl font-medium text-ink-2">
        Lumen Coffee Roasters is loaded: 22 months of orders, products, subscriptions and ad spend.
      </p>
      <p className="mt-3 max-w-md text-sm text-muted">
        Pick a suggested question, or ask your own. Every answer comes with the SQL that produced
        it.
      </p>
    </div>
  );
}

function Boot({ message, failed }: { message: string; failed: boolean }) {
  return (
    <div className="card grid min-h-[420px] place-items-center p-10 text-center">
      <div>
        {!failed && <Loader2 className="mx-auto size-6 animate-spin text-cobalt" />}
        <p className={cn("display mt-4 text-2xl font-medium", failed && "text-danger")}>
          {failed ? "The database couldn't start" : "Warming up"}
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          {failed ? `${message}. Try a recent Chrome, Edge, Firefox or Safari.` : message}
        </p>
      </div>
    </div>
  );
}

function Dashboard({
  pins,
  onUnpin,
  onAsk,
  schemaReady,
}: {
  pins: Pinned[];
  onUnpin: (id: string) => void;
  onAsk: (q: string) => void;
  schemaReady: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  useEffect(() => {
    if (!schemaReady) return;
    let cancelled = false;
    (async () => {
      for (const p of pins) {
        const a = await rerun({ ...p, createdAt: 0 }, p.plan.sql);
        if (!cancelled) setAnswers((prev) => ({ ...prev, [p.id]: a }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pins, schemaReady]);

  if (!pins.length) {
    return (
      <div className="grid place-items-center rounded-3xl border border-dashed border-line-strong px-6 py-24 text-center">
        <LayoutGrid className="size-6 text-muted" />
        <p className="display mt-4 text-2xl font-medium">Your dashboard is empty</p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Pin any answer and it lands here — re-run live against your data every time you open it.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {pins.map((p) => {
        const a = answers[p.id];
        return a ? (
          <AnswerCard
            key={p.id}
            answer={a}
            pinned
            onPin={() => onUnpin(p.id)}
            onAsk={onAsk}
            onRerun={() => undefined}
          />
        ) : (
          <div key={p.id} className="card h-80 animate-pulse" />
        );
      })}
    </div>
  );
}
