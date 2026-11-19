import { z } from "zod";

/** What every answer looks like, whether Claude or the built-in engine wrote it. */
export const PlanSchema = z.object({
  title: z.string().describe("Short, specific chart title, e.g. 'Net revenue by month, 2026'"),
  sql: z.string().describe("One read-only DuckDB SELECT (or WITH … SELECT) statement"),
  chart: z.object({
    kind: z.enum(["kpi", "line", "area", "bar", "hbar", "table"]),
    x: z.string().describe("Result column for the x axis or category; empty string for kpi/table"),
    y: z.array(z.string()).describe("One or more numeric result columns to plot"),
    format: z.enum(["currency", "number", "percent"]),
  }),
  explanation: z
    .string()
    .describe("One or two plain-English sentences on how the answer was computed"),
  assumptions: z.array(z.string()).describe("Interpretation choices a careful analyst would flag"),
  followups: z.array(z.string()).describe("Three natural next questions"),
});
export type Plan = z.infer<typeof PlanSchema>;

// Statement keywords that write, load or reach outside the database. (Statements must
// also *start* with a read-only keyword, so SET/USE/etc. can't lead a query.)
const FORBIDDEN =
  /\b(insert|update|delete|drop|create|alter|attach|detach|copy|install|load|pragma|export|import|call|checkpoint|vacuum|truncate|grant|revoke)\b/i;

/**
 * Guardrail for model- or user-written SQL: exactly one read-only statement.
 * DuckDB runs in the browser so the blast radius is small, but we still never run
 * anything that writes, loads extensions or touches files.
 */
export function checkSql(sql: string): { ok: true; sql: string } | { ok: false; reason: string } {
  const stripped = sql.trim().replace(/;+\s*$/, "");
  // Mask string/identifier literals first so their contents can't look like comments
  // or keywords, then drop comments.
  const noStrings = stripped
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""')
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .trim()
    .replace(/;+\s*$/, "");
  if (!noStrings) return { ok: false, reason: "The query is empty." };
  if (noStrings.includes(";"))
    return { ok: false, reason: "Only one statement can run at a time." };
  if (!/^\s*(with|select|from|values|summarize|describe|show)\b/i.test(noStrings))
    return { ok: false, reason: "Only read-only SELECT queries can run here." };
  const bad = noStrings.match(FORBIDDEN);
  if (bad)
    return {
      ok: false,
      reason: `"${bad[0].toUpperCase()}" isn't allowed — Askbase never changes your data.`,
    };
  if (/\bread_(csv|parquet|json)\w*\s*\(|\bhttps?:\/\//i.test(noStrings))
    return { ok: false, reason: "Queries can only read the loaded tables." };
  return { ok: true, sql: stripped };
}
