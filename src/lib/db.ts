/**
 * The analytics engine: DuckDB compiled to WebAssembly, running in a Web Worker in the
 * visitor's browser. Rows never leave the machine. The WebAssembly build is served from
 * our own origin (no CDN dependency) and only fetched when the workspace opens.
 */
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import ehWasm from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import mvpWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import { DEMO_DESCRIPTIONS, generateDemo, toCsv, type DemoTables } from "./demo-data";

export interface Column {
  name: string;
  type: string;
}
export interface TableInfo {
  name: string;
  rows: number;
  columns: (Column & { samples: string[] })[];
  description?: string;
  source: "sample" | "upload";
}
export interface QueryResult {
  columns: Column[];
  rows: Record<string, string | number | null>[];
  ms: number;
}

let ready: Promise<{ db: AsyncDuckDB; conn: AsyncDuckDBConnection }> | null = null;

export function getDb() {
  if (ready) return ready;
  ready = (async () => {
    const duckdb = await import("@duckdb/duckdb-wasm");
    const bundle = await duckdb.selectBundle({
      mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
      eh: { mainModule: ehWasm, mainWorker: ehWorker },
    });
    const worker = new Worker(bundle.mainWorker!);
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const conn = await db.connect();
    return { db, conn };
  })();
  return ready;
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** Turn an arbitrary file name into a friendly snake_case table name. */
export function tableNameFor(file: string) {
  const base = file
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return /^[a-z_]/.test(base) ? base || "data" : `t_${base}`;
}

async function loadCsvText(name: string, csv: string) {
  const { db, conn } = await getDb();
  const file = `${name}.csv`;
  await db.registerFileText(file, csv);
  await conn.query(
    `CREATE OR REPLACE TABLE ${ident(name)} AS SELECT * FROM read_csv_auto('${file}', header = true, sample_size = -1)`,
  );
}

export async function loadSample() {
  const tables = generateDemo();
  for (const [name, rows] of Object.entries(tables) as [
    keyof DemoTables,
    DemoTables[keyof DemoTables],
  ][]) {
    await loadCsvText(name, toCsv(rows));
  }
  // typed views make dates behave like dates everywhere
  return Object.keys(tables);
}

export async function loadFile(file: File) {
  const name = tableNameFor(file.name);
  const text = await file.text();
  await loadCsvText(name, text);
  return name;
}

export async function dropTable(name: string) {
  const { conn } = await getDb();
  await conn.query(`DROP TABLE IF EXISTS ${ident(name)}`);
}

function plain(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Decimals and other arrow wrappers stringify to their numeric value
  const s = String(v);
  const n = Number(s);
  return Number.isFinite(n) && s.trim() !== "" ? n : s;
}

export async function runQuery(sql: string): Promise<QueryResult> {
  const { conn } = await getDb();
  const t0 = performance.now();
  const table = await conn.query(sql);
  const ms = performance.now() - t0;
  const columns = table.schema.fields.map((f) => ({ name: f.name, type: String(f.type) }));
  const dateCols = new Set(
    table.schema.fields.filter((f) => /^(Date|Timestamp)/.test(String(f.type))).map((f) => f.name),
  );
  const rows = table.toArray().map((r) => {
    const obj = r.toJSON() as Record<string, unknown>;
    const out: Record<string, string | number | null> = {};
    for (const c of columns) {
      const v = obj[c.name];
      out[c.name] =
        dateCols.has(c.name) && v !== null && v !== undefined
          ? new Date(Number(v))
              .toISOString()
              .slice(0, String(columnType(table, c.name)).startsWith("Timestamp") ? 19 : 10)
              .replace("T", " ")
          : plain(v);
    }
    return out;
  });
  return { columns, rows, ms };
}

function columnType(
  table: { schema: { fields: { name: string; type: unknown }[] } },
  name: string,
) {
  return table.schema.fields.find((f) => f.name === name)?.type ?? "";
}

export async function describeTables(
  source: Record<string, "sample" | "upload">,
): Promise<TableInfo[]> {
  const { conn } = await getDb();
  const cols = await conn.query(
    "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'main' ORDER BY table_name, ordinal_position",
  );
  const byTable = new Map<string, Column[]>();
  for (const row of cols.toArray()) {
    const { table_name, column_name, data_type } = row.toJSON() as Record<string, string>;
    byTable.set(table_name, [
      ...(byTable.get(table_name) ?? []),
      { name: column_name, type: data_type },
    ]);
  }
  const out: TableInfo[] = [];
  for (const [name, columns] of byTable) {
    const count = await conn.query(`SELECT count(*) AS n FROM ${ident(name)}`);
    const rows = Number((count.toArray()[0].toJSON() as { n: bigint }).n);
    // a few distinct example values per column give the AI (and the user) a feel for the data
    const withSamples = await Promise.all(
      columns.map(async (c) => {
        const res = await conn.query(
          `SELECT DISTINCT ${ident(c.name)} AS v FROM ${ident(name)} WHERE ${ident(c.name)} IS NOT NULL LIMIT 4`,
        );
        const samples = res.toArray().map((r) => {
          const v = (r.toJSON() as { v: unknown }).v;
          if (v instanceof Date) return v.toISOString().slice(0, 10);
          if (/DATE|TIMESTAMP/.test(c.type) && (typeof v === "number" || typeof v === "bigint"))
            return new Date(Number(v)).toISOString().slice(0, 10);
          return String(plain(v));
        });
        return { ...c, samples };
      }),
    );
    out.push({
      name,
      rows,
      columns: withSamples,
      source: source[name] ?? "upload",
      description: (DEMO_DESCRIPTIONS as Record<string, string>)[name],
    });
  }
  return out;
}

/** Compact schema text for the model: names, types and a few example values. No rows. */
export function schemaPrompt(tables: TableInfo[]) {
  return tables
    .map(
      (t) =>
        `TABLE ${t.name} (${t.rows.toLocaleString("en-US")} rows)${t.description ? ` -- ${t.description}` : ""}\n` +
        t.columns
          .map(
            (c) =>
              `  ${c.name} ${c.type}${c.samples.length ? `  e.g. ${c.samples.map((s) => JSON.stringify(s)).join(", ")}` : ""}`,
          )
          .join("\n"),
    )
    .join("\n\n");
}
