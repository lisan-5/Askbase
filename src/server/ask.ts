/**
 * The one server-side piece: turns a question + schema into a validated query plan
 * with Claude. Only the question, column names/types and a handful of example values
 * are sent — never the rows themselves, which stay in the visitor's browser.
 *
 * Without ANTHROPIC_API_KEY the function reports `mode: "offline"` and the client falls
 * back to the built-in question engine.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PlanSchema, type Plan } from "@/lib/plan";

const MODEL = "claude-opus-5-5";
// Text-to-SQL is answered fastest at low effort; raise it for harder schemas.
const EFFORT = (process.env.ASKBASE_EFFORT ?? "low") as "low" | "medium" | "high";

const SYSTEM = `You are Askbase, a careful senior data analyst. You turn a business question into ONE DuckDB SQL query over the user's tables, and pick how to chart the result.

Rules for the SQL:
- DuckDB dialect. Read-only: a single SELECT (WITH … SELECT is fine). Never write, create, attach, copy, install or read files/URLs.
- Use only the tables and columns in the schema. Quote identifiers that are not simple snake_case with double quotes.
- Name result columns in readable snake_case (e.g. net_revenue, month, product).
- Dates: use date_trunc('month', col) for monthly series and keep the date column as the x axis. Order time series ascending.
- Money: round to 2 decimals (or 0 for large totals). Percentages: return 0–100 values and use format "percent".
- Relative time ("last quarter", "this year") is relative to the latest date present in the data, not today. Say so in assumptions.
- Prefer clear, correct logic over cleverness. Limit category breakdowns to 25 rows and raw listings to 200.
- If the question can't be answered from the schema, still return the closest useful query and explain the gap in assumptions.

Rules for the chart:
- kpi: a single number (one row). line/area: a time series (x = date column). bar: up to ~12 categories. hbar: ranked categories or long labels. table: anything else, or raw rows.
- x is the category/date column name; y lists the numeric columns to plot (1–4). Use the exact result column names.

Write the explanation for a non-technical business owner. Assumptions: only real interpretation choices. Follow-ups: three specific next questions this data can answer.`;

const Input = z.object({
  question: z.string().min(2).max(500),
  schema: z.string().max(60_000),
  history: z
    .array(z.object({ question: z.string(), sql: z.string() }))
    .max(6)
    .default([]),
  repair: z.object({ sql: z.string(), error: z.string() }).optional(),
});

export type AskResult =
  | { mode: "ai"; plan: Plan; model: string }
  | { mode: "offline"; reason: string }
  | { mode: "error"; message: string };

export const askQuestion = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<AskResult> => {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      return { mode: "offline", reason: "No ANTHROPIC_API_KEY is configured on the server." };
    }
    const client = new Anthropic();

    const context = data.history.length
      ? `Earlier in this session:\n${data.history.map((h) => `Q: ${h.question}\nSQL: ${h.sql}`).join("\n\n")}\n\n`
      : "";
    const repair = data.repair
      ? `\n\nYour previous SQL failed in DuckDB. Fix it.\nSQL:\n${data.repair.sql}\nError:\n${data.repair.error}`
      : "";

    try {
      const response = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: EFFORT, format: betaZodOutputFormat(PlanSchema) },
        // the instructions are identical on every request, so cache them
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `Schema (column types and a few example values; no rows):\n${data.schema}\n\n${context}Question: ${data.question}${repair}`,
          },
        ],
      });

      if (response.stop_reason === "refusal") {
        return {
          mode: "error",
          message:
            "The model declined this question. Try rephrasing it as a question about your data.",
        };
      }
      if (!response.parsed_output) {
        return { mode: "error", message: "The answer came back malformed. Please try again." };
      }
      return { mode: "ai", plan: response.parsed_output, model: response.model };
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError)
        return { mode: "offline", reason: "The configured API key was rejected." };
      if (err instanceof Anthropic.RateLimitError)
        return { mode: "error", message: "Askbase is busy right now — try again in a moment." };
      if (err instanceof Anthropic.APIError)
        return { mode: "error", message: `The AI service returned an error (${err.status}).` };
      return { mode: "error", message: "Couldn't reach the AI service." };
    }
  });

/** Lets the UI show which engine is active without spending a model call. */
export const aiConfig = createServerFn({ method: "GET" }).handler(async () => ({
  enabled: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  model: MODEL,
}));
