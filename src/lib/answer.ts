/**
 * Question → answer pipeline (client side):
 * 1. ask Claude for a plan (or use the built-in engine when AI is offline),
 * 2. guard the SQL (read-only, single statement),
 * 3. run it in the in-browser DuckDB,
 * 4. if DuckDB rejects it, hand the error back to Claude once for a repair.
 */
import { askQuestion } from "@/server/ask";
import { runQuery, schemaPrompt, type QueryResult, type TableInfo } from "./db";
import { genericPlan, offlinePlan } from "./offline";
import { checkSql, type Plan } from "./plan";

export interface Answer {
  id: string;
  question: string;
  plan: Plan;
  result?: QueryResult;
  error?: string;
  engine: "claude" | "builtin";
  repaired?: boolean;
  createdAt: number;
}

export type AiStatus = "unknown" | "online" | "offline";

let aiStatus: AiStatus = "unknown";
export const getAiStatus = () => aiStatus;

const uid = () => Math.random().toString(36).slice(2, 10);

async function execute(plan: Plan): Promise<{ result?: QueryResult; error?: string }> {
  const guard = checkSql(plan.sql);
  if (!guard.ok) return { error: guard.reason };
  try {
    return { result: await runQuery(guard.sql) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function answer(
  question: string,
  tables: TableInfo[],
  history: { question: string; sql: string }[],
): Promise<Answer> {
  const schema = schemaPrompt(tables);
  const hasSample = tables.some((t) => t.source === "sample");
  const uploads = tables.filter((t) => t.source === "upload");
  // the built-in engine: sample-company questions first, then generic patterns for uploads
  const builtin = () =>
    (uploads.some((t) => question.toLowerCase().includes(t.name))
      ? null
      : hasSample
        ? offlinePlan(question)
        : null) ?? genericPlan(question, uploads.length ? uploads : tables);
  const base = { id: uid(), question, createdAt: Date.now() };

  if (aiStatus !== "offline") {
    const res = await askQuestion({ data: { question, schema, history: history.slice(-4) } });
    if (res.mode === "ai") {
      aiStatus = "online";
      let plan = res.plan;
      let run = await execute(plan);
      let repaired = false;
      if (run.error) {
        const fix = await askQuestion({
          data: {
            question,
            schema,
            history: history.slice(-4),
            repair: { sql: plan.sql, error: run.error },
          },
        });
        if (fix.mode === "ai") {
          const second = await execute(fix.plan);
          if (!second.error) {
            plan = fix.plan;
            run = second;
            repaired = true;
          }
        }
      }
      return { ...base, plan, ...run, engine: "claude", repaired };
    }
    if (res.mode === "offline") aiStatus = "offline";
    else if (res.mode === "error") {
      // transient AI trouble: fall through to the built-in engine for this question
      const local = builtin();
      if (!local) throw new Error(res.message);
      return { ...base, plan: local, ...(await execute(local)), engine: "builtin" };
    }
  }

  const local = builtin();
  if (!local) {
    throw new Error(
      "The built-in engine doesn't know that one yet. Try a suggested question — or add an ANTHROPIC_API_KEY on the server to ask anything.",
    );
  }
  return { ...base, plan: local, ...(await execute(local)), engine: "builtin" };
}

/** Re-run edited SQL from the "show your work" panel. */
export async function rerun(prev: Answer, sql: string): Promise<Answer> {
  const plan = { ...prev.plan, sql };
  const run = await execute(plan);
  return { ...prev, plan, result: run.result, error: run.error };
}
