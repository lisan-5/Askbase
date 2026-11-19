import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Code2,
  Download,
  Pin,
  PinOff,
  Play,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Answer } from "@/lib/answer";
import { cn } from "@/lib/utils";
import { AnswerChart } from "./AnswerChart";
import { SqlBlock } from "./Sql";

export function AnswerCard({
  answer,
  pinned,
  onPin,
  onAsk,
  onRerun,
}: {
  answer: Answer;
  pinned: boolean;
  onPin: () => void;
  onAsk: (q: string) => void;
  onRerun: (sql: string) => void;
}) {
  const [showWork, setShowWork] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(answer.plan.sql);
  useEffect(() => setDraft(answer.plan.sql), [answer.plan.sql]);
  const { plan, result, error } = answer;

  const downloadCsv = () => {
    if (!result) return;
    const head = result.columns.map((c) => c.name).join(",");
    const body = result.rows
      .map((r) =>
        result.columns
          .map((c) => {
            const v = r[c.name];
            const s = v === null ? "" : String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([`${head}\n${body}`], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${plan.title.replace(/[^\w]+/g, "-").toLowerCase()}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="card overflow-hidden"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            <span className="mr-1.5 text-ink-2">“{answer.question}”</span>
          </p>
          <h3 className="display mt-1.5 text-2xl font-semibold leading-tight sm:text-[28px]">
            {plan.title}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px]",
              answer.engine === "claude"
                ? "border-cobalt/30 text-cobalt"
                : "border-line-strong text-muted",
            )}
            title={
              answer.engine === "claude"
                ? "Planned by Claude Opus 5.5"
                : "Planned by the built-in question engine"
            }
          >
            {answer.engine === "claude" ? (
              <Sparkles className="size-3" />
            ) : (
              <Wand2 className="size-3" />
            )}
            {answer.engine === "claude" ? "Claude" : "built-in"}
          </span>
          {answer.repaired && (
            <span
              className="rounded-full border border-mint/40 px-2.5 py-1 font-mono text-[10.5px] text-mint"
              title="The first SQL failed; the AI fixed it automatically"
            >
              self-repaired
            </span>
          )}
        </div>
      </header>

      <div className="px-3 pb-2 pt-4 sm:px-5">
        {error ? (
          <div className="mx-2 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">That query didn't run.</p>
              <p className="mt-1 font-mono text-xs opacity-80">{error}</p>
            </div>
          </div>
        ) : result ? (
          <AnswerChart plan={plan} result={result} />
        ) : null}
      </div>

      <div className="px-5 pb-5 sm:px-7">
        <p className="max-w-3xl text-[14.5px] leading-relaxed text-ink-2">{plan.explanation}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWork((s) => !s)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              showWork ? "border-ink bg-ink text-bg" : "border-line-strong hover:border-ink",
            )}
            aria-expanded={showWork}
          >
            <Code2 className="size-3.5" /> Show your work
          </button>
          <button
            type="button"
            onClick={onPin}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:border-ink"
          >
            {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            {pinned ? "Unpin" : "Pin to dashboard"}
          </button>
          {result && (
            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:border-ink"
            >
              <Download className="size-3.5" /> CSV
            </button>
          )}
          {result && (
            <span className="ml-auto font-mono text-[11px] text-muted">
              {result.rows.length.toLocaleString()} rows ·{" "}
              {result.ms < 1 ? "<1" : Math.round(result.ms)} ms in your browser
            </span>
          )}
        </div>

        <AnimatePresence initial={false}>
          {showWork && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="rounded-2xl border border-line bg-bg-2/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="eyebrow">The SQL it ran</span>
                    <div className="flex gap-1.5">
                      {editing ? (
                        <button
                          type="button"
                          onClick={() => {
                            onRerun(draft);
                            setEditing(false);
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-cobalt px-3 py-1 text-[12px] font-medium text-cobalt-ink"
                        >
                          <Play className="size-3" /> Run
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditing(true)}
                          className="rounded-full border border-line-strong px-3 py-1 text-[12px] hover:border-ink"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                  {editing ? (
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      spellCheck={false}
                      rows={Math.min(18, draft.split("\n").length + 2)}
                      className="w-full resize-y rounded-lg border border-line-strong bg-card p-3 font-mono text-[12.5px] leading-relaxed outline-none focus:border-cobalt"
                    />
                  ) : (
                    <SqlBlock sql={plan.sql} />
                  )}
                </div>
                <div className="space-y-4">
                  {plan.assumptions.length > 0 && (
                    <div>
                      <p className="eyebrow mb-2">Assumptions</p>
                      <ul className="space-y-1.5 text-[13.5px] text-ink-2">
                        {plan.assumptions.map((a) => (
                          <li key={a} className="flex gap-2">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-mint" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <p className="eyebrow mb-2">Privacy</p>
                    <p className="text-[13px] leading-relaxed text-muted">
                      {answer.engine === "claude"
                        ? "Only your question and column names were sent to the AI. The query ran on your own machine."
                        : "Nothing left your browser — the built-in engine planned and ran this locally."}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {plan.followups.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            <span className="eyebrow mr-1 self-center">Next</span>
            {plan.followups.slice(0, 3).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onAsk(f)}
                className="rounded-full bg-bg-2 px-3 py-1.5 text-left text-[12.5px] text-ink-2 transition-colors hover:bg-ink hover:text-bg"
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.article>
  );
}

const STEPS = [
  "Reading your schema",
  "Writing the SQL",
  "Running it in your browser",
  "Choosing the chart",
];

export function Thinking({ question }: { question: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="card p-6 sm:p-7"
      role="status"
      aria-live="polite"
    >
      <p className="text-[13px] text-muted">“{question}”</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-2">
        <div className="h-full w-full animate-shimmer bg-[linear-gradient(90deg,transparent,var(--color-mark),transparent)] bg-[length:50%_100%] bg-no-repeat" />
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={cn(
              "flex items-center gap-2 text-[13px] transition-colors",
              i <= step ? "text-ink" : "text-muted/60",
            )}
          >
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full border text-[10px]",
                i < step
                  ? "border-mint bg-mint text-white"
                  : i === step
                    ? "border-cobalt text-cobalt"
                    : "border-line-strong",
              )}
            >
              {i < step ? <Check className="size-3" /> : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </motion.div>
  );
}
