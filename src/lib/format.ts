export type Fmt = "currency" | "number" | "percent";

export function fmtValue(v: unknown, fmt: Fmt, compact = false): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (fmt === "percent") return `${n.toFixed(Math.abs(n) < 10 ? 1 : 0)}%`;
  const opts: Intl.NumberFormatOptions = compact
    ? { notation: "compact", maximumFractionDigits: 1 }
    : { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 };
  if (fmt === "currency")
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", ...opts }).format(
      n,
    );
  return new Intl.NumberFormat("en-US", opts).format(n);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-03-01" → "Mar 26"; anything else passes through. */
export function fmtX(v: unknown): string {
  const s = String(v ?? "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return m[3] === "01" || s.length === 7
    ? `${MONTHS[Number(m[2]) - 1]} ${m[1].slice(2)}`
    : `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
}

export const label = (col: string) => col.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
