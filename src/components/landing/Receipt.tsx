/**
 * Every answer prints a receipt. Thermal-paper styling, block-character bar charts,
 * itemised footer ("rows sent to ai ........ 0"), a barcode, and a perforated edge you
 * can tear: the receipt rips off, falls, and a fresh one prints.
 */
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ReceiptLine {
  label: string;
  value: number;
  /** "currency" (default), "percent", "count" or "ratio" ($ per $1) */
  unit?: "currency" | "percent" | "count" | "ratio";
}

const money = (v: number, unit: ReceiptLine["unit"] = "currency") => {
  if (unit === "percent") return `${v.toFixed(1)}%`;
  if (unit === "count") return Math.round(v).toLocaleString("en-US");
  if (unit === "ratio") return `$${v.toFixed(2)}`;
  const a = Math.abs(v);
  const s = a >= 10_000 ? `${(a / 1000).toFixed(1)}k` : Math.round(a).toLocaleString("en-US");
  return `${v < 0 ? "-" : ""}$${s}`;
};

function dots(left: string, right: string, width = 30) {
  const n = Math.max(2, width - left.length - right.length);
  return `${left} ${".".repeat(n)} ${right}`;
}

function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return Array.from({ length: 46 }, () => {
      h = (h * 1103515245 + 12345) >>> 0;
      return 1 + (h % 3);
    });
  }, [seed]);
  return (
    <div className="flex h-9 items-stretch justify-center gap-[2px]" aria-hidden>
      {bars.map((b, i) => (
        <span key={i} className={i % 2 ? "bg-transparent" : "bg-[#1b1b1f]"} style={{ width: b }} />
      ))}
    </div>
  );
}

export function Receipt({
  question,
  lines,
  footer = [],
  note,
  sql,
  printing = false,
  compact = false,
  tearable = false,
  title = "LUMEN COFFEE ROASTERS",
  className,
  children,
}: {
  question: string;
  lines: ReceiptLine[];
  footer?: [string, string][];
  note?: ReactNode;
  sql?: string[];
  printing?: boolean;
  compact?: boolean;
  tearable?: boolean;
  title?: string;
  className?: string;
  children?: ReactNode;
}) {
  const [copy, setCopy] = useState(0);
  const [tearing, setTearing] = useState(false);
  const max = Math.max(...lines.map((l) => Math.abs(l.value)), 1);
  const barW = compact ? 14 : 18;

  const tear = () => {
    if (tearing) return;
    setTearing(true);
    setTimeout(() => {
      setTearing(false);
      setCopy((c) => c + 1);
    }, 900);
  };

  return (
    <div className={cn("relative [filter:drop-shadow(0_18px_22px_rgba(0,0,0,.18))]", className)}>
      {printing && (
        <div
          className="relative z-10 mx-auto h-3 w-[calc(100%+16px)] -translate-x-2 rounded-full bg-ink shadow-[inset_0_-3px_0_rgba(255,255,255,.12)]"
          aria-hidden
        />
      )}
      <AnimatePresence mode="wait">
        <motion.figure
          key={copy}
          initial={printing ? { clipPath: "inset(0 0 100% 0)", y: -12 } : false}
          animate={
            tearing
              ? {
                  y: 260,
                  rotate: 14,
                  opacity: 0,
                  transition: { duration: 0.8, ease: [0.5, 0, 0.75, 0] },
                }
              : { clipPath: "inset(0 0 0% 0)", y: 0, rotate: 0, opacity: 1 }
          }
          transition={{ duration: printing ? 1.6 : 0.4, ease: "linear" }}
          className={cn(
            "receipt relative mx-auto font-mono text-[#1b1b1f]",
            compact
              ? "w-full px-4 pb-5 pt-4 text-[10.5px]"
              : "w-full max-w-[340px] px-5 pb-6 pt-5 text-[11.5px]",
          )}
        >
          <figcaption className="text-center">
            <p className="font-semibold tracking-[0.18em]">{title}</p>
            <p className="mt-0.5 text-[0.85em] uppercase tracking-[0.14em] opacity-60">
              askbase · answer receipt
            </p>
          </figcaption>
          <div className="receipt-rule my-3" />
          <p className="uppercase leading-snug">
            <span className="opacity-60">Q: </span>
            {question}
          </p>
          <div className="receipt-rule my-3" />
          <ul className="space-y-1.5">
            {lines.map((l) => {
              const n = Math.max(1, Math.round((Math.abs(l.value) / max) * barW));
              return (
                <li key={l.label}>
                  <div className="flex justify-between gap-2">
                    <span className="truncate uppercase">{l.label}</span>
                    <span className="num shrink-0">{money(l.value, l.unit)}</span>
                  </div>
                  <div className="leading-none tracking-[-0.02em] opacity-80" aria-hidden>
                    {l.value < 0 ? "▒".repeat(n) : "█".repeat(n)}
                  </div>
                </li>
              );
            })}
          </ul>
          {sql && (
            <>
              <div className="receipt-rule my-3" />
              <p className="mb-1 opacity-60">SQL</p>
              <pre className="whitespace-pre-wrap leading-snug opacity-80">{sql.join("\n")}</pre>
            </>
          )}
          {children}
          {footer.length > 0 && (
            <>
              <div className="receipt-rule my-3" />
              <ul className="space-y-0.5 uppercase">
                {footer.map(([k, v]) => (
                  <li key={k} className="whitespace-pre overflow-hidden text-ellipsis">
                    {dots(k, v, compact ? 28 : 32)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {note && (
            <>
              <div className="receipt-rule my-3" />
              <p className="text-center leading-snug">
                <span className="mark">{note}</span>
              </p>
            </>
          )}
          <div className="mt-4">
            <Barcode seed={question + copy} />
            <p className="mt-1 text-center text-[0.8em] tracking-[0.3em] opacity-60">
              THANK YOU FOR ASKING
            </p>
          </div>
        </motion.figure>
      </AnimatePresence>
      {tearable && (
        <button
          type="button"
          onClick={tear}
          className="mx-auto mt-3 block rounded-full border border-line-strong px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-ink hover:text-ink"
        >
          ✂ tear here
        </button>
      )}
    </div>
  );
}
